"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionJsonSchema = void 0;
exports.computeSHA256 = computeSHA256;
exports.loadPrompt = loadPrompt;
exports.parseEmailPipeline = parseEmailPipeline;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const shared_1 = require("@ledgermail/shared");
const database_1 = require("@ledgermail/database");
const validation_1 = require("@ledgermail/validation");
const llm_1 = require("@ledgermail/llm");
const providers_1 = require("@ledgermail/providers");
const sanitizer_1 = require("./sanitizer");
const normalizer_1 = require("./normalizer");
const confidence_1 = require("./confidence");
exports.TransactionJsonSchema = {
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
function computeSHA256(text) {
    return crypto_1.default.createHash("sha256").update(text).digest("hex");
}
function loadPrompt(bankName, version) {
    const slug = bankName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const possiblePaths = [
        path_1.default.join(__dirname, "..", "prompts", slug, `${version}.md`),
        path_1.default.join(__dirname, "prompts", slug, `${version}.md`),
        path_1.default.join(process.cwd(), "packages", "core", "prompts", slug, `${version}.md`),
        path_1.default.join(process.cwd(), "prompts", slug, `${version}.md`),
    ];
    for (const p of possiblePaths) {
        if (fs_1.default.existsSync(p)) {
            return fs_1.default.readFileSync(p, "utf-8");
        }
    }
    shared_1.logger.warn(`Prompt template not found for ${bankName} (${version}). Using fallback default.`);
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
async function parseEmailPipeline(input, forceReparse = false) {
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
    const provider = (0, providers_1.detectProvider)(emailPayload);
    if (!provider) {
        shared_1.logger.warn(`No bank provider matched for email: "${input.subject}" from "${input.from}"`);
        // If no provider matched, save email with FAILED status
        if (messageId) {
            const cleaned = (0, sanitizer_1.sanitizeHtmlForLLM)(input.bodyHtml);
            const hash = computeSHA256(cleaned);
            await database_1.db.email.upsert({
                where: { hash },
                update: { status: database_1.EmailStatus.FAILED, errorMessage: "No bank provider detected" },
                create: {
                    mailboxSourceId: input.mailboxSourceId,
                    messageId,
                    subject: input.subject,
                    receivedAt: new Date(),
                    cleanedHtml: cleaned,
                    hash,
                    status: database_1.EmailStatus.FAILED,
                    errorMessage: "No bank provider detected"
                }
            });
        }
        return { success: false, error: "No bank provider detected" };
    }
    // 2. Clean HTML
    const cleanedHtml = provider.cleanHtml((0, sanitizer_1.sanitizeHtmlForLLM)(input.bodyHtml));
    const hash = computeSHA256(cleanedHtml);
    // 3. Cache check (skip if forceReparse = true or feature flag config.flags.enableCache = false)
    if (shared_1.config.flags.enableCache && !forceReparse) {
        const cachedEmail = await database_1.db.email.findUnique({
            where: { hash },
            include: { transactions: true }
        });
        if (cachedEmail && cachedEmail.status === database_1.EmailStatus.PARSED && cachedEmail.transactions.length > 0) {
            shared_1.logger.info(`Cache hit for email hash: ${hash}. Reusing cached transaction(s).`);
            return { success: true, cached: true, transactions: cachedEmail.transactions };
        }
    }
    // Ensure Email record exists in PENDING state
    const emailRecord = await database_1.db.email.upsert({
        where: { hash },
        update: {},
        create: {
            mailboxSourceId: input.mailboxSourceId,
            messageId,
            subject: input.subject,
            receivedAt: new Date(),
            cleanedHtml,
            hash,
            status: database_1.EmailStatus.PENDING,
            hasAttachments
        }
    });
    // 4. Setup Prompt
    const promptVersion = `${provider.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/v1`;
    const baseSystemPrompt = loadPrompt(provider.name, "v1");
    const bankInstructions = provider.getPromptInstructions();
    const systemPrompt = `${baseSystemPrompt}\n\n${bankInstructions}`;
    const userPrompt = `EMAIL CONTENT:\n${cleanedHtml}`;
    const llmProviderName = shared_1.config.flags.defaultLlmProvider;
    const llmModelName = shared_1.config.flags.defaultModelName;
    const llm = (0, llm_1.getLLMProvider)(llmProviderName);
    let success = false;
    let validationErrors = null;
    let parsedData = null;
    let llmResponseText = "";
    let promptTokens = 0;
    let completionTokens = 0;
    const startTime = Date.now();
    try {
        // 5. Call LLM (Try 1)
        shared_1.logger.info(`Calling LLM ${llmProviderName} (${llmModelName}) for email parsing...`);
        const response = await llm.parse({
            systemPrompt,
            userPrompt,
            jsonSchema: exports.TransactionJsonSchema
        }, llmModelName);
        llmResponseText = response.rawText;
        parsedData = response.parsedJson;
        promptTokens = response.usage.promptTokens;
        completionTokens = response.usage.completionTokens;
        if (parsedData) {
            // 6. Normalize
            const normalized = (0, normalizer_1.normalizeLLMOutput)(parsedData);
            // 7. Validate
            const validation = validation_1.TransactionValidationSchema.safeParse({
                bank: provider.name,
                ...normalized
            });
            if (validation.success) {
                success = true;
                parsedData = { bank: provider.name, ...normalized };
            }
            else {
                validationErrors = JSON.stringify(validation.error.format());
                shared_1.logger.warn(`Validation failed on try 1: ${validationErrors}`);
            }
        }
        else {
            validationErrors = "LLM returned null or invalid JSON structure";
        }
    }
    catch (error) {
        validationErrors = error.message || String(error);
        shared_1.logger.error(`LLM Call Try 1 failed: ${validationErrors}`);
    }
    // 8. Retry Logic (Try 2)
    if (!success && shared_1.config.flags.enableRetry) {
        shared_1.logger.info(`Retrying parsing for email hash: ${hash} with error context...`);
        const retryUserPrompt = `${userPrompt}\n\nPrevious attempt returned:\n${llmResponseText}\n\nWhich failed validation with errors:\n${validationErrors}\n\nPlease correct the values and output conforming strictly to the schema.`;
        try {
            const response = await llm.parse({
                systemPrompt,
                userPrompt: retryUserPrompt,
                jsonSchema: exports.TransactionJsonSchema
            }, llmModelName);
            llmResponseText = response.rawText;
            parsedData = response.parsedJson;
            promptTokens += response.usage.promptTokens;
            completionTokens += response.usage.completionTokens;
            if (parsedData) {
                const normalized = (0, normalizer_1.normalizeLLMOutput)(parsedData);
                const validation = validation_1.TransactionValidationSchema.safeParse({
                    bank: provider.name,
                    ...normalized
                });
                if (validation.success) {
                    success = true;
                    parsedData = { bank: provider.name, ...normalized };
                    validationErrors = null;
                }
                else {
                    validationErrors = JSON.stringify(validation.error.format());
                    shared_1.logger.warn(`Validation failed on retry: ${validationErrors}`);
                }
            }
            else {
                validationErrors = "LLM retry returned null or invalid JSON structure";
            }
        }
        catch (error) {
            validationErrors = (validationErrors ? `${validationErrors}; ` : "") + (error.message || String(error));
            shared_1.logger.error(`LLM Call Retry failed: ${error.message}`);
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
    await database_1.db.parseAttempt.create({
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
        const confidence = (0, confidence_1.calculateConfidence)(emailPayload, true, parsedData, true);
        // Delete existing transactions for this email (in case of reparse)
        await database_1.db.transaction.deleteMany({
            where: { emailId: emailRecord.id }
        });
        const txn = await database_1.db.transaction.create({
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
        await database_1.db.email.update({
            where: { id: emailRecord.id },
            data: { status: database_1.EmailStatus.PARSED, errorMessage: null }
        });
        return { success: true, email: emailRecord, transactions: [txn] };
    }
    else {
        // Parsing failed or needs review
        await database_1.db.email.update({
            where: { id: emailRecord.id },
            data: {
                status: database_1.EmailStatus.NEEDS_REVIEW,
                errorMessage: validationErrors || "Parsing validation failed"
            }
        });
        // Create a transaction structure if we managed to extract amount/currency, but mark it with lower confidence
        let partialTxn = null;
        if (parsedData && parsedData.amount) {
            const confidence = (0, confidence_1.calculateConfidence)(emailPayload, true, parsedData, false);
            await database_1.db.transaction.deleteMany({
                where: { emailId: emailRecord.id }
            });
            partialTxn = await database_1.db.transaction.create({
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
//# sourceMappingURL=parser.js.map