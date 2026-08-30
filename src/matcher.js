/* Open Autofill — classify and match form controls. No browser APIs required. */
(function (root) {
  const AUTOCOMPLETE_MAP = {
    email: "email",
    "email-address": "email",
    "username email": "email",
    "given-name": "firstName",
    "additional-name": "middleName",
    "family-name": "lastName",
    name: "fullName",
    nickname: "nickname",
    tel: "phone",
    "tel-national": "phone",
    "tel-local": "phone",
    "street-address": "address1",
    "address-line1": "address1",
    "address-line2": "address2",
    "address-level2": "city",
    "address-level1": "state",
    "postal-code": "zip",
    country: "country",
    "country-name": "country",
    bday: "birthday",
    "bday-day": "birthdayDay",
    "bday-month": "birthdayMonth",
    "bday-year": "birthdayYear",
    organization: "company",
    url: "website",
    "home page": "website",
    sex: "gender"
  };

  const REGION_CODES = {
    alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
    connecticut: "CT", delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA",
    hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
    louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
    mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
    "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
    ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
    "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
    virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
    "american samoa": "AS", guam: "GU", "northern mariana islands": "MP", "puerto rico": "PR",
    "u.s. minor outlying islands": "UM", "united states minor outlying islands": "UM",
    "us virgin islands": "VI", "u.s. virgin islands": "VI", "united states virgin islands": "VI",
    alberta: "AB", "british columbia": "BC", manitoba: "MB", "new brunswick": "NB",
    "newfoundland and labrador": "NL", "northwest territories": "NT", "nova scotia": "NS", nunavut: "NU",
    ontario: "ON", "prince edward island": "PE", quebec: "QC", saskatchewan: "SK", yukon: "YT"
  };

  const SEMANTIC_PATTERNS = [
    { key: "email", re: /(e[-\s]?mail|mailaddress|emailaddress)/i },
    { key: "instagram", re: /(instagram|\binsta\b|\big[_-]?handle\b|\big\b)/i },
    {
      key: "threads",
      re: /(threads\.net|threads[_-\s]?(handle|username|profile)|(handle|username|profile)(\s+on)?\s+threads|(^|\|)\s*threads\s*(\||$))/i
    },
    { key: "bluesky", re: /(\bblue[_-\s]?sky\b|\bbsky\b|bsky\.app)/i },
    { key: "twitter", re: /(twitter|\bx[_-]?handle\b|\btwitter[_-]?handle\b)/i },
    { key: "tiktok", re: /tik[_-]?tok/i },
    { key: "facebook", re: /face[_-]?book/i },
    { key: "youtube", re: /you[_-]?tube/i },
    { key: "firstName", re: /(first[_-\s]?name|given[_-\s]?name|forename|\bfname\b|\bfirstname\b)/i },
    { key: "middleName", re: /(middle[_-\s]?name|additional[_-\s]?name|\bmname\b|\bmiddlename\b)/i },
    { key: "lastName", re: /(last[_-\s]?name|family[_-\s]?name|surname|\blname\b|\blastname\b)/i },
    { key: "nickname", re: /(preferred[_-\s]?name|display[_-\s]?name|screen[_-\s]?name|\bnickname\b)/i },
    { key: "phone", re: /(phone|mobile|cell|telephone|\btel\b)/i },
    { key: "address2", re: /(address[_-\s]?line[_-\s]?2|addr(?:ess)?[\s_-]?2|\bapt\.?\b|\bsuite\b|\bunit\b|\bapartment\b)/i },
    { key: "address1", re: /(street[_-\s]?address|address[_-\s]?line[_-\s]?1|addr(?:ess)?[_-]?1|\bstreet\b|\baddress\b)/i },
    { key: "city", re: /(\bcity\b|\btown\b)/i },
    { key: "state", re: /(^|[^a-z0-9])(state|province|region)($|[^a-z0-9])/i },
    { key: "zip", re: /(zip[_-\s]?code|postal|_zip\b|\bzip\b|post[_-\s]?code)/i },
    { key: "country", re: /\bcountry\b/i },
    { key: "birthday", re: /(birth[_-\s]?date|date[_-\s]?of[_-\s]?birth|\bdob\b|\bbirthday\b|\bbday\b)/i },
    { key: "age", re: /(^|[_-\s])age($|[_-\s])/i },
    { key: "gender", re: /(\bgender\b|\bsex\b)/i },
    { key: "company", re: /(company|organization|organisation|business[_-\s]?name)/i },
    { key: "website", re: /(website|web[_-\s]?site|\burl\b|homepage)/i },
    { key: "fullName", re: /(full[_-\s]?name|your[_-\s]?name|(^|[_-\s])name($|[_-\s]))/i }
  ];

  const MARKETING_RE =
    /(newsletter|marketing|promotions?|offers?|sign\s*up to receive|wish to receive|receive .{0,40}updates|email me|send me|third[-\s]?part|partners?|sms alerts?|text alerts?|unsubscribe|\bopt[_-]?in\b)/i;
  const AGREEMENT_RE =
    /(official\s*rules|terms\s*(and|&)\s*conditions|terms\s*of\s*(use|service)|sweepstakes|\bi agree\b|\bi agreed\b|\bi accept\b|i have read|i['’]ve read|agreed to|agree to (the|these)|eligibility|18\s*(years|or older)|over\s*18)/i;
  const CAPTCHA_RE =
    /(recaptcha|g-recaptcha|hcaptcha|h-captcha|turnstile|captcha|i['’]m not a robot|not a robot|characters seen in the picture|type the characters)/i;

  const SENSITIVE_RE =
    /(password|passwd|passcode|pass[_\s-]?phrase|new[_\s-]?pass|current[_\s-]?pass|card[_\s-]?number|cc[_\s-]?num|credit[_\s-]?card|cardholder|\bcvc\b|\bcvv2?\b|\bcid\b|\bcsc\b|\bssn\b|social[_\s-]?security|routing[_\s-]?number|account[_\s-]?number|\biban\b|\bswift\b|one[_\s-]?time[_\s-]?(code|password)|\botp\b|sms[_\s-]?otp|\btotp\b|authenticator)/i;

  const SKIP_TYPES = new Set([
    "password",
    "file",
    "hidden",
    "submit",
    "button",
    "reset",
    "image",
    "color",
    "range"
  ]);

  function norm(s) {
    return String(s || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function blobFromField(info) {
    return [
      info.autocomplete,
      info.name,
      info.id,
      info.placeholder,
      info.label,
      info.ariaLabel,
      info.value,
      info.groupLabel,
      info.type
    ]
      .map(norm)
      .filter(Boolean)
      .join(" | ");
  }

  function descriptiveBlob(info) {
    return [
      info.autocomplete,
      info.name,
      info.id,
      info.placeholder,
      info.label,
      info.ariaLabel,
      info.value,
      info.groupLabel
    ]
      .map(norm)
      .filter(Boolean)
      .join(" | ");
  }

  function classifyFromText(text) {
    const t = norm(text);
    if (!t) return null;
    for (const { key, re } of SEMANTIC_PATTERNS) {
      if (re.test(t)) return key;
    }
    return null;
  }

  function classifyAutocomplete(value) {
    const tokens = String(value || "")
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t && t !== "on" && t !== "off" && t !== "webauthn" && !t.startsWith("section-"));
    if (!tokens.length) return null;
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      if (AUTOCOMPLETE_MAP[tokens[i]]) return AUTOCOMPLETE_MAP[tokens[i]];
    }
    if (AUTOCOMPLETE_MAP[tokens.join(" ")]) return AUTOCOMPLETE_MAP[tokens.join(" ")];
    return null;
  }

  function classifyBirthdayPart(info) {
    const context = descriptiveBlob(info);
    if (!/(birth|\bdob\b|\bbday\b|\bdob[_-](?:m|d|y)\b)/i.test(context)) return null;
    const component = [info.autocomplete, info.name, info.id, info.placeholder, info.label, info.ariaLabel]
      .map(norm)
      .filter(Boolean)
      .join(" | ");
    if (/(^|[_\s-])month($|[_\s-])|\bmm\b|\bdob[_-]m\b/i.test(component)) return "birthdayMonth";
    if (/(^|[_\s-])day($|[_\s-])|\bdd\b|\bdob[_-]d\b/i.test(component)) return "birthdayDay";
    if (/(^|[_\s-])year($|[_\s-])|\byyyy\b|\bdob[_-]y\b/i.test(component)) return "birthdayYear";
    return null;
  }

  function classifyInputType(type) {
    const t = String(type || "").toLowerCase();
    if (t === "email") return "email";
    if (t === "tel") return "phone";
    if (t === "url") return "website";
    return null;
  }

  function normalizeSemantic(semantic) {
    const aliases = {
      "birthday-month": "birthdayMonth",
      "birthday-day": "birthdayDay",
      "birthday-year": "birthdayYear"
    };
    return aliases[semantic] || semantic || null;
  }

  function isBirthdayPartSemantic(semantic) {
    return /^birthday(Month|Day|Year)$/.test(normalizeSemantic(semantic) || "");
  }

  function selectOptionMatches(resolved, option) {
    const want = norm(resolved && resolved.value);
    const optionValue = norm(option && option.value);
    const optionText = norm(option && option.text);
    if (optionValue === want || optionText === want) return true;
    const semantic = normalizeSemantic(resolved && resolved.semantic);
    if (semantic === "state") {
      const regionCode = (value) => {
        const lower = norm(value).toLowerCase().replace(/\s+/g, " ");
        return REGION_CODES[lower] || (/^[a-z]{2}$/i.test(lower) ? lower.toUpperCase() : "");
      };
      const wantedCode = regionCode(want);
      return !!wantedCode && [optionValue, optionText].some((candidate) => regionCode(candidate) === wantedCode);
    }
    if (!isBirthdayPartSemantic(semantic) || !/^\d+$/.test(want)) return false;
    const wantedNumber = Number(want);
    if (
      (/^\d+$/.test(optionValue) && Number(optionValue) === wantedNumber) ||
      (/^\d+$/.test(optionText) && Number(optionText) === wantedNumber)
    ) {
      return true;
    }
    if (semantic !== "birthdayMonth" || wantedNumber < 1 || wantedNumber > 12) return false;
    const monthNames = [
      "january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december"
    ];
    const month = monthNames[wantedNumber - 1];
    return [optionValue, optionText].some((candidate) => {
      const lower = candidate.toLowerCase();
      return lower === month || lower === month.slice(0, 3);
    });
  }

  function isUiCheckbox(info) {
    const aria = norm(info.ariaLabel);
    const label = norm(info.label);
    const name = String(info.name || "").toLowerCase();
    const id = String(info.id || "").toLowerCase();
    const blob = [aria, label, name, id].join(" ");
    if (
      /^(select|select all|select all conversations|select conversation|select message|select row)$/i.test(aria) ||
      /^(select|select all)$/i.test(label)
    ) {
      return true;
    }
    if (/\b(select all conversations|select conversation|select message|star conversation|mark as (read|unread))\b/i.test(blob)) {
      return true;
    }
    if (/\b(select|star|important)\b/i.test(name) && !AGREEMENT_RE.test(blob)) return true;
    return false;
  }

  function checkboxRole(info) {
    if (isUiCheckbox(info)) return "ui";
    const text = [info.label, info.ariaLabel, info.value, info.name, info.id].map(norm).join(" ");
    if (!text) return "other";
    if (MARKETING_RE.test(text)) return "marketing";
    if (AGREEMENT_RE.test(text)) return "agreement";
    return "other";
  }

  function radioPersistValue(info, value) {
    if (value === false || value === "false" || value === "") return "";
    if (isCheckedValue(value) && String(value) !== String(info.value || "") && String(value).toLowerCase() !== "on") {
      return norm(info.label) || norm(info.value) || "true";
    }
    const raw = value == null || value === true || value === "true" ? info.value || info.label : value;
    if (info.label && (!raw || isVolatileToken(raw) || /^(on|true|false|\d+)$/i.test(String(raw)))) {
      return norm(info.label);
    }
    return norm(raw) || norm(info.label);
  }

  function radioMatches(info, resolved) {
    if (!resolved) return false;
    const candidates = [resolved.value, resolved.optionLabel, resolved.optionValue]
      .map((v) => norm(v).toLowerCase())
      .filter(Boolean);
    if (!candidates.length) return false;
    const here = [info.value, info.label].map((v) => norm(v).toLowerCase()).filter(Boolean);
    return here.some((h) => candidates.includes(h));
  }

  function isCheckedValue(value) {
    return value === true || value === "true" || value === "on";
  }

  function isVolatileToken(s) {
    return /\d{7,}/.test(String(s || ""));
  }

  function isSensitive(info) {
    if (String(info.type || "").toLowerCase() === "password") return true;
    const tokens = String(info.autocomplete || "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (
      tokens.some(
        (token) =>
          token.startsWith("cc-") ||
          token === "current-password" ||
          token === "new-password" ||
          token === "one-time-code" ||
          token.endsWith("-otp") ||
          token === "otp"
      )
    ) {
      return true;
    }
    return SENSITIVE_RE.test(blobFromField(info));
  }

  function isSearchField(info) {
    const type = String(info.type || "").toLowerCase();
    const role = String(info.role || "").toLowerCase();
    if (type === "search" || role === "searchbox") return true;
    if (info.inSearchForm) return true;
    const name = String(info.name || "").toLowerCase();
    const id = String(info.id || "").toLowerCase();
    if (/^(q|query|search|search_query|searchquery|keywords?)$/i.test(name)) return true;
    if (/^(q|query|search|search_query|gbqfq)$/i.test(id)) return true;
    const label = norm(info.label);
    if (label.length > 40 && /\?/.test(label)) return false;
    const hint = [info.placeholder, info.ariaLabel, label].map(norm).join(" ");
    if (/^(search|search mail|search the web)\b/i.test(norm(info.placeholder) || norm(info.ariaLabel) || label)) {
      return true;
    }
    if (/\b(search mail|search the web|search google|search bing|search outlook)\b/i.test(hint)) return true;
    return false;
  }

  function shouldSkip(info, settings) {
    const type = String(info.type || "text").toLowerCase();
    if (SKIP_TYPES.has(type) && type !== "hidden") return true;
    if (type === "hidden") return true;
    if (CAPTCHA_RE.test(blobFromField(info))) return true;
    if (type === "password" || isSensitive(info)) return true;
    if (!(settings && settings.fillSearchFields) && isSearchField(info)) return true;
    if (type === "checkbox" && isUiCheckbox(info)) return true;
    if (info.disabled || info.readOnly) return true;
    return false;
  }

  function siteKeys(info, semantic) {
    const keys = [];
    const kind = String(info.type || "").toLowerCase();
    const normalizedSemantic = normalizeSemantic(
      semantic || classifyAutocomplete(info.autocomplete) || classifyBirthdayPart(info)
    );
    if (isBirthdayPartSemantic(normalizedSemantic)) keys.push("dob:" + normalizedSemantic);
    const push = (prefix, raw, allowVolatile) => {
      const v = norm(raw);
      if (!v) return;
      if (!allowVolatile && isVolatileToken(v)) return;
      keys.push(prefix + (prefix.startsWith("label") || prefix.startsWith("aria") || prefix.startsWith("ph") ? v.toLowerCase() : v));
    };
    if (kind === "radio") {
      push("radioname:", info.groupName || info.name, false);
      push("radiogroup:", info.groupLabel, true);
      push("label:", info.label, true);
      return keys;
    }
    if (kind === "checkbox") {
      push("label:", info.label, true);
      push("aria:", info.ariaLabel, true);
      push("name:", info.name, false);
      push("id:", info.id, false);
      return keys;
    }
    push("name:", info.name, true);
    push("id:", info.id, true);
    push("ph:", info.placeholder, true);
    push("label:", info.label, true);
    push("aria:", info.ariaLabel, true);
    return keys;
  }

  function siteKey(info, semantic) {
    return siteKeys(info, semantic)[0] || "";
  }

  function fieldKind(info) {
    const type = String(info.type || "").toLowerCase();
    const tag = String(info.tag || "input").toLowerCase();
    if (tag === "select") return "select";
    if (tag === "textarea") return "text";
    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio";
    return "text";
  }

  function classify(info, settings) {
    const skip = shouldSkip(info, settings);
    const sensitive = isSensitive(info);
    const kind = fieldKind(info);
    const role = kind === "checkbox" ? checkboxRole(info) : null;
    const semantic =
      skip || kind === "checkbox" || kind === "radio"
        ? kind === "checkbox" && role === "agreement"
          ? "agreeToRules"
          : null
        : classifyAutocomplete(info.autocomplete) ||
          classifyBirthdayPart(info) ||
          classifyFromText(descriptiveBlob(info)) ||
          classifyInputType(info.type);
    const keys = siteKeys(info, semantic);
    return {
      skip,
      sensitive,
      semantic,
      siteKey: keys[0] || "",
      siteKeys: keys,
      kind,
      role
    };
  }

  function identityValue(identity, semantic) {
    if (!semantic || !identity) return "";
    const raw = identity[semantic];
    if (raw == null) return "";
    return String(raw).trim();
  }

  function semanticValuesEqual(semantic, left, right) {
    const a = String(left == null ? "" : left).trim();
    const b = String(right == null ? "" : right).trim();
    if (semantic === "email") return a.toLowerCase() === b.toLowerCase();
    if (semantic === "phone") return a.replace(/\D/g, "") === b.replace(/\D/g, "");
    return a === b;
  }

  function siteFieldKeyMatches(field, keys, kind) {
    const storedKeys = [field.key, ...(field.aliases || [])].filter(Boolean);
    if (kind === "radio") {
      const currentName = keys.find((key) => key.startsWith("radioname:"));
      const storedName = storedKeys.find((key) => key.startsWith("radioname:"));
      if (currentName && storedName) return currentName === storedName;
    }
    const currentName = keys.find((key) => key.startsWith("name:") && !isVolatileToken(key));
    const storedName = storedKeys.find((key) => key.startsWith("name:") && !isVolatileToken(key));
    const currentId = keys.find((key) => key.startsWith("id:") && !isVolatileToken(key));
    const storedId = storedKeys.find((key) => key.startsWith("id:") && !isVolatileToken(key));
    if (currentId && storedId) {
      if (currentId === storedId) return true;
      return false;
    }
    if (currentName && storedName) return currentName === storedName;
    return storedKeys.some((key) => keys.includes(key));
  }

  function lookupSiteValue(siteFields, keys, semantic, kind) {
    if (!Array.isArray(siteFields) || !keys || !keys.length) return null;
    const wantedSemantic = normalizeSemantic(semantic);
    return (
      siteFields.find((f) => {
        const keyMatches = siteFieldKeyMatches(f, keys, kind);
        const storedSemantic = normalizeSemantic(f.semantic);
        const semanticMatches = storedSemantic === wantedSemantic;
        const legacyBirthdayPart = isBirthdayPartSemantic(wantedSemantic) && storedSemantic === "birthday";
        return keyMatches && (semanticMatches || legacyBirthdayPart);
      }) || null
    );
  }

  function resolveValue(info, identity, siteFields, settings, cleared) {
    const meta = classify(info, settings);
    if (meta.skip) return { ...meta, value: "", source: null };

    if (meta.kind === "checkbox" && meta.role === "agreement") {
      const agreed = identityValue(identity, "agreeToRules");
      if (isCheckedValue(agreed)) return { ...meta, value: "true", source: "identity" };
    }

    const site = lookupSiteValue(siteFields, meta.siteKeys, meta.semantic, meta.kind);
    if (meta.kind === "radio") {
      if (site && radioMatches(info, site)) {
        return {
          ...meta,
          value: info.value || info.label || site.value,
          optionLabel: site.optionLabel || site.value,
          source: "site"
        };
      }
      return { ...meta, value: "", source: null };
    }

    if (isBirthdayPartSemantic(meta.semantic)) {
      if (cleared && cleared.birthday) return { ...meta, value: "", source: null };
      if (site && site.value !== undefined && site.value !== "") {
        return { ...meta, value: site.value, optionLabel: site.optionLabel, source: "site" };
      }
      const birthday = identityValue(identity, "birthday");
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
      if (match) {
        const part = { birthdayYear: match[1], birthdayMonth: match[2], birthdayDay: match[3] }[meta.semantic];
        return { ...meta, value: part || "", source: part ? "identity" : null };
      }
      return { ...meta, value: "", source: null };
    }

    if (meta.semantic && meta.kind !== "checkbox") {
      if (cleared && cleared[meta.semantic]) return { ...meta, value: "", source: null };
      if (site && site.override === true && site.value !== undefined && site.value !== "") {
        return { ...meta, value: site.value, optionLabel: site.optionLabel, source: "site" };
      }
      const value = identityValue(identity, meta.semantic);
      if (value) return { ...meta, value, source: "identity" };
      return { ...meta, value: "", source: null };
    }

    if (site && site.semantic && cleared && cleared[site.semantic]) {
      return { ...meta, value: "", source: null };
    }
    if (site && site.semantic && identityValue(identity, site.semantic)) {
      return { ...meta, value: identityValue(identity, site.semantic), source: "identity" };
    }
    if (site && site.value !== undefined && site.value !== "") {
      return { ...meta, value: site.value, optionLabel: site.optionLabel, source: "site" };
    }

    return { ...meta, value: "", source: null };
  }

  function learnFromField(info, value, identity, siteFields, settings, options) {
    const opts = options || {};
    const cleared = { ...(opts.cleared || {}) };
    const overwriteIdentity = !!opts.overwriteIdentity;
    const meta = classify(info, settings);
    const nextIdentity = { ...identity };
    const nextSite = Array.isArray(siteFields) ? siteFields.slice() : [];
    const trimmed = value == null ? "" : String(value);
    if (meta.skip || meta.sensitive) {
      return { identity: nextIdentity, siteFields: nextSite, cleared, learned: null };
    }
    if (trimmed === "" && meta.kind !== "checkbox") {
      return { identity: nextIdentity, siteFields: nextSite, cleared, learned: null };
    }
    if (meta.kind === "radio" && (value === false || value === "false")) {
      return { identity: nextIdentity, siteFields: nextSite, cleared, learned: null };
    }

    let learned = null;
    const checked = isCheckedValue(value);
    if (overwriteIdentity && isBirthdayPartSemantic(meta.semantic)) delete cleared.birthday;
    if (meta.kind === "checkbox" && meta.role === "agreement" && checked) {
      nextIdentity.agreeToRules = "true";
      delete cleared.agreeToRules;
      learned = { target: "identity", key: "agreeToRules", value: "true" };
    } else if (
      meta.semantic &&
      !isBirthdayPartSemantic(meta.semantic) &&
      (meta.kind === "text" || meta.kind === "select")
    ) {
      const existing = identityValue(identity, meta.semantic);
      const blocked = !!cleared[meta.semantic];
      const supportsSiteOverride = meta.semantic === "email" || meta.semantic === "phone";
      if ((!blocked || overwriteIdentity) && (!existing || (overwriteIdentity && !supportsSiteOverride))) {
        nextIdentity[meta.semantic] = trimmed;
        delete cleared[meta.semantic];
        learned = { target: "identity", key: meta.semantic, value: trimmed };
      }
    }

    const keys = meta.siteKeys || [];
    const existingIdx = keys.length
      ? nextSite.findIndex(
          (f) =>
            siteFieldKeyMatches(f, keys, meta.kind) ||
            (isBirthdayPartSemantic(meta.semantic) && normalizeSemantic(f.semantic) === normalizeSemantic(meta.semantic))
        )
      : -1;

    // Do not snapshot "unchecked" as a remembered value — that blocked Official
    // Rules boxes on later visits when the page used a new random field id.
    if (meta.kind === "checkbox" && !checked && existingIdx < 0) {
      return { identity: nextIdentity, siteFields: nextSite, cleared, learned };
    }

    if (keys.length) {
      const usualValue = meta.semantic ? identityValue(identity, meta.semantic) : "";
      const siteOverride =
        (meta.semantic === "email" || meta.semantic === "phone") &&
        meta.kind !== "checkbox" &&
        !!usualValue &&
        !semanticValuesEqual(meta.semantic, usualValue, trimmed);
      const rec = {
        key: keys[0],
        aliases: keys.slice(1),
        type: meta.kind,
        value: meta.kind === "checkbox" ? String(checked) : meta.kind === "radio" ? radioPersistValue(info, value) : trimmed,
        optionLabel: meta.kind === "radio" ? norm(info.label) : undefined,
        optionValue: meta.kind === "radio" ? norm(info.value) : undefined,
        semantic: meta.semantic || null,
        role: meta.role || null,
        label: info.label || info.placeholder || info.name || info.id || keys[0]
      };
      if (siteOverride) rec.override = true;
      if (existingIdx >= 0) nextSite[existingIdx] = rec;
      else nextSite.push(rec);
      if (!learned) learned = { target: "site", key: rec.key, value: rec.value };
    }

    return { identity: nextIdentity, siteFields: nextSite, cleared, learned };
  }

  root.FMMatcher = {
    AUTOCOMPLETE_MAP,
    SEMANTIC_PATTERNS,
    classify,
    classifyFromText,
    classifyAutocomplete,
    checkboxRole,
    radioPersistValue,
    radioMatches,
    isSensitive,
    isSearchField,
    isUiCheckbox,
    shouldSkip,
    siteKey,
    siteKeys,
    resolveValue,
    learnFromField,
    blobFromField,
    isCheckedValue,
    selectOptionMatches
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
