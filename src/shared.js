/* Open Autofill — shared constants and storage. Loaded in content + options + popup. */
(function (root) {
  const IDENTITY_FIELDS = [
    { key: "email", label: "Email", placeholder: "you@example.com" },
    { key: "firstName", label: "First name", placeholder: "Alex" },
    { key: "lastName", label: "Last name", placeholder: "Rivera" },
    { key: "fullName", label: "Full name", placeholder: "Alex Rivera" },
    { key: "phone", label: "Phone", placeholder: "4255550100" },
    { key: "address1", label: "Address line 1", placeholder: "123 Main St" },
    { key: "address2", label: "Address line 2", placeholder: "Apt 1" },
    { key: "city", label: "City", placeholder: "Everett" },
    { key: "state", label: "State", placeholder: "WA" },
    { key: "zip", label: "ZIP / postal", placeholder: "98204" },
    { key: "country", label: "Country", placeholder: "United States" },
    { key: "instagram", label: "Instagram", placeholder: "@handle" },
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
    excludedHosts: []
  };

  const emptyIdentity = () =>
    Object.fromEntries(IDENTITY_FIELDS.map((f) => [f.key, ""]));

  async function loadState() {
    const raw = await chrome.storage.local.get(["settings", "identity", "sites", "cleared"]);
    return {
      settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}) },
      identity: { ...emptyIdentity(), ...(raw.identity || {}) },
      sites: raw.sites && typeof raw.sites === "object" ? raw.sites : {},
      cleared: raw.cleared && typeof raw.cleared === "object" ? raw.cleared : {}
    };
  }

  function stripSemanticFromSites(sites, semantic) {
    const next = {};
    for (const [host, rec] of Object.entries(sites || {})) {
      next[host] = {
        ...rec,
        fields: (rec.fields || []).filter((f) => f.semantic !== semantic)
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

  function hostFromUrl(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  function isExcluded(settings, host) {
    const h = (host || "").toLowerCase();
    return (settings.excludedHosts || []).some((rule) => {
      const r = String(rule).trim().toLowerCase().replace(/^www\./, "");
      if (!r) return false;
      return h === r || h.endsWith("." + r);
    });
  }

  function normalizeHandle(value) {
    return String(value || "").trim();
  }

  root.FM = {
    IDENTITY_FIELDS,
    DEFAULT_SETTINGS,
    emptyIdentity,
    loadState,
    saveState,
    setIdentityValue,
    stripSemanticFromSites,
    hostFromUrl,
    isExcluded,
    normalizeHandle
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
