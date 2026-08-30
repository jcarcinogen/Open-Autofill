const fs = require("fs");
const path = require("path");

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(manifest.manifest_version === 3, "package must use Manifest V3");
assert(!manifest.permissions.includes("activeTab"), "activeTab is redundant when all HTTP(S) hosts are already granted");
assert(
  manifest.permissions.slice().sort().join(",") === ["contextMenus", "scripting", "storage"].sort().join(","),
  "package requests only the permissions used by the extension"
);
assert(
  manifest.host_permissions.slice().sort().join(",") === ["http://*/*", "https://*/*"].sort().join(","),
  "host access stays limited to pages the form filler can operate on"
);
console.log("ok");
