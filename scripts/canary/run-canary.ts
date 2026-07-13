/**
 * LedgerMail synthetic canary.
 *
 * This is the "test agent that acts like a user" — it sends a real email
 * through Gmail and checks that LedgerMail's live pipeline (OAuth fetch ->
 * sanitize -> LLM parse -> validate -> DB -> CondoSync webhook) still works
 * end to end against the deployed API. It's meant to run on a schedule
 * (see .github/workflows/canary.yml), not on every push — it costs real
 * LLM tokens and depends on live Gmail delivery.
 *
 * Two tiers, run independently so a failure in one doesn't hide the other:
 *
 *   Tier A (Gmail ingestion liveness): sends a real email over SMTP to the
 *   monitored test inbox, then polls POST /api/gmail/sync until that message
 *   shows up in the sync results. Proves OAuth token refresh, Gmail API
 *   fetch, and the dedupe/DB-write path are alive. Bank fingerprint
 *   detection is NOT expected to match here (the email isn't sent from a
 *   real bank domain), so a "No bank provider detected" outcome for this
 *   message is a PASS for Tier A.
 *
 *   Tier B (parse/validate/DB/webhook pipeline): calls POST /api/parse
 *   directly with the real Banco de Chile fixture HTML (unique folio/amount
 *   per run) and asserts the extracted fields match exactly. This is what
 *   actually proves the LLM + validation + webhook-to-CondoSync chain works.
 *
 * Required env: API_BASE_URL, CANARY_SMTP_USER, CANARY_SMTP_PASS,
 * CANARY_TARGET_EMAIL, CANARY_MAILBOX_SOURCE_ID. Optional:
 * CANARY_ALERT_WEBHOOK_URL (Slack incoming webhook, notified on failure).
 */
import dotenv from "dotenv";
dotenv.config();

import { buildCanaryFixture } from "./lib/fixture";
import { getMailerConfigFromEnv, sendCanaryEmail } from "./lib/mailer";
import { triggerGmailSync, parseDirect } from "./lib/api-client";
import { sendAlert } from "./lib/alert";

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface TierResult {
  name: string;
  passed: boolean;
  latencyMs: number | null;
  details: string;
}

async function runTierB(fixture: ReturnType<typeof buildCanaryFixture>): Promise<TierResult> {
  const mailboxSourceId = requireEnv("CANARY_MAILBOX_SOURCE_ID");
  const start = Date.now();

  try {
    const result = await parseDirect({
      from: "bancochile-informa@bancochile.cl",
      subject: fixture.subject,
      bodyHtml: fixture.html,
      mailboxSourceId
    });

    const latencyMs = Date.now() - start;

    if (!result.success) {
      return { name: "Tier B (parse pipeline)", passed: false, latencyMs, details: `API returned success=false: ${result.error}` };
    }

    const txn = result.transactions?.[0];
    if (!txn) {
      return { name: "Tier B (parse pipeline)", passed: false, latencyMs, details: "No transaction returned despite success=true" };
    }

    const mismatches: string[] = [];
    const expected = fixture.expected;
    const checks: Array<[string, any, any]> = [
      ["amount", txn.amount, expected.amount],
      ["currency", txn.currency, expected.currency],
      ["senderName", txn.senderName, expected.senderName],
      ["senderAccount", txn.senderAccount, expected.senderAccount],
      ["receiverAccount", txn.receiverAccount, expected.receiverAccount],
      ["reference", txn.reference, expected.reference],
      ["description", txn.description, expected.description]
    ];
    for (const [field, actual, exp] of checks) {
      if (actual !== exp) {
        mismatches.push(`${field}: expected ${JSON.stringify(exp)}, got ${JSON.stringify(actual)}`);
      }
    }

    if (mismatches.length > 0) {
      return { name: "Tier B (parse pipeline)", passed: false, latencyMs, details: `Field mismatches:\n  ${mismatches.join("\n  ")}` };
    }

    return { name: "Tier B (parse pipeline)", passed: true, latencyMs, details: `Transaction ${txn.id ?? "(no id)"} parsed correctly` };
  } catch (err: any) {
    return { name: "Tier B (parse pipeline)", passed: false, latencyMs: Date.now() - start, details: err.message || String(err) };
  }
}

async function runTierA(fixture: ReturnType<typeof buildCanaryFixture>): Promise<TierResult> {
  const mailerConfig = getMailerConfigFromEnv();
  const mailboxSourceId = requireEnv("CANARY_MAILBOX_SOURCE_ID");
  const start = Date.now();

  await sendCanaryEmail(mailerConfig, fixture.subject, fixture.html);

  const maxAttempts = 6;
  const delayMs = 20000; // Gmail delivery + indexing can take a little while

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(delayMs);
    try {
      const sync = await triggerGmailSync(mailboxSourceId, 10);
      const found = sync.details.find(d => d.subject === fixture.subject);
      if (found) {
        const latencyMs = Date.now() - start;
        return {
          name: "Tier A (Gmail ingestion)",
          passed: true,
          latencyMs,
          details: `Message ingested after ${attempt} sync attempt(s) (${Math.round(latencyMs / 1000)}s). Fetch/OAuth/DB-write path is alive.`
        };
      }
    } catch (err: any) {
      // Keep retrying — a single failed sync call mid-poll isn't fatal on its own.
      console.warn(`[canary] Tier A sync attempt ${attempt} errored: ${err.message || err}`);
    }
  }

  return {
    name: "Tier A (Gmail ingestion)",
    passed: false,
    latencyMs: Date.now() - start,
    details: `Message not seen in /api/gmail/sync after ${maxAttempts} attempts (~${Math.round((maxAttempts * delayMs) / 1000)}s). Check OAuth token validity and Gmail API quota.`
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function main() {
  const startedAt = new Date();
  console.log(`[canary] LedgerMail synthetic canary starting at ${startedAt.toISOString()}`);

  const fixture = buildCanaryFixture();
  console.log(`[canary] Run ID: ${fixture.runId}`);

  // Run Tier B first (fast, no wait) and Tier A concurrently — they're independent.
  const [tierB, tierA] = await Promise.all([runTierB(fixture), runTierA(fixture)]);

  const results = [tierB, tierA];
  console.log("\n[canary] Results:");
  for (const r of results) {
    const status = r.passed ? "PASS" : "FAIL";
    const latency = r.latencyMs !== null ? `${Math.round(r.latencyMs / 1000)}s` : "n/a";
    console.log(`  [${status}] ${r.name} (${latency})\n    ${r.details.replace(/\n/g, "\n    ")}`);
  }

  const failures = results.filter(r => !r.passed);
  if (failures.length > 0) {
    const message = [
      `:rotating_light: LedgerMail canary FAILED (run ${fixture.runId})`,
      ...failures.map(f => `• ${f.name}: ${f.details}`)
    ].join("\n");
    await sendAlert(message);
    console.error(`\n[canary] ${failures.length} tier(s) failed.`);
    process.exit(1);
  }

  console.log("\n[canary] All tiers passed.");
  process.exit(0);
}

main().catch(async err => {
  console.error("[canary] Unhandled error:", err);
  await sendAlert(`:rotating_light: LedgerMail canary crashed: ${err.message || err}`);
  process.exit(1);
});
