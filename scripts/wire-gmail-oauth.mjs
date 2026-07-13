/**
 * Wire Desktop OAuth client JSON into LedgerMail .env (local only).
 * Does not print secrets.
 *
 * Usage: node scripts/wire-gmail-oauth.mjs
 * Optional: GMAIL_CREDENTIALS_PATH=C:\path\to\client.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
const credPath =
  process.env.GMAIL_CREDENTIALS_PATH ||
  "C:/Users/hp/OneDrive/Desktop/Cosas/gmail-credentials.json";

// Dashboard reads ?code= on its home page (port 3000)
const REDIRECT_URI = "http://localhost:3000";

if (!fs.existsSync(credPath)) {
  console.error("Credentials file not found:", credPath);
  process.exit(1);
}
if (!fs.existsSync(envPath)) {
  console.error(".env not found:", envPath);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(credPath, "utf8"));
const client = raw.installed || raw.web || raw;
if (!client.client_id || !client.client_secret) {
  console.error("client_id / client_secret missing in credentials JSON");
  process.exit(1);
}

let env = fs.readFileSync(envPath, "utf8");
const sets = {
  GMAIL_CLIENT_ID: client.client_id,
  GMAIL_CLIENT_SECRET: client.client_secret,
  GMAIL_REDIRECT_URI: REDIRECT_URI,
};

for (const [key, value] of Object.entries(sets)) {
  const line = `${key}="${value}"`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(env)) {
    env = env.replace(re, line);
  } else {
    env = env.trimEnd() + `\n${line}\n`;
  }
}

fs.writeFileSync(envPath, env, "utf8");
console.log("Updated .env:");
console.log("  GMAIL_CLIENT_ID = set");
console.log("  GMAIL_CLIENT_SECRET = set");
console.log("  GMAIL_REDIRECT_URI =", REDIRECT_URI);
console.log("  credentials shape:", raw.installed ? "installed/Desktop" : raw.web ? "web" : "flat");
console.log("");
console.log("Google Cloud Console checklist:");
console.log("  1. Open project:", client.project_id || "(see credentials file)");
console.log("  2. APIs & Services → Credentials → this OAuth client");
console.log("  3. Authorized redirect URIs must include:", REDIRECT_URI);
console.log("     (Desktop clients often allow any localhost port; if connect fails, add it explicitly or create a Web client)");
console.log("  4. Enable Gmail API for the project");
console.log("  5. OAuth consent screen: add your Gmail as test user if app is in Testing");
