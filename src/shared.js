/* Open Autofill — shared constants and storage. Loaded in content + options + popup. */
(function (root) {
  const IDENTITY_FIELDS = [
    { key: "email", label: "Email", placeholder: "you@example.com" },
    { key: "firstName", label: "First name", placeholder: "Alex" },
    { key: "middleName", label: "Middle name", placeholder: "Quinn" },
    { key: "lastName", label: "Last name", placeholder: "Rivera" },
    { key: "fullName", label: "Full name", placeholder: "Alex Rivera" },
    { key: "nickname", label: "Preferred name", placeholder: "Alex" },
    { key: "phone", label: "Phone", placeholder: "5550101234" },
    { key: "address1", label: "Address line 1", placeholder: "123 Main St" },
    { key: "address2", label: "Address line 2", placeholder: "Apt 1" },
    { key: "city", label: "City", placeholder: "Springfield" },
    { key: "state", label: "State", placeholder: "IL" },
    { key: "zip", label: "ZIP / postal", placeholder: "62701" },
    { key: "country", label: "Country", placeholder: "United States" },
    { key: "instagram", label: "Instagram", placeholder: "@handle" },
    { key: "threads", label: "Threads", placeholder: "@handle" },
    { key: "bluesky", label: "Bluesky", placeholder: "handle.bsky.social" },
    { key: "twitter", label: "X / Twitter", placeholder: "@handle" },
    { key: "tiktok", label: "TikTok", placeholder: "@handle" },
    { key: "facebook", label: "Facebook", placeholder: "profile name or URL" },
    { key: "youtube", label: "YouTube", placeholder: "channel or @handle" },
    { key: "birthday", label: "Birthday", placeholder: "1990-01-15" },
    { key: "age", label: "Age", placeholder: "35" },
    { key: "gender", label: "Gender", placeholder: "" },
    { key: "company", label: "Company", placeholder: "" },
    { key: "website", label: "Website", placeholder: "https://" },
    {
      key: "agreeToRules",
      label: "Official Rules / I agree",
      placeholder: "",
      type: "toggle"
    }
  ];

  const DEFAULT_SETTINGS = {
    autoFill: true,
    autoLearn: true,
    highlightFilled: true,
    skipPasswords: true,
    skipPaymentAndSsn: true,
    fillDelayMs: 150,
    fillSearchFields: false,
    excludedHosts: [],
    consented: false
  };

  const DEFAULT_SKIP_HOSTS = [
    "mail.google.com",
    "inbox.google.com",
    "gmail.com",
    "outlook.live.com",
    "outlook.office.com",
    "outlook.office365.com",
    "mail.yahoo.com",
    "mail.aol.com",
    "mail.proton.me",
    "mail.icloud.com"
  ];

  const emptyIdentity = () =>
    Object.fromEntries(IDENTITY_FIELDS.map((f) => [f.key, ""]));

  function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function primitiveString(value, max) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value).slice(0, max);
    }
    return "";
  }

  function normalizeSiteField(field) {
    if (!isRecord(field)) return null;
    const key = primitiveString(field.key, 300);
    if (!key) return null;
    return {
      key,
      aliases: Array.isArray(field.aliases)
        ? field.aliases.map((alias) => primitiveString(alias, 300)).filter(Boolean)
        : [],
      type: primitiveString(field.type, 40),
      value: typeof field.value === "boolean" ? field.value : primitiveString(field.value, 2000),
      semantic: primitiveString(field.semantic, 40),
      role: primitiveString(field.role, 40),
      label: primitiveString(field.label, 300),
      optionLabel: primitiveString(field.optionLabel, 300),
      optionValue: primitiveString(field.optionValue, 300),
      blocked: field.blocked === true,
      override: field.override === true
    };
  }

  function normalizeBackupState(value) {
    const raw = isRecord(value) ? value : {};
    const rawSettings = isRecord(raw.settings) ? raw.settings : {};
    const settings = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (key === "excludedHosts" || key === "fillDelayMs") continue;
      if (typeof rawSettings[key] === "boolean") settings[key] = rawSettings[key];
    }
    const delay = Number(rawSettings.fillDelayMs);
    if (Number.isFinite(delay) && delay >= 0) settings.fillDelayMs = delay;
    settings.excludedHosts = Array.isArray(rawSettings.excludedHosts)
      ? rawSettings.excludedHosts.map((host) => String(host || "").trim()).filter(Boolean)
      : [];
    if (typeof rawSettings.fillOnAppSites === "boolean") settings.fillOnAppSites = rawSettings.fillOnAppSites;
    settings.skipPasswords = true;
    settings.skipPaymentAndSsn = true;
    if (typeof rawSettings.consented === "boolean") settings.consented = rawSettings.consented;
    else if (Object.keys(rawSettings).length) settings.consented = true;

    const rawIdentity = isRecord(raw.identity) ? raw.identity : {};
    const identity = emptyIdentity();
    for (const field of IDENTITY_FIELDS) {
      const fieldValue = rawIdentity[field.key];
      if (field.type === "toggle") identity[field.key] = fieldValue === true || fieldValue === "true" ? "true" : "";
      else identity[field.key] = primitiveString(fieldValue, 500).trim();
    }

    const siteEntries = [];
    if (isRecord(raw.sites)) {
      for (const [host, site] of Object.entries(raw.sites)) {
        if (!host || !isRecord(site)) continue;
        const fields = Array.isArray(site.fields) ? site.fields.map(normalizeSiteField).filter(Boolean) : [];
        siteEntries.push([
          primitiveString(host, 253),
          { fields, lastSaved: primitiveString(site.lastSaved, 40) }
        ]);
      }
    }
    const legacySites = Object.fromEntries(siteEntries.filter(([key]) => !originFromUrl(key)));
    const sites = Object.create(null);
    for (const [origin, rec] of Object.entries(raw.sites || {})) {
      if (originFromUrl(origin) !== origin || !isRecord(rec.forms)) continue;
      const forms = Object.create(null);
      for (const [scope, form] of Object.entries(rec.forms)) {
        if (isRecord(form)) forms[scope] = {fields: Array.isArray(form.fields) ? form.fields.map(normalizeSiteField).filter(Boolean) : [], lastSaved: primitiveString(form.lastSaved,40)};
      }
      sites[origin] = {forms};
    }
    Object.assign(legacySites, isRecord(raw.legacySites) ? raw.legacySites : {});
    const hybridOrigins = isRecord(raw.hybridOrigins)
      ? raw.hybridOrigins
      : isRecord(raw.origins)
        ? raw.origins
        : {};
    const rawCleared = isRecord(raw.cleared) ? raw.cleared : {};
    const cleared = {};
    for (const key of Object.keys(identity)) {
      if (rawCleared[key] === true) cleared[key] = true;
    }
    return { schemaVersion: 2, settings, identity, sites, legacySites, hybridOrigins, cleared, epoch: Number.isSafeInteger(raw.epoch) ? raw.epoch : 0, revision: Number.isSafeInteger(raw.revision) ? raw.revision : 0 };
  }

  const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
  function createBackup(state) {
    return {format:"open-autofill",version:1,schemaVersion:2,exportedAt:new Date().toISOString(),state:normalizeBackupState(state)};
  }
  function parseBackup(value) {
    const invalid = () => { throw new Error("Invalid or unsupported Open Autofill backup"); };
    if (!isRecord(value) || JSON.stringify(value).length > MAX_BACKUP_BYTES) invalid();
    const modern = Object.hasOwn(value,"format");
    if (modern && (value.format !== "open-autofill" || value.version !== 1 || value.schemaVersion !== 2 || typeof value.exportedAt !== "string" || !Number.isFinite(Date.parse(value.exportedAt)))) invalid();
    const raw = modern ? value.state : value;
    if (!isRecord(raw) || !isRecord(raw.settings) || !isRecord(raw.identity) || !isRecord(raw.sites) || !isRecord(raw.cleared)) invalid();
    if (modern && (raw.schemaVersion !== 2 || !isRecord(raw.legacySites) || !Number.isSafeInteger(raw.epoch) || raw.epoch < 0 || !Number.isSafeInteger(raw.revision) || raw.revision < 0)) invalid();
    function safeKeys(obj, allowed) { for (const k of Object.keys(obj)) if (["__proto__","prototype","constructor"].includes(k) || (allowed && !allowed.includes(k))) invalid(); }
    safeKeys(raw,["schemaVersion","settings","identity","sites","legacySites","hybridOrigins","origins","cleared","epoch","revision"]);
    const identityKeys = IDENTITY_FIELDS.map(f => f.key);
    safeKeys(raw.identity,identityKeys); safeKeys(raw.cleared,identityKeys);
    if (!Object.keys(raw.settings).length || !Object.keys(raw.identity).length) invalid();
    for (const [key,v] of Object.entries(raw.identity)) if ((typeof v !== "string" && !(key === "agreeToRules" && typeof v === "boolean")) || String(v).length > 500) invalid();
    for (const v of Object.values(raw.cleared)) if (v !== true) invalid();
    safeKeys(raw.settings,[...Object.keys(DEFAULT_SETTINGS),"fillOnAppSites"]);
    for (const [key,v] of Object.entries(raw.settings)) {
      if (key === "excludedHosts") { if (!Array.isArray(v) || v.length > 1000 || v.some(h => typeof h !== "string" || h.length > 253)) invalid(); }
      else if (key === "fillDelayMs") { if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 60000) invalid(); }
      else if (typeof v !== "boolean") invalid();
    }
    function validateFields(rec) {
      if (!isRecord(rec) || !Array.isArray(rec.fields) || rec.fields.length > 10000) invalid();
      safeKeys(rec,["fields","lastSaved"]);
      if (rec.lastSaved !== undefined && typeof rec.lastSaved !== "string") invalid();
      for (const f of rec.fields) {
        if (!isRecord(f) || typeof f.key !== "string" || !f.key || f.key.length > 300 || !["string","boolean"].includes(typeof f.value) || String(f.value).length > 2000) invalid();
        safeKeys(f,["key","aliases","type","value","semantic","role","label","optionLabel","optionValue","override","blocked"]);
        for (const [k,v] of Object.entries(f)) {
          if (k === "aliases") { if (!Array.isArray(v) || v.length > 100 || v.some(x => typeof x !== "string" || x.length > 300)) invalid(); }
          else if (["override","blocked"].includes(k)) { if (typeof v !== "boolean") invalid(); }
          else if (k !== "value" && (typeof v !== "string" || v.length > 300)) invalid();
        }
      }
    }
    safeKeys(raw.sites);
    for (const [origin,rec] of Object.entries(raw.sites)) {
      if (modern) {
        if (originFromUrl(origin) !== origin || !isRecord(rec) || !isRecord(rec.forms)) invalid();
        safeKeys(rec,["forms"]); safeKeys(rec.forms);
        for (const [scope,form] of Object.entries(rec.forms)) { if (!scope || scope.length > 4000) invalid(); validateFields(form); }
      } else { if (!origin || origin.length > 253) invalid(); validateFields(rec); }
    }
    if (raw.legacySites !== undefined) {
      if (!isRecord(raw.legacySites)) invalid(); safeKeys(raw.legacySites);
      for (const rec of Object.values(raw.legacySites)) validateFields(rec);
    }
    return normalizeBackupState(raw);
  }

  async function loadStoredState() {
    const raw = await chrome.storage.local.get(null);
    return normalizeBackupState(raw);
  }

  function stripSemanticFromSites(sites, semantic) {
    const next = {};
    const removesSemantic = (fieldSemantic) =>
      fieldSemantic === semantic ||
      (semantic === "birthday" && /^birthday(?:Month|Day|Year|-(?:month|day|year))$/.test(String(fieldSemantic || "")));
    for (const [origin, rec] of Object.entries(sites || {})) {
      if (rec && rec.forms) {
        const forms = {};
        for (const [scope, form] of Object.entries(rec.forms)) {
          forms[scope] = {
            ...form,
            fields: (form.fields || []).filter((f) => !removesSemantic(f.semantic))
          };
        }
        next[origin] = { ...rec, forms };
      } else {
        next[origin] = {
          ...rec,
          fields: (rec.fields || []).filter((f) => !removesSemantic(f.semantic))
        };
      }
    }
    return next;
  }

  async function setIdentityValue(key, value) { return mutate("identity", {key,value}); }
  async function saveState() { throw new Error("Use a narrow worker mutation"); }

  function createSerialTaskQueue() {
    let tail = Promise.resolve();
    return (task) => {
      const run = tail.then(task, task);
      tail = run.catch(() => {});
      return run;
    };
  }

  function originFromUrl(url) {
    try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.origin : ""; } catch { return ""; }
  }
  async function request(message) {
    const result = await chrome.runtime.sendMessage(message);
    if (!result || result.error) throw new Error(result?.error || "Worker did not respond");
    return result;
  }
  async function loadState() { return (await request({type:"fm.state"})).state; }
  async function mutate(op, args = {}) { return request({type:"fm.mutate", op, ...args}); }
  function hostFromUrl(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  function isExcluded(settings, host) {
    const h = (host || "").toLowerCase();
    if (!h) return false;
    if (!(settings && settings.fillOnAppSites) && DEFAULT_SKIP_HOSTS.some((r) => h === r || h.endsWith("." + r))) {
      return true;
    }
    return (settings.excludedHosts || []).some((rule) => {
      const r = String(rule).trim().toLowerCase().replace(/^www\./, "");
      if (!r) return false;
      return h === r || h.endsWith("." + r);
    });
  }

  function normalizeHandle(value) {
    return String(value || "").trim();
  }

  function cleanNodeText(node) {
    return String((node && (node.innerText || node.textContent)) || "")
      .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  root.FM = {
    IDENTITY_FIELDS,
    DEFAULT_SETTINGS,
    DEFAULT_SKIP_HOSTS,
    emptyIdentity,
    normalizeBackupState,
    parseBackup,
    createBackup,
    MAX_BACKUP_BYTES,
    loadState,
    mutate,
    originFromUrl,
    loadStoredState,
    isRecord,
    saveState,
    createSerialTaskQueue,
    setIdentityValue,
    stripSemanticFromSites,
    hostFromUrl,
    isExcluded,
    normalizeHandle,
    cleanNodeText
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
