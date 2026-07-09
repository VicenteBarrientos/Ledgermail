"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const shared_1 = require("@ledgermail/shared");
const database_1 = require("@ledgermail/database");
const core_1 = require("@ledgermail/core");
const gmail_1 = require("@ledgermail/gmail");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// 1. GET /api/payments - Paginated list of parsed payments with filtering
app.get("/api/payments", async (req, res) => {
    try {
        const { bank, status, startDate, endDate, minAmount, maxAmount, page = "1", limit = "20" } = req.query;
        const p = parseInt(page, 10);
        const l = parseInt(limit, 10);
        const skip = (p - 1) * l;
        const whereClause = {};
        if (bank) {
            whereClause.bank = String(bank);
        }
        if (minAmount || maxAmount) {
            whereClause.amount = {};
            if (minAmount)
                whereClause.amount.gte = parseFloat(minAmount);
            if (maxAmount)
                whereClause.amount.lte = parseFloat(maxAmount);
        }
        const emailWhere = {};
        if (status) {
            emailWhere.status = status;
        }
        if (startDate || endDate) {
            emailWhere.receivedAt = {};
            if (startDate)
                emailWhere.receivedAt.gte = new Date(startDate);
            if (endDate)
                emailWhere.receivedAt.lte = new Date(endDate);
        }
        if (Object.keys(emailWhere).length > 0) {
            whereClause.email = emailWhere;
        }
        const [transactions, totalCount] = await Promise.all([
            database_1.db.transaction.findMany({
                where: whereClause,
                include: {
                    email: {
                        select: {
                            status: true,
                            receivedAt: true,
                            subject: true,
                            errorMessage: true
                        }
                    }
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: l
            }),
            database_1.db.transaction.count({ where: whereClause })
        ]);
        res.json({
            data: transactions,
            pagination: {
                page: p,
                limit: l,
                total: totalCount,
                totalPages: Math.ceil(totalCount / l)
            }
        });
    }
    catch (error) {
        shared_1.logger.error("API error fetching payments:", error);
        res.status(500).json({ error: error.message });
    }
});
// 2. GET /api/payments/:id - Detailed payment transaction with full email and attempts history
app.get("/api/payments/:id", async (req, res) => {
    try {
        const transaction = await database_1.db.transaction.findUnique({
            where: { id: req.params.id },
            include: {
                email: {
                    include: {
                        attempts: {
                            orderBy: { createdAt: "desc" }
                        }
                    }
                }
            }
        });
        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }
        res.json(transaction);
    }
    catch (error) {
        shared_1.logger.error(`API error fetching transaction ${req.params.id}:`, error);
        res.status(500).json({ error: error.message });
    }
});
// 3. POST /api/gmail/connect - Initiates Gmail OAuth or accepts authorization code
app.get("/api/gmail/auth-url", (req, res) => {
    try {
        const url = (0, gmail_1.getAuthUrl)();
        res.json({ url });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post("/api/gmail/connect", async (req, res) => {
    try {
        const { code, userId, name, emailAddress } = req.body;
        if (!code || !userId) {
            return res.status(400).json({ error: "Missing code or userId" });
        }
        const tokens = await (0, gmail_1.getTokensFromCode)(code);
        // Save token as a MailboxSource
        const mailbox = await database_1.db.mailboxSource.create({
            data: {
                userId,
                name: name || "Gmail Inbox",
                type: "GMAIL_OAUTH",
                emailAddress: emailAddress || "gmail-sync@ledgermail.com",
                credentials: {
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    expiresAt: tokens.expiresAt
                }
            }
        });
        res.json({ success: true, mailboxId: mailbox.id });
    }
    catch (error) {
        shared_1.logger.error("API error connecting mailbox:", error);
        res.status(500).json({ error: error.message });
    }
});
// 4. POST /api/gmail/sync - Manually trigger Gmail synchronization and parse pipeline
app.post("/api/gmail/sync", async (req, res) => {
    try {
        const { mailboxSourceId, maxResults = 10 } = req.body;
        if (!mailboxSourceId) {
            return res.status(400).json({ error: "Missing mailboxSourceId" });
        }
        // Pull messages from Gmail
        const messages = await (0, gmail_1.syncGmailMessages)(mailboxSourceId, maxResults);
        const results = [];
        let successCount = 0;
        let reviewCount = 0;
        let failCount = 0;
        for (const msg of messages) {
            const parseResult = await (0, core_1.parseEmailPipeline)({
                mailboxSourceId,
                messageId: msg.messageId,
                from: msg.from,
                subject: msg.subject,
                bodyHtml: msg.bodyHtml,
                hasAttachments: msg.hasAttachments
            });
            results.push({
                subject: msg.subject,
                success: parseResult.success,
                error: parseResult.error || null
            });
            if (parseResult.success) {
                successCount++;
            }
            else {
                if (parseResult.email?.status === database_1.EmailStatus.NEEDS_REVIEW) {
                    reviewCount++;
                }
                else {
                    failCount++;
                }
            }
        }
        res.json({
            success: true,
            summary: {
                synced: messages.length,
                parsedSuccessfully: successCount,
                needsReview: reviewCount,
                failed: failCount
            },
            details: results
        });
    }
    catch (error) {
        shared_1.logger.error("API error syncing mailbox:", error);
        res.status(500).json({ error: error.message });
    }
});
// 5. POST /api/parse - Direct manual parsing of email HTML body (cache check skipped)
app.post("/api/parse", async (req, res) => {
    try {
        const { from, subject, bodyHtml, mailboxSourceId } = req.body;
        if (!from || !subject || !bodyHtml || !mailboxSourceId) {
            return res.status(400).json({ error: "Missing required fields (from, subject, bodyHtml, mailboxSourceId)" });
        }
        const result = await (0, core_1.parseEmailPipeline)({
            mailboxSourceId,
            from,
            subject,
            bodyHtml
        }, true); // forceReparse = true to bypass cache checks
        res.json(result);
    }
    catch (error) {
        shared_1.logger.error("API error parsing email directly:", error);
        res.status(500).json({ error: error.message });
    }
});
// 6. POST /api/reparse - Force re-parse an existing email with model overrides (Replay Mode)
app.post("/api/reparse", async (req, res) => {
    try {
        const { emailId, llmProvider, modelName } = req.body;
        if (!emailId) {
            return res.status(400).json({ error: "Missing emailId" });
        }
        const emailRecord = await database_1.db.email.findUnique({ where: { id: emailId } });
        if (!emailRecord) {
            return res.status(404).json({ error: "Email record not found" });
        }
        // Apply temporary flag overrides to environment settings
        if (llmProvider)
            process.env.DEFAULT_LLM_PROVIDER = llmProvider;
        if (modelName)
            process.env.DEFAULT_MODEL_NAME = modelName;
        const result = await (0, core_1.parseEmailPipeline)({
            mailboxSourceId: emailRecord.mailboxSourceId,
            messageId: emailRecord.messageId || undefined,
            from: "bancochile-informa@bancochile.cl", // placeholder or extract from original headers if stored
            subject: emailRecord.subject,
            bodyHtml: emailRecord.cleanedHtml, // already sanitized
            hasAttachments: emailRecord.hasAttachments
        }, true); // forceReparse = true
        res.json(result);
    }
    catch (error) {
        shared_1.logger.error("API error reparsing email:", error);
        res.status(500).json({ error: error.message });
    }
});
// Start service
const port = shared_1.config.api.port;
app.listen(port, () => {
    shared_1.logger.info(`LedgerMail REST API service running on port ${port}`);
});
//# sourceMappingURL=index.js.map