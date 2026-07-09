import fs from "fs";
import path from "path";
import crypto from "crypto";
import { config, logger } from "@ledgermail/shared";
import { db, EmailStatus } from "@ledgermail/database";
import { TransactionValidationSchema } from "@ledgermail/validation";
import { getLLMProvider } from "@ledgermail/llm";
import { detectProvider } from "@ledgermail/providers";
import { sanitizeHtmlForLLM } from "./sanitizer";
import { normalizeLLMOutput } from "./normalizer";
import { calculateConfidence } from "./confidence";

export const TransactionJsonSchema = {
  type: "object",
  properties: {
    transactionType: { type: "string", description: "The type of transaction, e.g., transfer_received" },
    amount: { type: "number", description: "The amount transferred. Must be a clean number (no currency signs or thousands separators)" },
    currency: { type: "string", description: "Three-letter currency code (e.g. CLP, USD)" },
    senderName: { type: ["string", "null"], description: "Full name of the person or entity who sent the transfer" },
    senderAccount: { type: ["string", "null"], description: "Account number of the sender" },
    receiverAccount: { type: ["string", "null"], description: "Account number of the receiver" },
    reference: { type: ["string", "null"], description: "Transfer reference number or transaction ID" },
    description: { type: ["string", "null"], description: "Transfer description, reason or comment" }
  },
  required: [
    "transactionType",
    "amount",
    "currency",
    "senderName",
    "senderAccount",
    "receiverAccount",
    "reference",
    "description"
  ],
  additionalProperties: false
};

export function computeSHA256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function loadPrompt(bankName: string, version: string): string {
  const slug = bankName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const possiblePaths = [
    path.join(__dirname, "..", "prompts", slug, `${version}.md`),
    path.join(__dirname, "prompts", slug, `${version}.md`),
    path.join(process.cwd(), "packages", "core", "prompts", slug, `${version}.md`),
    path.join(process.cwd(), "prompts", slug, `${version}.md`),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, "utf-8");
    }
  }

  logger.warn(`Prompt template not found for ${bankName} (${version}). Using fallback default.`);
  return `You are an expert financial ledger AI. Analyze the email content and extract transaction details.
Fields to extract:
- transactionType: "transfer_received" if a transfer was deposited.
- amount: number
- currency: 3-letter code (e.g., CLP, USD)
- senderName: string or null
- senderAccount: string or null
- receiverAccount: string or null
- reference: string or null
- description: string or null`;
}

export interface ParseInput {
  mailboxSourceId: string;
  messageId?: string;
  from: string;
  subject: string;
  bodyHtml: string;
  headers?: Record<string, string>;
  hasAttachments?: boolean;
}

export async function parseEmailPipeline(input: ParseInput, forceReparse = false): Promise<any> {
  const headers = input.headers || {};
  const messageId = input.messageId || null;
  const hasAttachments = input.hasAttachments || false;
  
  // 1. Detect provider
  const emailPayload = {
    from: input.from,
    subject: input.subject,
    bodyHtml: input.bodyHtml,
    headers
  };
  
  const provider = detectProvider(emailPayload);
  if (!provider) {
    logger.warn(`No bank provider matched for email: "${input.subject}" from "${input.from}"`);
    // If no provider matched, save email with FAILED status
    if (messageId) {
      const cleaned = sanitizeHtmlForLLM(input.bodyHtml);
      const hash = computeSHA256(cleaned);
      await db.email.upsert({
        where: { hash },
        update: { status: EmailStatus.FAILED, errorMessage: "No bank provider detected" },
        create: {
          mailboxSourceId: input.mailboxSourceId,
          messageId,
          subject: input.subject,
          receivedAt: new Date(),
          cleanedHtml: cleaned,
          hash,
          status: EmailStatus.FAILED,
          errorMessage: "No bank provider detected"
        }
      });
    }
    return { success: false, error: "No bank provider detected" };
  }

  // 2. Clean HTML
  const cleanedHtml = provider.cleanHtml(sanitizeHtmlForLLM(input.bodyHtml));
  const hash = computeSHA256(cleanedHtml);

  // 3. Cache check (skip if forceReparse = true or feature flag config.flags.enableCache = false)
  if (config.flags.enableCache && !forceReparse) {
    const cachedEmail = await db.email.findUnique({
      where: { hash },
      include: { transactions: true }
    });

    if (cachedEmail && cachedEmail.status === EmailStatus.PARSED && cachedEmail.transactions.length > 0) {
      logger.info(`Cache hit for email hash: ${hash}. Reusing cached transaction(s).`);
      return { success: true, cached: true, transactions: cachedEmail.transactions };
    }
  }

  // Ensure Email record exists in PENDING state
  const emailRecord = await db.email.upsert({
    where: { hash },
    update: {},
    create: {
      mailboxSourceId: input.mailboxSourceId,
      messageId,
      subject: input.subject,
      receivedAt: new Date(),
      cleanedHtml,
      hash,
      status: EmailStatus.PENDING,
      hasAttachments
    }
  });

  // 4. Setup Prompt
  const promptVersion = `${provider.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/v1`;
  const baseSystemPrompt = loadPrompt(provider.name, "v1");
  const bankInstructions = provider.getPromptInstructions();
  const systemPrompt = `${baseSystemPrompt}\n\n${bankInstructions}`;
  const userPrompt = `EMAIL CONTENT:\n${cleanedHtml}`;

  const llmProviderName = config.flags.defaultLlmProvider;
  const llmModelName = config.flags.defaultModelName;
  const llm = getLLMProvider(llmProviderName);

  let success = false;
  let validationErrors: string | null = null;
  let parsedData: any = null;
  let llmResponseText = "";
  let promptTokens = 0;
  let completionTokens = 0;
  
  const startTime = Date.now();
  
  try {
    // 5. Call LLM (Try 1)
    logger.info(`Calling LLM ${llmProviderName} (${llmModelName}) for email parsing...`);
    const response = await llm.parse({
      systemPrompt,
      userPrompt,
      jsonSchema: TransactionJsonSchema
    }, llmModelName);

    llmResponseText = response.rawText;
    parsedData = response.parsedJson;
    promptTokens = response.usage.promptTokens;
    completionTokens = response.usage.completionTokens;

    if (parsedData) {
      // 6. Normalize
      const normalized = normalizeLLMOutput(parsedData);
      
      // 7. Validate
      const validation = TransactionValidationSchema.safeParse({
        bank: provider.name,
        ...normalized
      });

      if (validation.success) {
        success = true;
        parsedData = { bank: provider.name, ...normalized };
      } else {
        validationErrors = JSON.stringify(validation.error.format());
        logger.warn(`Validation failed on try 1: ${validationErrors}`);
      }
    } else {
      validationErrors = "LLM returned null or invalid JSON structure";
    }
  } catch (error: any) {
    validationErrors = error.message || String(error);
    logger.error(`LLM Call Try 1 failed: ${validationErrors}`);
  }

  // 8. Retry Logic (Try 2)
  if (!success && config.flags.enableRetry) {
    logger.info(`Retrying parsing for email hash: ${hash} with error context...`);
    const retryUserPrompt = `${userPrompt}\n\nPrevious attempt returned:\n${llmResponseText}\n\nWhich failed validation with errors:\n${validationErrors}\n\nPlease correct the values and output conforming strictly to the schema.`;
    
    try {
      const response = await llm.parse({
        systemPrompt,
        userPrompt: retryUserPrompt,
        jsonSchema: TransactionJsonSchema
      }, llmModelName);

      llmResponseText = response.rawText;
      parsedData = response.parsedJson;
      promptTokens += response.usage.promptTokens;
      completionTokens += response.usage.completionTokens;

      if (parsedData) {
        const normalized = normalizeLLMOutput(parsedData);
        const validation = TransactionValidationSchema.safeParse({
          bank: provider.name,
          ...normalized
        });

        if (validation.success) {
          success = true;
          parsedData = { bank: provider.name, ...normalized };
          validationErrors = null;
        } else {
          validationErrors = JSON.stringify(validation.error.format());
          logger.warn(`Validation failed on retry: ${validationErrors}`);
        }
      } else {
        validationErrors = "LLM retry returned null or invalid JSON structure";
      }
    } catch (error: any) {
      validationErrors = (validationErrors ? `${validationErrors}; ` : "") + (error.message || String(error));
      logger.error(`LLM Call Retry failed: ${error.message}`);
    }
  }

  const latencyInMs = Date.now() - startTime;
  
  // Calculate pricing estimates based on token counts
  // Standard pricing mini: input $0.15/M tokens, output $0.60/M tokens.
  const costInUSD = (promptTokens * 0.00000015) + (completionTokens * 0.0000006);

  // Field validation flags for benchmarks
  const amountValid = success || (parsedData && typeof parsedData.amount === "number" && parsedData.amount > 0);
  const dateValid = success || !!parsedData; // email date itself is valid
  const senderNameValid = success || (parsedData && parsedData.senderName && parsedData.senderName.length > 2);
  const senderAccountValid = success || (parsedData && parsedData.senderAccount && parsedData.senderAccount.length > 3);
  const receiverAccountValid = success || (parsedData && parsedData.receiverAccount && parsedData.receiverAccount.length > 3);
  const referenceValid = success || (parsedData && parsedData.reference && parsedData.reference.length > 2);

  // 9. Save parsing attempt log
  await db.parseAttempt.create({
    data: {
      emailId: emailRecord.id,
      llmProvider: llmProviderName,
      modelName: llmModelName,
      promptVersion,
      prompt: systemPrompt + "\n\n" + userPrompt,
      rawResponse: llmResponseText,
      success,
      promptTokens,
      completionTokens,
      costInUSD,
      latencyInMs,
      amountValid,
      dateValid,
      senderNameValid,
      senderAccountValid,
      receiverAccountValid,
      referenceValid,
      validationErrors
    }
  });

  // 10. Update Email and Transaction states
  if (success && parsedData) {
    const confidence = calculateConfidence(
      emailPayload,
      true,
      parsedData,
      true
    );

    // Delete existing transactions for this email (in case of reparse)
    await db.transaction.deleteMany({
      where: { emailId: emailRecord.id }
    });

    const txn = await db.transaction.create({
      data: {
        emailId: emailRecord.id,
        bank: provider.name,
        amount: parsedData.amount,
        currency: parsedData.currency,
        senderName: parsedData.senderName,
        senderAccount: parsedData.senderAccount,
        receiverAccount: parsedData.receiverAccount,
        reference: parsedData.reference,
        description: parsedData.description,
        confidence
      }
    });

    await db.email.update({
      where: { id: emailRecord.id },
      data: { status: EmailStatus.PARSED, errorMessage: null }
    });

    return { success: true, email: emailRecord, transactions: [txn] };
  } else {
    // Parsing failed or needs review
    await db.email.update({
      where: { id: emailRecord.id },
      data: {
        status: EmailStatus.NEEDS_REVIEW,
        errorMessage: validationErrors || "Parsing validation failed"
      }
    });

    // Create a transaction structure if we managed to extract amount/currency, but mark it with lower confidence
    let partialTxn = null;
    if (parsedData && parsedData.amount) {
      const confidence = calculateConfidence(
        emailPayload,
        true,
        parsedData,
        false
      );

      await db.transaction.deleteMany({
        where: { emailId: emailRecord.id }
      });

      partialTxn = await db.transaction.create({
        data: {
          emailId: emailRecord.id,
          bank: provider.name,
          amount: parsedData.amount || 0,
          currency: parsedData.currency || "CLP",
          senderName: parsedData.senderName,
          senderAccount: parsedData.senderAccount,
          receiverAccount: parsedData.receiverAccount,
          reference: parsedData.reference,
          description: parsedData.description,
          confidence
        }
      });
    }

    return {
      success: false,
      email: emailRecord,
      transaction: partialTxn,
      error: validationErrors || "Parsing validation failed"
    };
  }
}
