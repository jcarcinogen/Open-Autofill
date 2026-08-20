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

  function inspect(el) {
    const tag = (el.tagName || "").toLowerCase();
    return {
      tag,
      type: (el.type || (tag === "textarea" ? "textarea" : tag === "select" ? "select" : "text")).toLowerCase(),
      name: el.name || "",
      id: el.id || "",
      placeholder: el.placeholder || "",
      autocomplete: el.getAttribute("autocomplete") || el.autocomplete || "",
      label: associatedLabel(el),
      ariaLabel: el.getAttribute("aria-label") || "",
      value: el.type === "checkbox" || el.type === "radio" ? el.getAttribute("value") || el.value || "" : "",
      disabled: !!el.disabled,
      readOnly: !!el.readOnly
    };
  }

  function collectFields(root) {
    const scope = root || document;
    const nodes = scope.querySelectorAll("input, textarea, select");
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

  function setNativeValue(el, value) {
    const tag = el.tagName;
    const proto =
      tag === "SELECT"
        ? window.HTMLSelectElement.prototype
        : tag === "TEXTAREA"
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
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
      if (el.checked === want) return false;
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
      if (String(el.value) !== String(resolved.value)) return false;
      if (el.checked) return false;
      el.checked = true;
      fire(el);
      if (highlight) el.classList.add(HIGHLIGHT);
      return true;
    }

    if (resolved.kind === "select") {
      const want = String(resolved.value);
      const options = Array.from(el.options || []);
      const match = options.find((o) => o.value === want) || options.find((o) => (o.text || "").trim() === want);
      if (!match) return false;
      if (el.value === match.value) return false;
      setNativeValue(el, match.value);
      fire(el);
      if (highlight) el.classList.add(HIGHLIGHT);
      return true;
    }

    if (String(el.value || "") === String(resolved.value)) return false;
    if (!force && String(el.value || "").trim() && el.dataset.fmFilled !== "1") {
      // Don't clobber a value the page or user already put there.
      return false;
    }
    setNativeValue(el, resolved.value);
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
      const resolved = FMMatcher.resolveValue(info, state.identity, site.fields, state.settings);
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
    let saved = 0;

    for (const el of collectFields()) {
      const info = inspect(el);
      const value = el.type === "checkbox" || el.type === "radio" ? (el.checked ? el.value || "true" : "") : el.value;
      if (el.type === "radio" && !el.checked) continue;
      if (el.type === "checkbox" && !el.checked) {
        const result = FMMatcher.learnFromField(info, false, identity, siteFields, state.settings);
        identity = result.identity;
        siteFields = result.siteFields;
        if (result.learned) saved += 1;
        continue;
      }
      if (el.type !== "checkbox" && !String(value || "").trim()) continue;
      const result = FMMatcher.learnFromField(info, value, identity, siteFields, state.settings);
      identity = result.identity;
      siteFields = result.siteFields;
      if (result.learned) saved += 1;
    }

    const sites = { ...state.sites, [host]: { fields: siteFields, lastSaved: new Date().toISOString() } };
    await FM.saveState({ identity, sites });
    return { saved, host };
  }

  function scheduleLearn(el) {
    if (!el || !el.matches || !el.matches("input, textarea, select")) return;
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
    const value = el.type === "checkbox" || el.type === "radio" ? el.checked : el.value;
    const siteFields = ((state.sites[host] && state.sites[host].fields) || []).slice();
    const result = FMMatcher.learnFromField(info, value, state.identity, siteFields, state.settings);
    if (!result.learned) return;
    const sites = { ...state.sites, [host]: { fields: result.siteFields, lastSaved: new Date().toISOString() } };
    learning = true;
    await FM.saveState({ identity: result.identity, sites });
    learning = false;
  }

  function watch() {
    document.addEventListener("change", (e) => scheduleLearn(e.target), true);
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
