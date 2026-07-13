import fs from "fs";
const t = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
const m = t.match(/^OUTLOOK_CLIENT_SECRET=(.*)$/m);
if (!m) {
  console.log("OUTLOOK_CLIENT_SECRET: missing");
  process.exit(0);
}
let v = m[1].trim();
if (
  (v.startsWith('"') && v.endsWith('"')) ||
  (v.startsWith("'") && v.endsWith("'"))
) {
  v = v.slice(1, -1);
}
const guid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
console.log("length:", v.length);
console.log("looks_like_guid (Secret ID pattern):", guid);
console.log("has_whitespace:", /\s/.test(v));
if (guid) {
  console.log(
    "DIAGNOSIS: This looks like the Secret ID, not the Value. Create a new secret and copy Value."
  );
} else if (v.length < 10) {
  console.log("DIAGNOSIS: Secret too short / empty-ish.");
} else {
  console.log(
    "DIAGNOSIS: Shape is not a GUID (good). If Azure still rejects it, recreate the secret and replace the value."
  );
}
