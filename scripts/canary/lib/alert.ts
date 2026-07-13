/**
 * Fires a Slack-style incoming-webhook alert on canary failure. No-op if
 * CANARY_ALERT_WEBHOOK_URL isn't configured, so this is safe to call
 * unconditionally from the runner.
 */
export async function sendAlert(message: string): Promise<void> {
  const url = process.env.CANARY_ALERT_WEBHOOK_URL;
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message })
    });
  } catch (err) {
    console.error("[canary] Failed to send alert webhook:", err);
  }
}
