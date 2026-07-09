"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOAuth2Client = getOAuth2Client;
exports.getAuthUrl = getAuthUrl;
exports.getTokensFromCode = getTokensFromCode;
exports.refreshAccessToken = refreshAccessToken;
exports.syncGmailMessages = syncGmailMessages;
const googleapis_1 = require("googleapis");
const shared_1 = require("@ledgermail/shared");
const database_1 = require("@ledgermail/database");
const pdf_1 = require("./pdf");
function getOAuth2Client() {
    return new googleapis_1.google.auth.OAuth2(shared_1.config.gmail.clientId, shared_1.config.gmail.clientSecret, shared_1.config.gmail.redirectUri);
}
function getAuthUrl(state) {
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
async function getTokensFromCode(code) {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    return {
        accessToken: tokens.access_token || "",
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expiry_date
    };
}
async function refreshAccessToken(refreshToken) {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials.access_token || "";
}
function getEmailBody(payload) {
    let html = "";
    let text = "";
    if (!payload)
        return { html, text };
    if (payload.mimeType === "text/html" && payload.body?.data) {
        html = Buffer.from(payload.body.data, "base64").toString("utf-8");
    }
    else if (payload.mimeType === "text/plain" && payload.body?.data) {
        text = Buffer.from(payload.body.data, "base64").toString("utf-8");
    }
    else if (payload.parts) {
        for (const part of payload.parts) {
            const res = getEmailBody(part);
            html = html ? html + " " + res.html : res.html;
            text = text ? text + " " + res.text : res.text;
        }
    }
    return { html, text };
}
async function fetchAttachments(gmail, messageId, payload) {
    const attachments = [];
    if (!payload || !payload.parts)
        return attachments;
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
            }
            catch (err) {
                shared_1.logger.error(`Failed to download attachment ${part.filename} for msg ${messageId}:`, err);
            }
        }
        else if (part.parts) {
            const nested = await fetchAttachments(gmail, messageId, part);
            attachments.push(...nested);
        }
    }
    return attachments;
}
async function syncGmailMessages(mailboxSourceId, maxResults = 20) {
    const mailbox = await database_1.db.mailboxSource.findUniqueOrThrow({
        where: { id: mailboxSourceId }
    });
    const credentials = mailbox.credentials;
    let accessToken = credentials.accessToken;
    const refreshToken = credentials.refreshToken;
    const oauth2Client = getOAuth2Client();
    // Refresh token if needed
    if (credentials.expiresAt && Date.now() > credentials.expiresAt) {
        shared_1.logger.info(`Access token expired for mailbox ${mailbox.emailAddress}. Refreshing...`);
        try {
            accessToken = await refreshAccessToken(refreshToken);
            const expiresAt = Date.now() + 3500 * 1000;
            await database_1.db.mailboxSource.update({
                where: { id: mailboxSourceId },
                data: {
                    credentials: {
                        ...credentials,
                        accessToken,
                        expiresAt
                    }
                }
            });
        }
        catch (err) {
            shared_1.logger.error(`Failed to refresh token for mailbox ${mailbox.emailAddress}:`, err);
            throw new Error("Mailbox credentials invalid or expired");
        }
    }
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = googleapis_1.google.gmail({ version: "v1", auth: oauth2Client });
    // Filter query to scan bank transfers ( Banco de Chile notifications )
    const query = "subject:(transferencia OR abono OR recibido OR recibida OR aviso)";
    const response = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults
    });
    const messages = response.data.messages || [];
    const fetchedEmails = [];
    for (const msg of messages) {
        if (!msg.id)
            continue;
        // Check if we've already imported this Gmail Message ID
        const exists = await database_1.db.email.findUnique({
            where: { messageId: msg.id }
        });
        if (exists)
            continue;
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
            if (hasAttachments && shared_1.config.flags.enablePdfExtraction) {
                shared_1.logger.info(`Processing ${attachments.length} attachments for msg ${msg.id}...`);
                for (const attach of attachments) {
                    if (attach.mimeType === "application/pdf" || attach.filename.toLowerCase().endsWith(".pdf")) {
                        const pdfText = await (0, pdf_1.extractTextFromPdf)(attach.data);
                        if (pdfText) {
                            bodyHtml += `<div class="pdf-attachment" filename="${attach.filename}">\nPDF CONTENT:\n${pdfText}\n</div>`;
                        }
                    }
                }
            }
            fetchedEmails.push({
                messageId: msg.id,
                subject,
                from,
                receivedAt,
                bodyHtml,
                hasAttachments
            });
        }
        catch (err) {
            shared_1.logger.error(`Failed to process message details for ID ${msg.id}:`, err);
        }
    }
    return fetchedEmails;
}
//# sourceMappingURL=gmail.js.map