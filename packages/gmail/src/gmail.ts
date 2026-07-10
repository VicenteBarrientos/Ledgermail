import { google } from "googleapis";
import { config, logger } from "@ledgermail/shared";
import { db } from "@ledgermail/database";
import { extractTextFromPdf } from "./pdf";

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    config.gmail.clientId,
    config.gmail.clientSecret,
    config.gmail.redirectUri
  );
}

export function getAuthUrl(state?: string): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email"
    ],
    prompt: "consent",
    state
  });
}

export interface GmailTokenResponse {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
}

export async function getTokensFromCode(code: string): Promise<GmailTokenResponse> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return {
    accessToken: tokens.access_token || "",
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expiry_date
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials.access_token || "";
}

function getEmailBody(payload: any): { html: string; text: string } {
  let html = "";
  let text = "";

  if (!payload) return { html, text };

  if (payload.mimeType === "text/html" && payload.body?.data) {
    html = Buffer.from(payload.body.data, "base64").toString("utf-8");
  } else if (payload.mimeType === "text/plain" && payload.body?.data) {
    text = Buffer.from(payload.body.data, "base64").toString("utf-8");
  } else if (payload.parts) {
    for (const part of payload.parts) {
      const res = getEmailBody(part);
      html = html ? html + " " + res.html : res.html;
      text = text ? text + " " + res.text : res.text;
    }
  }

  return { html, text };
}

async function fetchAttachments(
  gmail: any,
  messageId: string,
  payload: any
): Promise<Array<{ filename: string; mimeType: string; data: Buffer }>> {
  const attachments: Array<{ filename: string; mimeType: string; data: Buffer }> = [];
  if (!payload || !payload.parts) return attachments;

  for (const part of payload.parts) {
    if (part.filename && part.body?.attachmentId) {
      try {
        const attachRes = await gmail.users.messages.attachments.get({
          userId: "me",
          messageId,
          id: part.body.attachmentId
        });
        
        if (attachRes.data?.data) {
          const dataBuffer = Buffer.from(attachRes.data.data, "base64");
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            data: dataBuffer
          });
        }
      } catch (err) {
        logger.error(`Failed to download attachment ${part.filename} for msg ${messageId}:`, err);
      }
    } else if (part.parts) {
      const nested = await fetchAttachments(gmail, messageId, part);
      attachments.push(...nested);
    }
  }

  return attachments;
}

export interface FetchedEmail {
  messageId: string;
  subject: string;
  from: string;
  receivedAt: Date;
  bodyHtml: string;
  hasAttachments: boolean;
  rawMime?: string;
}

export async function syncGmailMessages(
  mailboxSourceId: string,
  maxResults = 20
): Promise<FetchedEmail[]> {
  const mailbox = await db.mailboxSource.findUniqueOrThrow({
    where: { id: mailboxSourceId }
  });

  const credentials = mailbox.credentials as any;
  let accessToken = credentials.accessToken;
  const refreshToken = credentials.refreshToken;

  const oauth2Client = getOAuth2Client();
  
  // Refresh token if needed
  if (credentials.expiresAt && Date.now() > credentials.expiresAt) {
    logger.info(`Access token expired for mailbox ${mailbox.emailAddress}. Refreshing...`);
    try {
      accessToken = await refreshAccessToken(refreshToken);
      const expiresAt = Date.now() + 3500 * 1000;
      await db.mailboxSource.update({
        where: { id: mailboxSourceId },
        data: {
          credentials: {
            ...credentials,
            accessToken,
            expiresAt
          }
        }
      });
    } catch (err) {
      logger.error(`Failed to refresh token for mailbox ${mailbox.emailAddress}:`, err);
      throw new Error("Mailbox credentials invalid or expired");
    }
  }

  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Filter query to scan bank transfers ( Banco de Chile notifications )
  const query = "subject:(transferencia OR abono OR recibido OR recibida OR aviso)";
  
  const response = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults
  });

  const messages = response.data.messages || [];
  const fetchedEmails: FetchedEmail[] = [];

  for (const msg of messages) {
    if (!msg.id) continue;
    
    // Check if we've already imported this Gmail Message ID
    const exists = await db.email.findUnique({
      where: { messageId: msg.id }
    });
    if (exists) continue;

    try {
      const details = await gmail.users.messages.get({
        userId: "me",
        id: msg.id
      });

      const payload = details.data.payload;
      const headers = payload?.headers || [];
      
      const subject = headers.find(h => h.name?.toLowerCase() === "subject")?.value || "No Subject";
      const from = headers.find(h => h.name?.toLowerCase() === "from")?.value || "Unknown Sender";
      
      // Parse internal date or fallback to header Date
      const internalDateMs = details.data.internalDate ? parseInt(details.data.internalDate, 10) : Date.now();
      const receivedAt = new Date(internalDateMs);

      const bodyParsed = getEmailBody(payload);
      let bodyHtml = bodyParsed.html || `<div>${bodyParsed.text}</div>`;

      // Fetch and check PDF attachments
      const attachments = await fetchAttachments(gmail, msg.id, payload);
      const hasAttachments = attachments.length > 0;
      
      if (hasAttachments && config.flags.enablePdfExtraction) {
        logger.info(`Processing ${attachments.length} attachments for msg ${msg.id}...`);
        for (const attach of attachments) {
          if (attach.mimeType === "application/pdf" || attach.filename.toLowerCase().endsWith(".pdf")) {
            const pdfText = await extractTextFromPdf(attach.data);
            if (pdfText) {
              bodyHtml += `<div class="pdf-attachment" filename="${attach.filename}">\nPDF CONTENT:\n${pdfText}\n</div>`;
            }
          }
        }
      }

      // Fetch raw MIME message for EML preservation
      let rawMime: string | undefined;
      try {
        const rawRes = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "raw"
        });
        if (rawRes.data?.raw) {
          rawMime = Buffer.from(rawRes.data.raw, "base64url").toString("utf-8");
        }
      } catch (rawErr) {
        logger.error(`Failed to fetch raw MIME for message ${msg.id}:`, rawErr);
      }

      fetchedEmails.push({
        messageId: msg.id,
        subject,
        from,
        receivedAt,
        bodyHtml,
        hasAttachments,
        rawMime
      });
    } catch (err) {
      logger.error(`Failed to process message details for ID ${msg.id}:`, err);
    }
  }

  return fetchedEmails;
}
