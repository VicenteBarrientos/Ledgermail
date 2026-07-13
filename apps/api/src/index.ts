import express from "express";
import cors from "cors";
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { config, logger } from "@ledgermail/shared";
import { db, EmailStatus } from "@ledgermail/database";
import { parseEmailPipeline } from "@ledgermail/core";
import {
  syncGmailMessages,
  getAuthUrl,
  getTokensFromCode,
  listGmailOverview
} from "@ledgermail/gmail";
import {
  getOutlookAuthUrl,
  getOutlookTokensFromCode,
  syncOutlookMessages,
  listOutlookOverview
} from "@ledgermail/outlook";

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

async function upsertMailboxFromOAuth(opts: {
  resolvedEmail: string;
  name: string;
  type: "GMAIL_OAUTH" | "OUTLOOK_OAUTH";
  credentials: {
    accessToken: string;
    refreshToken?: string | null;
    expiresAt?: number | null;
  };
}) {
  const user = await db.user.upsert({
    where: { email: opts.resolvedEmail },
    create: { email: opts.resolvedEmail },
    update: {}
  });

  const existing = await db.mailboxSource.findFirst({
    where: { emailAddress: opts.resolvedEmail, type: opts.type }
  });

  const credentials = {
    accessToken: opts.credentials.accessToken,
    refreshToken: opts.credentials.refreshToken,
    expiresAt: opts.credentials.expiresAt
  };

  const mailbox = existing
    ? await db.mailboxSource.update({
        where: { id: existing.id },
        data: {
          userId: user.id,
          name: opts.name || existing.name,
          credentials
        }
      })
    : await db.mailboxSource.create({
        data: {
          userId: user.id,
          name: opts.name,
          type: opts.type,
          emailAddress: opts.resolvedEmail,
          credentials
        }
      });

  return { user, mailbox, reconnected: Boolean(existing) };
}

// 3. Gmail OAuth
app.get("/api/gmail/auth-url", (req, res) => {
  try {
    const url = getAuthUrl("gmail");
    res.json({ url, provider: "gmail" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gmail/connect", async (req, res) => {
  try {
    const { code, name, emailAddress } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Missing code" });
    }

    const tokens = await getTokensFromCode(code);
    const resolvedEmail =
      tokens.email || emailAddress || "gmail-sync@ledgermail.com";

    const { user, mailbox, reconnected } = await upsertMailboxFromOAuth({
      resolvedEmail,
      name: name || "Gmail Inbox",
      type: "GMAIL_OAUTH",
      credentials: tokens
    });

    res.json({
      success: true,
      mailboxId: mailbox.id,
      emailAddress: resolvedEmail,
      userId: user.id,
      provider: "gmail",
      reconnected
    });
  } catch (error: any) {
    logger.error("API error connecting Gmail mailbox:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3b. Outlook / Hotmail / M365 OAuth (Microsoft Graph)
app.get("/api/outlook/auth-url", (req, res) => {
  try {
    const url = getOutlookAuthUrl("outlook");
    res.json({ url, provider: "outlook" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/outlook/connect", async (req, res) => {
  try {
    const { code, name, emailAddress } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Missing code" });
    }

    const tokens = await getOutlookTokensFromCode(code);
    const resolvedEmail =
      tokens.email || emailAddress || "outlook-sync@ledgermail.com";

    const { user, mailbox, reconnected } = await upsertMailboxFromOAuth({
      resolvedEmail,
      name: name || "Outlook / Hotmail",
      type: "OUTLOOK_OAUTH",
      credentials: tokens
    });

    res.json({
      success: true,
      mailboxId: mailbox.id,
      emailAddress: resolvedEmail,
      userId: user.id,
      provider: "outlook",
      reconnected
    });
  } catch (error: any) {
    logger.error("API error connecting Outlook mailbox:", error);
    res.status(500).json({ error: error.message });
  }
});

// Read-only overview (Gmail or Outlook)
app.get("/api/gmail/overview", async (req, res) => {
  try {
    const mailboxSourceId = String(req.query.mailboxSourceId || "");
    const maxResults = Math.min(
      parseInt(String(req.query.maxResults || "50"), 10) || 50,
      100
    );
    const query = req.query.q ? String(req.query.q) : undefined;
    if (!mailboxSourceId) {
      return res.status(400).json({ error: "Missing mailboxSourceId" });
    }
    const overview = await listGmailOverview(mailboxSourceId, {
      maxResults,
      query
    });
    res.json(overview);
  } catch (error: any) {
    logger.error("API error gmail overview:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/outlook/overview", async (req, res) => {
  try {
    const mailboxSourceId = String(req.query.mailboxSourceId || "");
    const maxResults = Math.min(
      parseInt(String(req.query.maxResults || "50"), 10) || 50,
      100
    );
    if (!mailboxSourceId) {
      return res.status(400).json({ error: "Missing mailboxSourceId" });
    }
    const overview = await listOutlookOverview(mailboxSourceId, { maxResults });
    res.json(overview);
  } catch (error: any) {
    logger.error("API error outlook overview:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Sync — dispatches by mailbox type (Gmail or Outlook)
app.post("/api/gmail/sync", async (req, res) => {
  try {
    const { mailboxSourceId, maxResults = 10 } = req.body;
    if (!mailboxSourceId) {
      return res.status(400).json({ error: "Missing mailboxSourceId" });
    }

    const mailbox = await db.mailboxSource.findUnique({
      where: { id: mailboxSourceId }
    });
    if (!mailbox) {
      return res.status(404).json({ error: "Mailbox not found" });
    }

    const messages =
      mailbox.type === "OUTLOOK_OAUTH"
        ? await syncOutlookMessages(mailboxSourceId, maxResults)
        : await syncGmailMessages(mailboxSourceId, maxResults);
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

// 6.5. GET /api/emails/:id/eml - Download raw EML file for evidence/auditing
app.get("/api/emails/:id/eml", async (req, res) => {
  try {
    const emailRecord = await db.email.findUnique({
      where: { id: req.params.id }
    });

    if (!emailRecord) {
      return res.status(404).json({ error: "Email record not found" });
    }

    if (!emailRecord.emlPath) {
      return res.status(404).json({ error: "EML evidence file not found for this email" });
    }

    if (!fs.existsSync(emailRecord.emlPath)) {
      return res.status(410).json({ error: "EML file is missing from storage" });
    }

    res.setHeader("Content-Type", "message/rfc822");
    res.download(emailRecord.emlPath, `${emailRecord.id}.eml`);
  } catch (error: any) {
    logger.error(`API error downloading EML for email ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 7. POST /api/chat - Support chatbot using Anthropic Claude
const MAX_MENSAJES = 12;
const MAX_LARGO_MENSAJE = 2000;

const CHATBOT_SYSTEM_PROMPT = `Eres el asistente de ayuda de LedgerMail, una plataforma inteligente y automatizada para conectar, sincronizar y procesar notificaciones bancarias de transferencias usando IA. Tu única función es enseñar a usar la app, explicar sus características y responder dudas técnicas sobre cómo funciona. Respondes siempre en español de Chile, con un tono cercano, breve, amigable y directo — nada de respuestas largas tipo manual aburrido.

No tienes acceso a los datos reales de las transacciones ni casillas del usuario en vivo a través de esta conversación (no inventes números de cuentas ni montos reales). Si te preguntan algo sobre sus datos específicos, diles que los revisen en la tabla de transacciones de la consola o en su base de datos.

## Guía técnica de la app (cómo funciona)

**1. Sincronización y Casillas (Mailboxes)**
- "Conectar Gmail": Usa OAuth de Google para mapear e importar correos automáticamente. Debes presionar el botón "Conectar Gmail" en la esquina superior derecha para iniciar el flujo de autenticación.
- Una vez conectada una casilla, aparece en la barra superior. Se pueden añadir múltiples casillas por usuario.
- Botón "Sincronizar": Trae los últimos correos de la casilla Gmail configurada de forma manual y ejecuta el pipeline de análisis.

**2. Detección de Bancos (Fingerprints)**
- LedgerMail detecta el banco de cada correo usando un modelo de puntuación ponderada (matching de dominios, asunto, estructura HTML, firmas legales y logos).
- Bancos configurados estructuralmente (6 en total): Banco de Chile, Santander, BancoEstado, BCI, Scotiabank e Itaú.
- **IMPORTANTE**: Por directiva de calidad del MVP, solo **Banco de Chile** está completamente implementado y afinado a más del 99% de precisión. Los otros 5 bancos tienen "esqueletos" iniciales definidos en \`packages/providers/src/skeletons.ts\` listos para desarrollo futuro.

**3. Pipeline de Análisis (IA y Sanitización)**
- Cuando entra un correo, pasa por un sanitizador agresivo (\`packages/core/src/sanitizer.ts\`) que remueve estilos CSS, scripts, tags irrelevantes y firmas de confidencialidad para ahorrar hasta un 70% de tokens del LLM y reducir latencia.
- Luego, se invoca al LLM configurado enviando el HTML limpio. El LLM mapea los datos a un JSON estructurado según un esquema Zod (\`packages/validation\`).
- Los proveedores de LLM soportados son: OpenAI (\`gpt-4o-mini\` por defecto, \`gpt-4o\`), Gemini (\`gemini-1.5-flash\`, \`gemini-1.5-pro\`) y Anthropic Claude (\`claude-3-5-sonnet\`, \`claude-3-5-haiku\`).

**4. Score de Confianza (Confidence)**
- No le pedimos al LLM que se autoevalúe. Calculamos un score determinista basado en reglas de negocio (si el monto es un número válido, si se extrajo remitente, si la cuenta origen y referencia están presentes, etc.). Un score de 1.0 es excelente; menor a 0.9 podría requerir revisión manual en la consola (estado "NEEDS_REVIEW").

**5. Consola Web (Apps/Dashboard)**
- La pantalla principal muestra la lista de correos y transacciones a la izquierda con su estado: "Analizado" (PARSED), "Revisar" (NEEDS_REVIEW) o "Fallido" (FAILED).
- Al seleccionar una fila, a la derecha se puede inspeccionar:
  - Pestaña "Campos": Los datos JSON extraídos (monto, remitente, cuenta, etc.).
  - Pestaña "JSON": Estructura JSON pura.
  - Pestaña "HTML": El correo HTML sanitizado enviado al LLM.
  - Pestaña "Registros": Los intentos previos detallando latencia, tokens y costo en USD.
  - Pestaña "Reprocesar" (Replay Mode): Permite forzar el re-análisis del correo usando un LLM o modelo alternativo en tiempo real para comparar precisión o costos.

**6. Parser de Prueba (Test Parser)**
- El botón "Probar Parser manual" permite abrir un formulario donde puedes pegar a mano el remitente, asunto y HTML de un correo para validar el comportamiento del motor de extracción al instante.

## Reglas de respuesta:
- Sé breve: 2-4 frases o una lista corta de pasos. No respondas con bloques gigantes de texto.
- Usa emoticones con moderación pero que le den cercanía chilena (ej. "¡Buena!", "¡Hola! 👋", "altiro").
- Si la pregunta no tiene relación con LedgerMail o finanzas/tecnología del proyecto, desvía la pregunta amistosamente y sugiéreles preguntar sobre LedgerMail.
- Si no sabes algo, dilo abiertamente (ej. "Esa funcionalidad no la tengo mapeada aún en LedgerMail, ¡pero buena idea!").`;

app.post("/api/chat", async (req, res) => {
  try {
    const apiKey = config.llm.anthropicApiKey;
    if (!apiKey || apiKey === "your-anthropic-api-key-here") {
      return res.status(503).json({ error: "El chat de ayuda no está configurado (falta ANTHROPIC_API_KEY)." });
    }

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Mensaje inválido." });
    }

    // Validar y truncar mensajes
    const validatedMessages = [];
    for (const m of messages.slice(-MAX_MENSAJES)) {
      if (!m || typeof m !== "object") {
        return res.status(400).json({ error: "Mensaje inválido." });
      }
      const { role, content } = m;
      if (role !== "user" && role !== "assistant") {
        return res.status(400).json({ error: "Rol de mensaje inválido." });
      }
      if (typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ error: "Contenido de mensaje vacío." });
      }
      validatedMessages.push({
        role,
        content: content.slice(0, MAX_LARGO_MENSAJE)
      });
    }

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: CHATBOT_SYSTEM_PROMPT,
      messages: validatedMessages as any,
    });

    const replyText = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");

    res.json({ reply: replyText || "No pude generar una respuesta. Intenta de nuevo." });
  } catch (error: any) {
    logger.error("Error en chatbot API:", error);
    res.status(502).json({ error: "El chat de ayuda no está disponible en este momento." });
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
