export interface SyncSummary {
  synced: number;
  parsedSuccessfully: number;
  needsReview: number;
  failed: number;
}

export interface SyncResponse {
  success: boolean;
  summary: SyncSummary;
  details: Array<{ subject: string; success: boolean; error: string | null }>;
}

export interface ParseResponse {
  success: boolean;
  transactions?: Array<Record<string, any>>;
  transaction?: Record<string, any> | null;
  error?: string;
}

function getApiBaseUrl(): string {
  const base = process.env.API_BASE_URL;
  if (!base) {
    throw new Error("Missing API_BASE_URL — point this at the deployed LedgerMail API (e.g. https://<...>.vercel.app).");
  }
  return base.replace(/\/$/, "");
}

async function postJson<T>(pathName: string, body: unknown): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${pathName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`POST ${pathName} -> ${res.status}: ${JSON.stringify(json)}`);
  }
  return json as T;
}

/** Tier A: triggers a real Gmail sync and returns the raw sync response. */
export async function triggerGmailSync(mailboxSourceId: string, maxResults = 10): Promise<SyncResponse> {
  return postJson<SyncResponse>("/api/gmail/sync", { mailboxSourceId, maxResults });
}

/** Tier B: parses a synthetic email directly through the pipeline (bypasses Gmail transport). */
export async function parseDirect(input: {
  from: string;
  subject: string;
  bodyHtml: string;
  mailboxSourceId: string;
}): Promise<ParseResponse> {
  return postJson<ParseResponse>("/api/parse", input);
}
