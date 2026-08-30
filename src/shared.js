/* Open Autofill — shared constants and storage. Loaded in content + options + popup. */
(function (root) {
  const IDENTITY_FIELDS = [
    { key: "email", label: "Email", placeholder: "you@example.com" },
    { key: "firstName", label: "First name", placeholder: "Alex" },
    { key: "middleName", label: "Middle name", placeholder: "Quinn" },
    { key: "lastName", label: "Last name", placeholder: "Rivera" },
    { key: "fullName", label: "Full name", placeholder: "Alex Rivera" },
    { key: "nickname", label: "Preferred name", placeholder: "Alex" },
    { key: "phone", label: "Phone", placeholder: "4255550100" },
    { key: "address1", label: "Address line 1", placeholder: "123 Main St" },
    { key: "address2", label: "Address line 2", placeholder: "Apt 1" },
    { key: "city", label: "City", placeholder: "Everett" },
    { key: "state", label: "State", placeholder: "WA" },
    { key: "zip", label: "ZIP / postal", placeholder: "98204" },
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
    const sites = Object.fromEntries(siteEntries);
    const rawCleared = isRecord(raw.cleared) ? raw.cleared : {};
    const cleared = {};
    for (const key of Object.keys(identity)) {
      if (rawCleared[key] === true) cleared[key] = true;
    }
    return { settings, identity, sites, cleared };
  }

  function parseBackup(value) {
    if (!isRecord(value)) throw new Error("Not an Open Autofill backup");
    if (!isRecord(value.settings) && !isRecord(value.identity) && !isRecord(value.sites)) {
      throw new Error("Not an Open Autofill backup");
    }
    return normalizeBackupState(value);
  }

  async function loadState() {
    const raw = await chrome.storage.local.get(["settings", "identity", "sites", "cleared"]);
    return normalizeBackupState(raw);
  }

  function stripSemanticFromSites(sites, semantic) {
    const next = {};
    const removesSemantic = (fieldSemantic) =>
      fieldSemantic === semantic ||
      (semantic === "birthday" && /^birthday(?:Month|Day|Year|-(?:month|day|year))$/.test(String(fieldSemantic || "")));
    for (const [host, rec] of Object.entries(sites || {})) {
      next[host] = {
        ...rec,
        fields: (rec.fields || []).filter((f) => !removesSemantic(f.semantic))
      };
    }
    return next;
  }

  async function setIdentityValue(key, value) {
    const state = await loadState();
    const identity = { ...state.identity, [key]: value };
    const cleared = { ...(state.cleared || {}) };
    let sites = state.sites;
    if (value) delete cleared[key];
    else {
      cleared[key] = true;
      sites = stripSemanticFromSites(sites, key);
    }
    await saveState({ identity, cleared, sites });
  }

  async function saveState(partial) {
    await chrome.storage.local.set(partial);
  }

  function createSerialTaskQueue() {
    let tail = Promise.resolve();
    return (task) => {
      const run = tail.then(task, task);
      tail = run.catch(() => {});
      return run;
    };
  }

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
    loadState,
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
