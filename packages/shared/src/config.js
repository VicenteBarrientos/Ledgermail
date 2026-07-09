"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables from the root .env file if present
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), ".env") });
exports.config = {
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
    },
    flags: {
        enableAggressiveSanitizer: process.env.ENABLE_AGGRESSIVE_SANITIZER !== "false",
        enableCache: process.env.ENABLE_CACHE !== "false",
        enableRetry: process.env.ENABLE_RETRY !== "false",
        defaultLlmProvider: (process.env.DEFAULT_LLM_PROVIDER || "openai"),
        defaultModelName: process.env.DEFAULT_MODEL_NAME || "gpt-4o-mini",
        enablePdfExtraction: process.env.ENABLE_PDF_EXTRACTION !== "false",
    }
};
//# sourceMappingURL=config.js.map