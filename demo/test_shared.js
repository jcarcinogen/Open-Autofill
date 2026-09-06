const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = { console, URL };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "shared.js"), "utf8"), ctx);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

(() => {
  const backup = {
    settings: { autoFill: false, excludedHosts: ["example.com"] },
    identity: { email: "alex@example.com", middleName: "Quinn" },
    sites: { "example.com": { fields: [] } },
    cleared: { phone: true }
  };
  const imported = ctx.FM.normalizeBackupState(backup);
  assert(imported.settings.autoFill === false, "import keeps settings");
  assert(imported.settings.autoLearn === true, "import merges default settings");
  assert(imported.identity.email === "alex@example.com", "import keeps identity");
  assert(imported.identity.middleName === "Quinn", "import keeps new identity fields");
  assert(imported.cleared.phone === true, "import preserves intentional clear markers");
  assert(imported.legacySites["example.com"], "hostname records become inactive legacy sites");
  assert(!imported.sites["example.com"], "hostname records are not replayed as origin memory");

  const originBackup = ctx.FM.normalizeBackupState({
    sites: { "https://example.com": { forms: { "/form": { fields: [{ key: "name:favorite", value: "blue" }] } } } }
  });
  assert(originBackup.sites["https://example.com"].forms["/form"].fields[0].value === "blue", "origin-scoped forms are kept");

  const hybrid = ctx.FM.normalizeBackupState({ origins: { "https://old.example": { trusted: true } } });
  assert(hybrid.hybridOrigins["https://old.example"].trusted === true, "discarded hybrid origins stay preserved and inactive");

  const malformed = ctx.FM.normalizeBackupState({
    settings: "not an object",
    identity: [],
    sites: "not an object",
    cleared: []
  });
  assert(malformed.settings.autoFill === true, "malformed settings fall back safely");
  assert(malformed.identity.email === "", "malformed identity falls back safely");
  assert(Object.keys(malformed.sites).length === 0, "malformed sites fall back safely");
  assert(Object.keys(malformed.cleared).length === 0, "malformed clear markers fall back safely");

  const malformedSite = ctx.FM.normalizeBackupState({
    sites: {
      "example.com": { fields: "not an array" },
      "valid.example": { fields: [null, { key: "name:favorite", aliases: "not an array", value: "blue" }] }
    }
  });
  assert(Array.isArray(malformedSite.legacySites["example.com"].fields), "malformed site fields become an empty array");
  assert(malformedSite.legacySites["example.com"].fields.length === 0, "malformed site fields are discarded");
  assert(malformedSite.legacySites["valid.example"].fields.length === 1, "malformed field records are discarded");
  assert(
    Array.isArray(malformedSite.legacySites["valid.example"].fields[0].aliases),
    "malformed aliases become an empty array"
  );

  let rejected = false;
  try {
    ctx.FM.parseBackup(null);
  } catch {
    rejected = true;
  }
  assert(rejected, "null backup is rejected");
  rejected = false;
  try {
    ctx.FM.parseBackup({ foo: 1 });
  } catch {
    rejected = true;
  }
  assert(rejected, "unrelated JSON is rejected");

  const poisoned = ctx.FM.normalizeBackupState({
    sites: {
      "example.com": {
        fields: [{ key: "name:favorite", semantic: { toString: null }, value: { toString: null }, label: "Color" }]
      }
    }
  });
  assert(poisoned.legacySites["example.com"].fields[0].semantic === "", "object semantic is discarded");
  assert(poisoned.legacySites["example.com"].fields[0].value === "", "object value is discarded");

  const radioKept = ctx.FM.normalizeBackupState({
    sites: {
      "example.com": {
        fields: [
          {
            key: "radioname:color",
            value: "Blue",
            optionLabel: "Blue",
            optionValue: "b"
          }
        ]
      }
    }
  });
  assert(radioKept.legacySites["example.com"].fields[0].optionLabel === "Blue", "radio option labels survive load");
  assert(radioKept.legacySites["example.com"].fields[0].optionValue === "b", "radio option values survive load");

  const upgraded = ctx.FM.normalizeBackupState({
    settings: { autoFill: true },
    identity: { email: "alex@example.com" }
  });
  assert(upgraded.settings.consented === true, "existing profiles keep form memory enabled");
  const fresh = ctx.FM.normalizeBackupState({});
  assert(fresh.settings.consented === false, "new profiles wait for an explicit enable");

  const parsed = ctx.FM.parseBackup(backup);
  assert(parsed.identity.email === "alex@example.com", "parseBackup accepts a real export");
  const envelope = ctx.FM.createBackup(parsed);
  assert(envelope.format === "open-autofill", "export is versioned");
  assert(ctx.FM.parseBackup(envelope).identity.email === "alex@example.com", "versioned export round-trips");
  const placeholderCopy = ctx.FM.IDENTITY_FIELDS.map((field) => field.placeholder || "").join(" ");
  assert(!/Everett|98204/.test(placeholderCopy), "public UI placeholders do not expose the maintainer's location");
  console.log("ok");
})();
