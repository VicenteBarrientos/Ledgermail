import { config, logger } from "@ledgermail/shared";

export interface WebhookPayload {
  transactionId: string;
  emailId: string;
  bank: string;
  transactionType: string;
  amount: number;
  currency: string;
  senderName: string | null;
  senderAccount: string | null;
  receiverAccount: string | null;
  reference: string | null;
  description: string | null;
  confidence: number;
  receivedAt: Date;
  evidence: {
    html: string;
    emlUrl: string | null;
  };
}

/**
 * Dispatches a transaction webhook payload to CondoSync or any configured endpoint.
 * Runs asynchronously and catches all exceptions to prevent disrupting the parsing pipeline.
 */
export async function dispatchTransactionWebhook(transaction: any, email: any): Promise<void> {
  const webhookUrl = config.api.condosyncWebhookUrl;

  if (!webhookUrl) {
    logger.info(`Webhook skipped: CONDOSYNC_WEBHOOK_URL is not configured.`);
    return;
  }

  try {
    let apiBase = config.api.apiBaseUrl;
    if (!apiBase) {
      apiBase = `http://localhost:${config.api.port || 3001}`;
    }

    const emlUrl = email.emlPath ? `${apiBase.replace(/\/$/, "")}/api/emails/${email.id}/eml` : null;

    const payload: WebhookPayload = {
      transactionId: transaction.id,
      emailId: email.id,
      bank: transaction.bank,
      transactionType: transaction.transactionType,
      amount: transaction.amount,
      currency: transaction.currency,
      senderName: transaction.senderName || null,
      senderAccount: transaction.senderAccount || null,
      receiverAccount: transaction.receiverAccount || null,
      reference: transaction.reference || null,
      description: transaction.description || null,
      confidence: transaction.confidence,
      receivedAt: email.receivedAt,
      evidence: {
        html: email.cleanedHtml,
        emlUrl
      }
    };

    logger.info(`Dispatching webhook for transaction ${transaction.id} to ${webhookUrl}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "LedgerMail-Webhook-Dispatcher/1.0"
    };
    if (config.api.condosyncWebhookSecret) {
      headers["X-LedgerMail-Token"] = config.api.condosyncWebhookSecret;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      logger.info(`Webhook successfully delivered to ${webhookUrl}. Status: ${response.status}`);
    } else {
      logger.error(`Webhook delivery failed to ${webhookUrl}. Status: ${response.status} ${response.statusText}`);
    }
  } catch (error: any) {
    if (error.name === "AbortError") {
      logger.error(`Webhook delivery timed out after 10 seconds.`);
    } else {
      logger.error(`Failed to dispatch webhook to ${webhookUrl}: ${error.message || error}`);
    }
  }
}
