const fs = require("fs");
const path = require("path");

const srcDir = path.resolve(__dirname, "../../../packages/database/src/generated/client");
const destDir = path.resolve(__dirname, "../api");

if (!fs.existsSync(srcDir)) {
  console.log(`[copy-engines] Source directory ${srcDir} does not exist. Skipping.`);
  process.exit(0);
}

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

fs.readdirSync(srcDir).forEach((file) => {
  if (file.endsWith(".node") || file.includes("query_engine")) {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(destDir, file);
    console.log(`[copy-engines] Copying ${file} to ${destDir}`);
    fs.copyFileSync(srcFile, destFile);
  }
});
