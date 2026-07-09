import express from "express";
import cors from "cors";
import { config, logger } from "@ledgermail/shared";
import { db, EmailStatus } from "@ledgermail/database";
import { parseEmailPipeline } from "@ledgermail/core";
import { syncGmailMessages, getAuthUrl, getTokensFromCode } from "@ledgermail/gmail";

const app = express();
app.use(cors());
app.use(express.json());

// 1. GET /api/payments - Paginated list of parsed payments with filtering
app.get("/api/payments", async (req, res) => {
  try {
    const {
      bank,
      status,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      page = "1",
      limit = "20"
    } = req.query;

    const p = parseInt(page as string, 10);
    const l = parseInt(limit as string, 10);
    const skip = (p - 1) * l;

    const whereClause: any = {};

    if (bank) {
      whereClause.bank = String(bank);
    }

    if (minAmount || maxAmount) {
      whereClause.amount = {};
      if (minAmount) whereClause.amount.gte = parseFloat(minAmount as string);
      if (maxAmount) whereClause.amount.lte = parseFloat(maxAmount as string);
    }

    const emailWhere: any = {};
    if (status) {
      emailWhere.status = status as any;
    }
    if (startDate || endDate) {
      emailWhere.receivedAt = {};
      if (startDate) emailWhere.receivedAt.gte = new Date(startDate as string);
      if (endDate) emailWhere.receivedAt.lte = new Date(endDate as string);
    }

    if (Object.keys(emailWhere).length > 0) {
      whereClause.email = emailWhere;
    }

    const [transactions, totalCount] = await Promise.all([
      db.transaction.findMany({
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
      db.transaction.count({ where: whereClause })
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
  } catch (error: any) {
    logger.error("API error fetching payments:", error);
    res.status(500).json({ error: error.message });
  }
});

// 2. GET /api/payments/:id - Detailed payment transaction with full email and attempts history
app.get("/api/payments/:id", async (req, res) => {
  try {
    const transaction = await db.transaction.findUnique({
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
  } catch (error: any) {
    logger.error(`API error fetching transaction ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 2.5. GET /api/mailboxes - List registered mailbox sources
app.get("/api/mailboxes", async (req, res) => {
  try {
    const mailboxes = await db.mailboxSource.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.json(mailboxes);
  } catch (error: any) {
    logger.error("API error fetching mailboxes:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. POST /api/gmail/connect - Initiates Gmail OAuth or accepts authorization code
app.get("/api/gmail/auth-url", (req, res) => {
  try {
    const url = getAuthUrl();
    res.json({ url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gmail/connect", async (req, res) => {
  try {
    const { code, userId, name, emailAddress } = req.body;
    if (!code || !userId) {
      return res.status(400).json({ error: "Missing code or userId" });
    }

    const tokens = await getTokensFromCode(code);
    
    // Save token as a MailboxSource
    const mailbox = await db.mailboxSource.create({
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
  } catch (error: any) {
    logger.error("API error connecting mailbox:", error);
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
    const messages = await syncGmailMessages(mailboxSourceId, maxResults);
    const results = [];
    let successCount = 0;
    let reviewCount = 0;
    let failCount = 0;

    for (const msg of messages) {
      const parseResult = await parseEmailPipeline({
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
      } else {
        if (parseResult.email?.status === EmailStatus.NEEDS_REVIEW) {
          reviewCount++;
        } else {
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
  } catch (error: any) {
    logger.error("API error syncing mailbox:", error);
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

    const result = await parseEmailPipeline({
      mailboxSourceId,
      from,
      subject,
      bodyHtml
    }, true); // forceReparse = true to bypass cache checks

    res.json(result);
  } catch (error: any) {
    logger.error("API error parsing email directly:", error);
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

    const emailRecord = await db.email.findUnique({ where: { id: emailId } });
    if (!emailRecord) {
      return res.status(404).json({ error: "Email record not found" });
    }

    // Apply temporary flag overrides to environment settings
    if (llmProvider) process.env.DEFAULT_LLM_PROVIDER = llmProvider;
    if (modelName) process.env.DEFAULT_MODEL_NAME = modelName;

    const result = await parseEmailPipeline({
      mailboxSourceId: emailRecord.mailboxSourceId,
      messageId: emailRecord.messageId || undefined,
      from: "bancochile-informa@bancochile.cl", // placeholder or extract from original headers if stored
      subject: emailRecord.subject,
      bodyHtml: emailRecord.cleanedHtml, // already sanitized
      hasAttachments: emailRecord.hasAttachments
    }, true); // forceReparse = true

    res.json(result);
  } catch (error: any) {
    logger.error("API error reparsing email:", error);
    res.status(500).json({ error: error.message });
  }
});

// Start service
const port = config.api.port;
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.listen(port, () => {
    logger.info(`LedgerMail REST API service running on port ${port}`);
  });
}

export default app;
