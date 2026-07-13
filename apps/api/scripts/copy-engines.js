const fs = require("fs");
const path = require("path");

const srcDir = path.resolve(
  __dirname,
  "../../../packages/database/src/generated/client"
);
// Bundle lands in apps/api/api/index.js — engines must sit next to it on Vercel (/var/task/api or /var/task).
const destDirs = [
  path.resolve(__dirname, ".."), // apps/api
  path.resolve(__dirname, "../api"), // apps/api/api (esbuild outfile dir)
];

if (!fs.existsSync(srcDir)) {
  console.log(`[copy-engines] Source directory ${srcDir} does not exist. Skipping.`);
  process.exit(0);
}

const files = fs.readdirSync(srcDir).filter(
  (file) => file.endsWith(".node") || file.includes("query_engine") || file.includes("libquery_engine")
);

if (files.length === 0) {
  console.log("[copy-engines] No engine binaries found in", srcDir);
}

for (const destDir of destDirs) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  for (const file of files) {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(destDir, file);
    console.log(`[copy-engines] Copying ${file} → ${destDir}`);
    fs.copyFileSync(srcFile, destFile);
  }
}
