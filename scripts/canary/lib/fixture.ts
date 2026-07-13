import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Builds a unique-per-run copy of the Banco de Chile fixture email.
 *
 * We reuse the real fixture HTML (already known to pass the Banco de Chile
 * fingerprint detector and to parse cleanly) instead of hand-rolling a new
 * template, so the canary exercises the exact same code path as the
 * regression suite. Only the folio (reference) and amount are swapped for
 * unique values per run so:
 *   - repeated runs don't collide with LedgerMail's content-hash cache
 *     (packages/core/src/parser.ts dedupes by SHA-256 of the cleaned HTML),
 *   - we can unambiguously find *this* run's transaction afterwards.
 */

export interface CanaryFixture {
  runId: string;
  html: string;
  subject: string;
  expected: {
    bank: string;
    amount: number;
    currency: string;
    senderName: string;
    senderAccount: string;
    receiverAccount: string;
    reference: string;
    description: string;
  };
}

function formatClp(amount: number): string {
  // Chilean peso formatting: dot as thousands separator, no decimals.
  return "$ " + amount.toLocaleString("es-CL").replace(/,/g, ".");
}

export function buildCanaryFixture(): CanaryFixture {
  const fixturePath = path.resolve(__dirname, "../../../fixtures/banco-chile/transfer_01.html");
  const rawHtml = fs.readFileSync(fixturePath, "utf-8");

  const runId = `${Date.now()}${crypto.randomBytes(2).toString("hex")}`; // e.g. 1752419200000a1b2
  const uniqueReference = runId;
  const uniqueAmount = 100000 + (Date.now() % 90000); // varies per run, stays a realistic CLP amount

  const html = rawHtml
    .replace("987654321", uniqueReference)
    .replace("$ 150.000", formatClp(uniqueAmount));

  return {
    runId,
    html,
    subject: `Aviso transferencia recibida — LedgerMail Canary ${runId}`,
    expected: {
      bank: "Banco de Chile",
      amount: uniqueAmount,
      currency: "CLP",
      senderName: "JUAN PEREZ GONZALEZ",
      senderAccount: "1234567890",
      receiverAccount: "9876543210",
      reference: uniqueReference,
      description: "Pago de arriendo julio"
    }
  };
}
