/* Open Autofill — page script: inspect, fill, learn. */
(() => {
  if (window.__fieldMemoryLoaded) return;
  window.__fieldMemoryLoaded = true;

  const HIGHLIGHT = "fm-filled";
  const STYLE_ID = "fm-highlight-style";
  let lastFillCount = 0;
  let learning = false;
  let filling = false;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${HIGHLIGHT} {
        outline: 2px solid #4caf50 !important;
        outline-offset: 1px;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function associatedLabel(el) {
    if (el.labels && el.labels.length) {
      return Array.from(el.labels)
        .map((l) => l.innerText || l.textContent || "")
        .join(" ")
        .trim();
    }
    const id = el.id;
    if (id && el.ownerDocument) {
      const byFor = el.ownerDocument.querySelector(`label[for="${cssEscape(id)}"]`);
      if (byFor) return (byFor.innerText || byFor.textContent || "").trim();
    }
    const wrapped = el.closest("label");
    if (wrapped) return (wrapped.innerText || wrapped.textContent || "").trim();
    const aria = el.getAttribute("aria-labelledby");
    if (aria && el.ownerDocument) {
      return aria
        .split(/\s+/)
        .map((idRef) => el.ownerDocument.getElementById(idRef))
        .filter(Boolean)
        .map((n) => n.innerText || n.textContent || "")
        .join(" ")
        .trim();
    }
    return "";
  }

  function cssEscape(id) {
    if (window.CSS && CSS.escape) return CSS.escape(id);
    return String(id).replace(/"/g, '\\"');
  }

  function optionLabel(el) {
    const wrap = el.closest("label");
    if (wrap) {
      const text = (wrap.innerText || wrap.textContent || "").replace(/\s+/g, " ").trim();
      if (text && text.length <= 120) return text;
    }
    return associatedLabel(el);
  }

  function labelledByText(el) {
    const aria = el.getAttribute("aria-labelledby");
    if (!aria || !el.ownerDocument) return "";
    return aria
      .split(/\s+/)
      .map((idRef) => el.ownerDocument.getElementById(idRef))
      .filter(Boolean)
      .map((n) => (n.innerText || n.textContent || "").trim())
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  function findQuestion(el) {
    const fieldset = el.closest("fieldset");
    if (fieldset) {
      const legend = fieldset.querySelector(":scope > legend");
      const t = legend && (legend.innerText || legend.textContent || "").trim();
      if (t) return t.replace(/\s+/g, " ");
    }
    const group = el.closest('[role="radiogroup"], [role="group"]');
    if (group) {
      const named = (group.getAttribute("aria-label") || "").trim() || labelledByText(group);
      if (named) return named.replace(/\s+/g, " ");
    }
    let node = el.parentElement;
    for (let i = 0; i < 8 && node; i += 1, node = node.parentElement) {
      const heading = node.querySelector(
        ":scope > legend, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > p, :scope > [class*='question']"
      );
      if (heading && heading !== el && !heading.contains(el)) {
        const t = (heading.innerText || heading.textContent || "").replace(/\s+/g, " ").trim();
        if (t.length >= 8 && t.length <= 220) return t;
      }
      const prev = node.previousElementSibling;
      if (prev) {
        const t = (prev.innerText || prev.textContent || "").replace(/\s+/g, " ").trim();
        if (t.length >= 8 && t.length <= 220 && !prev.querySelector("input, select, textarea")) return t;
      }
    }
    return "";
  }

  function nearbyConsentText(el) {
    const next = el.nextElementSibling;
    if (next) {
      const t = (next.innerText || next.textContent || "").replace(/\s+/g, " ").trim();
      if (t.length >= 8 && t.length <= 220) return t;
    }
    const prev = el.previousElementSibling;
    if (prev && !prev.querySelector("input, select, textarea")) {
      const t = (prev.innerText || prev.textContent || "").replace(/\s+/g, " ").trim();
      if (t.length >= 8 && t.length <= 220) return t;
    }
    return "";
  }
  function inspect(el) {
    const tag = (el.tagName || "").toLowerCase();
    const role = (el.getAttribute("role") || "").toLowerCase();
    const type = (
      el.type ||
      (role === "checkbox" || role === "radio" ? role : tag === "textarea" ? "textarea" : tag === "select" ? "select" : "text")
    ).toLowerCase();
    let label = type === "radio" || type === "checkbox" ? optionLabel(el) : associatedLabel(el);
    if ((type === "checkbox" || type === "radio") && label.length < 12) {
      const nearby = nearbyConsentText(el);
      if (nearby.length > label.length) label = nearby;
    }
    const checked =
      type === "checkbox" || type === "radio"
        ? !!(el.checked || el.getAttribute("aria-checked") === "true")
        : false;
    return {
      tag,
      type,
      name: el.name || "",
      id: el.id || "",
      placeholder: el.placeholder || "",
      autocomplete: el.getAttribute("autocomplete") || el.autocomplete || "",
      label,
      ariaLabel: el.getAttribute("aria-label") || "",
      role,
      inSearchForm: !!(el.closest && el.closest('form[role="search"], [role="search"]')),
      value: type === "checkbox" || type === "radio" ? el.getAttribute("value") || el.value || "" : "",
      groupName: type === "radio" ? el.name || "" : "",
      groupLabel: type === "radio" ? findQuestion(el) : "",
      disabled: !!el.disabled,
      readOnly: !!el.readOnly,
      checked
    };
  }

  function collectFields(root) {
    const scope = root || document;
    const nodes = scope.querySelectorAll(
      "input, textarea, select, [role='checkbox']:not(input), [role='radio']:not(input)"
    );
    return Array.from(nodes).filter((el) => el.isConnected && isVisibleEnough(el));
  }

  function isVisibleEnough(el) {
    if (el.type === "hidden") return false;
    const view = el.ownerDocument.defaultView;
    const style = view && view.getComputedStyle(el);
    if (!style) return true;
    const hidden = style.display === "none" || style.visibility === "hidden";
    if (!hidden) return true;
    const type = String(el.type || "").toLowerCase();
    if (type !== "checkbox" && type !== "radio") return false;
    const label =
      el.closest("label") ||
      (el.id && el.ownerDocument.querySelector(`label[for="${cssEscape(el.id)}"]`));
    if (!label || !view) return false;
    const ls = view.getComputedStyle(label);
    return !!(ls && ls.display !== "none" && ls.visibility !== "hidden");
  }

  function valueFitsInput(el, value) {
    const type = String(el.type || "").toLowerCase();
    const v = String(value);
    if (type === "date") return /^\d{4}-\d{2}-\d{2}$/.test(v);
    if (type === "month") return /^\d{4}-\d{2}$/.test(v);
    if (type === "week") return /^\d{4}-W\d{2}$/i.test(v);
    if (type === "time") return /^\d{1,2}:\d{2}/.test(v);
    if (type === "datetime-local") return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v);
    if (type === "number" || type === "range") return v !== "" && !Number.isNaN(Number(v));
    if (el.pattern) {
      try {
        return new RegExp("^(?:" + el.pattern + ")$").test(v);
      } catch {
        return true;
      }
    }
    return true;
  }

  function setNativeValue(el, value) {
    if (!valueFitsInput(el, value)) return false;
    const tag = el.tagName;
    const proto =
      tag === "SELECT"
        ? window.HTMLSelectElement.prototype
        : tag === "TEXTAREA"
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    try {
      if (desc && desc.set) desc.set.call(el, value);
      else el.value = value;
    } catch {
      return false;
    }
    return true;
  }

  function fire(el) {
    el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: el.value, inputType: "insertText" }));
  }

  function applyValue(el, resolved, highlight, force) {
    if (!resolved || resolved.value === "" && resolved.kind !== "checkbox") return false;
    if (!force && el.dataset.fmUserEdited === "1") return false;

    if (resolved.kind === "checkbox") {
      const want = FMMatcher.isCheckedValue(resolved.value);
      const isOn = !!(el.checked || el.getAttribute("aria-checked") === "true");
      if (isOn === want) return false;
      filling = true;
      try {
        const label =
          el.closest("label") ||
          (el.id && el.ownerDocument.querySelector(`label[for="${cssEscape(el.id)}"]`));
        if (label) label.click();
        else el.click();
        if (el.checked !== want) {
          el.checked = want;
          fire(el);
        }
      } finally {
        filling = false;
      }
      if (highlight) el.classList.add(HIGHLIGHT);
      return true;
    }

    if (resolved.kind === "radio") {
      const info = inspect(el);
      if (!FMMatcher.radioMatches(info, resolved) && String(el.value) !== String(resolved.value)) return false;
      if (el.checked) return false;
      filling = true;
      try {
        const label =
          el.closest("label") ||
          (el.id && el.ownerDocument.querySelector(`label[for="${cssEscape(el.id)}"]`));
        if (label) label.click();
        else el.click();
        if (!el.checked) {
          el.checked = true;
          fire(el);
        }
      } finally {
        filling = false;
      }
      if (highlight) el.classList.add(HIGHLIGHT);
      return true;
    }

    if (resolved.kind === "select") {
      const want = String(resolved.value);
      const options = Array.from(el.options || []);
      const match = options.find((o) => o.value === want) || options.find((o) => (o.text || "").trim() === want);
      if (!match) return false;
      if (el.value === match.value) return false;
      if (!setNativeValue(el, match.value)) return false;
      fire(el);
      if (highlight) el.classList.add(HIGHLIGHT);
      return true;
    }

    if (String(el.value || "") === String(resolved.value)) return false;
    if (!force && String(el.value || "").trim() && el.dataset.fmFilled !== "1") {
      // Don't clobber a value the page or user already put there.
      return false;
    }
    if (!setNativeValue(el, resolved.value)) return false;
    fire(el);
    el.dataset.fmFilled = "1";
    if (highlight) el.classList.add(HIGHLIGHT);
    return true;
  }

  function markUserEdits() {
    document.addEventListener(
      "input",
      (e) => {
        const el = e.target;
        if (!el || !el.matches || !el.matches("input, textarea, select")) return;
        if (learning || filling) return;
        el.dataset.fmUserEdited = "1";
      },
      true
    );
  }

  async function fillPage(force) {
    const state = await FM.loadState();
    const host = FM.hostFromUrl(location.href);
    if (!host) return { filled: 0, host: "" };
    if (FM.isExcluded(state.settings, host)) return { filled: 0, host, excluded: true };
    if (!force && !state.settings.autoFill) return { filled: 0, host, disabled: true };

    ensureStyle();
    const site = state.sites[host] || { fields: [] };
    let filled = 0;
    for (const el of collectFields()) {
      const info = inspect(el);
      const resolved = FMMatcher.resolveValue(info, state.identity, site.fields, state.settings, state.cleared);
      if (force && String(el.value || "").trim() && resolved.value) {
        delete el.dataset.fmUserEdited;
      }
      if (applyValue(el, resolved, state.settings.highlightFilled, force)) filled += 1;
    }
    lastFillCount = filled;
    return { filled, host };
  }

  async function rememberPage() {
    const state = await FM.loadState();
    const host = FM.hostFromUrl(location.href);
    if (!host) return { saved: 0, host: "" };
    if (FM.isExcluded(state.settings, host)) return { saved: 0, host, excluded: true };

    let identity = { ...state.identity };
    let siteFields = ((state.sites[host] && state.sites[host].fields) || []).slice();
    let cleared = { ...(state.cleared || {}) };
    let saved = 0;

    for (const el of collectFields()) {
      const info = inspect(el);
      const value =
        info.type === "checkbox"
          ? info.checked
          : info.type === "radio"
            ? info.checked
              ? FMMatcher.radioPersistValue(info, info.value)
              : ""
            : el.value;
      if (info.type === "radio" && !info.checked) continue;
      if (info.type === "checkbox" && !info.checked) {
        const result = FMMatcher.learnFromField(info, false, identity, siteFields, state.settings, {
          overwriteIdentity: true,
          cleared
        });
        identity = result.identity;
        siteFields = result.siteFields;
        if (result.cleared) cleared = result.cleared;
        if (result.learned) saved += 1;
        continue;
      }
      if (info.type !== "checkbox" && !String(value || "").trim()) continue;
      const result = FMMatcher.learnFromField(info, value, identity, siteFields, state.settings, {
        overwriteIdentity: true,
        cleared
      });
      identity = result.identity;
      siteFields = result.siteFields;
      if (result.cleared) cleared = result.cleared;
      if (result.learned) saved += 1;
    }

    const sites = { ...state.sites, [host]: { fields: siteFields, lastSaved: new Date().toISOString() } };
    await FM.saveState({ identity, sites, cleared });
    return { saved, host };
  }

  function scheduleLearn(el) {
    if (!el || !el.matches || !el.matches("input, textarea, select, [role='checkbox'], [role='radio']")) return;
    window.setTimeout(() => {
      rememberField(el).catch(() => {});
    }, 50);
  }

  async function rememberField(el) {
    const state = await FM.loadState();
    if (!state.settings.autoLearn) return;
    const host = FM.hostFromUrl(location.href);
    if (!host || FM.isExcluded(state.settings, host)) return;
    const info = inspect(el);
    let value = el.value;
    if (info.type === "checkbox") value = info.checked;
    if (info.type === "radio") {
      if (!info.checked) return;
      value = FMMatcher.radioPersistValue(info, info.value);
    }
    const siteFields = ((state.sites[host] && state.sites[host].fields) || []).slice();
    const result = FMMatcher.learnFromField(info, value, state.identity, siteFields, state.settings, {
      overwriteIdentity: false,
      cleared: state.cleared
    });
    if (!result.learned) return;
    const sites = { ...state.sites, [host]: { fields: result.siteFields, lastSaved: new Date().toISOString() } };
    learning = true;
    await FM.saveState({ identity: result.identity, sites, cleared: result.cleared || state.cleared });
    learning = false;
  }

  function watch() {
    document.addEventListener("change", (e) => scheduleLearn(e.target), true);
    document.addEventListener(
      "click",
      (e) => {
        const el = e.target && e.target.closest && e.target.closest("[role='checkbox'], [role='radio']");
        if (el) scheduleLearn(el);
      },
      true
    );
    document.addEventListener(
      "blur",
      (e) => {
        const el = e.target;
        if (el && el.matches && el.matches("input, textarea")) scheduleLearn(el);
      },
      true
    );
    document.addEventListener(
      "submit",
      () => {
        rememberPage().catch(() => {});
      },
      true
    );

    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
          window.setTimeout(() => fillPage(false).catch(() => {}), 200);
          break;
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === "fm.fill") {
      fillPage(true).then(sendResponse);
      return true;
    }
    if (msg.type === "fm.remember") {
      rememberPage().then(sendResponse);
      return true;
    }
    if (msg.type === "fm.ping") {
      sendResponse({
        ok: true,
        host: FM.hostFromUrl(location.href),
        lastFillCount,
        fields: collectFields().length
      });
      return;
    }
  });

  markUserEdits();
  watch();
  const retryMs = [0, 400, 1200, 2800];
  FM.loadState()
    .then((state) => {
      const delay = Number(state.settings.fillDelayMs);
      const first = Number.isFinite(delay) ? Math.max(0, delay) : 120;
      window.setTimeout(() => fillPage(false).catch(() => {}), first);
      retryMs.forEach((ms) => {
        if (ms === 0) return;
        window.setTimeout(() => fillPage(false).catch(() => {}), first + ms);
      });
    })
    .catch(() => {
      retryMs.forEach((ms) => window.setTimeout(() => fillPage(false).catch(() => {}), ms));
    });
})();
