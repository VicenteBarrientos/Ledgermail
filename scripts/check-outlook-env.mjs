import fs from "fs";
const t = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
for (const k of [
  "OUTLOOK_CLIENT_ID",
  "OUTLOOK_CLIENT_SECRET",
  "OUTLOOK_REDIRECT_URI",
]) {
  const m = t.match(new RegExp(`^${k}=(.*)$`, "m"));
  if (!m) {
    console.log(`${k}: MISSING`);
    continue;
  }
  let v = m[1].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  if (!v) console.log(`${k}: EMPTY`);
  else if (k.includes("SECRET")) console.log(`${k}: set (${v.length} chars)`);
  else console.log(`${k}: ${v}`);
}
