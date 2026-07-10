import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Try loading from current working directory, then check parent directory levels
let envPath = path.resolve(process.cwd(), ".env");
if (!fs.existsSync(envPath)) {
  const pathsToCheck = [
    path.resolve(process.cwd(), "..", ".env"),
    path.resolve(process.cwd(), "..", "..", ".env"),
    path.resolve(process.cwd(), "..", "..", "..", ".env"),
  ];
  for (const p of pathsToCheck) {
    if (fs.existsSync(p)) {
      envPath = p;
      break;
    }
  }
}

dotenv.config({ path: envPath });

export const config = {
  db: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/ledgermail?schema=public",
  },
  llm: {
    openaiApiKey: process.env.OPENAI_API_KEY || "",
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  },
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID || "",
    clientSecret: process.env.GMAIL_CLIENT_SECRET || "",
    redirectUri: process.env.GMAIL_REDIRECT_URI || "http://localhost:3000/api/auth/callback/google",
  },
  auth: {
    nextauthSecret: process.env.NEXTAUTH_SECRET || "supersecretnextauthsecretkey",
  },
  api: {
    port: parseInt(process.env.PORT || "3001", 10),
    cronSecret: process.env.CRON_SECRET || "local-cron-secret",
    condosyncWebhookUrl: process.env.CONDOSYNC_WEBHOOK_URL || "",
    apiBaseUrl: process.env.API_BASE_URL || "",
  },
  flags: {
    enableAggressiveSanitizer: process.env.ENABLE_AGGRESSIVE_SANITIZER !== "false",
    enableCache: process.env.ENABLE_CACHE !== "false",
    enableRetry: process.env.ENABLE_RETRY !== "false",
    defaultLlmProvider: (process.env.DEFAULT_LLM_PROVIDER || "openai") as "openai" | "gemini" | "anthropic",
    defaultModelName: process.env.DEFAULT_MODEL_NAME || "gpt-4o-mini",
    enablePdfExtraction: process.env.ENABLE_PDF_EXTRACTION !== "false",
  }
};
