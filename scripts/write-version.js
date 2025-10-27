const fs = require("fs");
const path = require("path");
const pkg = require("../package.json");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = { version: `${pkg.version} (${stamp})`, commit: process.env.GIT_COMMIT || "" };

fs.writeFileSync(
  path.join(__dirname, "..", "public", "version.json"),
  JSON.stringify(out, null, 2),
  "utf8"
);
console.log("Wrote public/version.json ->", out);
