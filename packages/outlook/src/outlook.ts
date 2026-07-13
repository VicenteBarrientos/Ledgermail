/**
 * Microsoft Graph mail connector (Outlook.com / Hotmail / M365 work).
 * OAuth 2.0 authorization code + refresh tokens. Read-only Mail.Read.
 */
import { config, logger } from "@ledgermail/shared";
import { db } from "@ledgermail/database";

const AUTHORIZE_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH = "https://graph.microsoft.com/v1.0";

const SCOPES = [
  "offline_access",
  "openid",
  "profile",
  "email",
  "User.Read",
  "Mail.Read",
].join(" ");

export interface OutlookTokenResponse {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
  email?: string;
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

export interface OverviewMessage {
  id: string;
  threadId?: string | null;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  labelIds: string[];
}

function assertOutlookConfigured() {
  if (!config.outlook.clientId || !config.outlook.clientSecret) {
    throw new Error(
      "Outlook OAuth is not configured. Set OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET in .env (Azure app registration)."
    );
  }
}

export function getOutlookAuthUrl(state = "outlook"): string {
  assertOutlookConfigured();
  const params = new URLSearchParams({
    client_id: config.outlook.clientId,
    response_type: "code",
    redirect_uri: config.outlook.redirectUri,
    response_mode: "query",
    scope: SCOPES,
    state,
    // Force account picker — useful when users have UC + personal Hotmail
    prompt: "select_account",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeToken(body: Record<string, string>) {
  assertOutlookConfigured();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.outlook.clientId,
      client_secret: config.outlook.clientSecret,
      ...body,
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || `Outlook token exchange failed (${res.status})`
    );
  }
  return data;
}

export async function getOutlookTokensFromCode(
  code: string
): Promise<OutlookTokenResponse> {
  const data = await exchangeToken({
    code,
    redirect_uri: config.outlook.redirectUri,
    grant_type: "authorization_code",
  });

  let email: string | undefined;
  try {
    const meRes = await fetch(`${GRAPH}/me?$select=mail,userPrincipalName,displayName`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (meRes.ok) {
      const me = (await meRes.json()) as {
        mail?: string;
        userPrincipalName?: string;
      };
      email = me.mail || me.userPrincipalName || undefined;
    }
  } catch (err) {
    logger.warn("Could not fetch Microsoft Graph /me after OAuth:", err);
  }

  const expiresIn = data.expires_in ?? 3600;
  return {
    accessToken: data.access_token!,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + expiresIn * 1000,
    email,
  };
}

export async function refreshOutlookAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: number; refreshToken?: string }> {
  const data = await exchangeToken({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: SCOPES,
  });
  const expiresIn = data.expires_in ?? 3600;
  return {
    accessToken: data.access_token!,
    expiresAt: Date.now() + expiresIn * 1000,
    refreshToken: data.refresh_token || refreshToken,
  };
}

async function getAccessTokenForMailbox(mailboxSourceId: string): Promise<{
  accessToken: string;
  emailAddress: string;
}> {
  const mailbox = await db.mailboxSource.findUniqueOrThrow({
    where: { id: mailboxSourceId },
  });
  if (mailbox.type !== "OUTLOOK_OAUTH") {
    throw new Error(`Mailbox ${mailboxSourceId} is not OUTLOOK_OAUTH`);
  }

  const credentials = mailbox.credentials as {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  };
  let accessToken = credentials.accessToken || "";
  let refreshToken = credentials.refreshToken;

  const expired =
    !credentials.expiresAt || Date.now() > credentials.expiresAt - 60_000;

  if (expired) {
    if (!refreshToken) {
      throw new Error(
        "Outlook credentials expired and no refresh token is stored. Reconnect Outlook."
      );
    }
    logger.info(`Refreshing Outlook token for ${mailbox.emailAddress}...`);
    const refreshed = await refreshOutlookAccessToken(refreshToken);
    accessToken = refreshed.accessToken;
    refreshToken = refreshed.refreshToken || refreshToken;
    await db.mailboxSource.update({
      where: { id: mailboxSourceId },
      data: {
        credentials: {
          ...credentials,
          accessToken,
          refreshToken,
          expiresAt: refreshed.expiresAt,
        },
      },
    });
  }

  return { accessToken, emailAddress: mailbox.emailAddress };
}

async function graphGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.body-content-type="html"',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

/** Bank-oriented sync: subject filter similar to Gmail connector. */
export async function syncOutlookMessages(
  mailboxSourceId: string,
  maxResults = 20
): Promise<FetchedEmail[]> {
  const { accessToken } = await getAccessTokenForMailbox(mailboxSourceId);

  // Graph $search requires ConsistencyLevel header for some tenants; $filter on subject is safer.
  // Pull recent inbox mail and filter client-side for bank-ish subjects.
  const list = await graphGet<{
    value: Array<{ id: string; subject?: string; receivedDateTime?: string }>;
  }>(
    accessToken,
    `/me/mailFolders/inbox/messages?$top=${Math.min(
      maxResults * 3,
      50
    )}&$select=id,subject,receivedDateTime&$orderby=receivedDateTime desc`
  );

  const bankRe =
    /transferencia|abono|recibid[oa]|aviso de transferencia|tef|pago recibido/i;
  const candidates = (list.value || [])
    .filter((m) => bankRe.test(m.subject || ""))
    .slice(0, maxResults);

  const fetched: FetchedEmail[] = [];

  for (const msg of candidates) {
    if (!msg.id) continue;
    const exists = await db.email.findUnique({ where: { messageId: msg.id } });
    if (exists) continue;

    try {
      const full = await graphGet<{
        id: string;
        subject?: string;
        body?: { contentType?: string; content?: string };
        bodyPreview?: string;
        from?: { emailAddress?: { name?: string; address?: string } };
        receivedDateTime?: string;
        hasAttachments?: boolean;
      }>(
        accessToken,
        `/me/messages/${msg.id}?$select=id,subject,body,bodyPreview,from,receivedDateTime,hasAttachments`
      );

      const fromAddr = full.from?.emailAddress;
      const from = fromAddr
        ? `${fromAddr.name || ""} <${fromAddr.address || ""}>`.trim()
        : "Unknown Sender";
      const bodyHtml =
        full.body?.content ||
        `<div>${full.bodyPreview || ""}</div>`;

      fetched.push({
        messageId: full.id,
        subject: full.subject || "No Subject",
        from,
        receivedAt: full.receivedDateTime
          ? new Date(full.receivedDateTime)
          : new Date(),
        bodyHtml,
        hasAttachments: Boolean(full.hasAttachments),
      });
    } catch (err) {
      logger.error(`Failed to fetch Outlook message ${msg.id}:`, err);
    }
  }

  return fetched;
}

export async function listOutlookOverview(
  mailboxSourceId: string,
  options: { maxResults?: number; query?: string } = {}
): Promise<{ emailAddress: string; query: string; messages: OverviewMessage[] }> {
  const maxResults = options.maxResults ?? 50;
  const { accessToken, emailAddress } =
    await getAccessTokenForMailbox(mailboxSourceId);

  // query reserved for future Graph $search; default = recent inbox
  const query = options.query || "inbox recent";

  const list = await graphGet<{
    value: Array<{
      id: string;
      conversationId?: string;
      subject?: string;
      bodyPreview?: string;
      from?: { emailAddress?: { name?: string; address?: string } };
      toRecipients?: Array<{ emailAddress?: { address?: string } }>;
      receivedDateTime?: string;
      categories?: string[];
    }>;
  }>(
    accessToken,
    `/me/mailFolders/inbox/messages?$top=${maxResults}&$select=id,conversationId,subject,bodyPreview,from,toRecipients,receivedDateTime,categories&$orderby=receivedDateTime desc`
  );

  const messages: OverviewMessage[] = (list.value || []).map((m) => {
    const fromAddr = m.from?.emailAddress;
    const from = fromAddr
      ? `${fromAddr.name || ""} <${fromAddr.address || ""}>`.trim()
      : "";
    const to = (m.toRecipients || [])
      .map((t) => t.emailAddress?.address)
      .filter(Boolean)
      .join(", ");
    return {
      id: m.id,
      threadId: m.conversationId,
      subject: m.subject || "(no subject)",
      from,
      to,
      date: m.receivedDateTime || "",
      snippet: m.bodyPreview || "",
      labelIds: m.categories || [],
    };
  });

  return { emailAddress, query, messages };
}
