import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
const credPath = "C:/Users/hp/OneDrive/Desktop/Cosas/gmail-credentials.json";

const env = fs.readFileSync(envPath, "utf8");
const lines = Object.fromEntries(
  env
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      const k = l.slice(0, i).trim();
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return [k, v];
    })
);

function status(v) {
  if (!v || !v.trim()) return "empty";
  if (/your-|here|example|xxx|change-me|placeholder/i.test(v)) return "placeholder";
  return `set (${v.length} chars)`;
}

console.log("=== .env Gmail/DB (status only) ===");
for (const k of [
  "DATABASE_URL",
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REDIRECT_URI",
  "NEXTAUTH_SECRET",
  "ANTHROPIC_API_KEY",
  "DEFAULT_LLM_PROVIDER",
]) {
  console.log(`${k}: ${status(lines[k] || "")}`);
}

if (lines.DATABASE_URL) {
  try {
    const u = new URL(lines.DATABASE_URL.replace(/^postgresql:/, "http:"));
    console.log(`DB host=${u.hostname} port=${u.port || 5432} db=${u.pathname}`);
  } catch (e) {
    console.log("DB URL parse failed:", e.message);
  }
}

console.log("\n=== gmail-credentials.json ===");
const j = JSON.parse(fs.readFileSync(credPath, "utf8"));
const c = j.installed || j.web || j;
console.log("shape:", j.installed ? "installed (Desktop)" : j.web ? "web" : "flat");
console.log("redirect_uris:", JSON.stringify(c.redirect_uris || null));
console.log("client_id starts:", String(c.client_id || "").slice(0, 24) + "...");
console.log("client_secret length:", String(c.client_secret || "").length);
console.log("project_id:", c.project_id || j.project_id || "(none)");
