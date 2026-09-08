/* Open Autofill — page script: inspect, fill, learn. */
(() => {
  if (window.__fieldMemoryLoaded) return;
  window.__fieldMemoryLoaded = true;

  const HIGHLIGHT = "fm-filled";
  const STYLE_ID = "fm-highlight-style";
  let lastFillCount = 0;
  let learning = false;
  let filling = false;
  const enqueueLearn = FM.createSerialTaskQueue();

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
      const named = aria
        .split(/\s+/)
        .map((idRef) => el.ownerDocument.getElementById(idRef))
        .filter(Boolean)
        .map((n) => n.innerText || n.textContent || "")
        .join(" ")
        .trim();
      if (named) return named;
    }
    return nearbyFieldLabel(el);
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

  function nearbyFieldLabel(el) {
    const prev = el.previousElementSibling;
    if (prev && !prev.querySelector("input, select, textarea, [role='checkbox'], [role='radio']")) {
      const text = FM.cleanNodeText(prev);
      if (text.length >= 2 && text.length <= 80) return text;
    }
    const parent = el.parentElement;
    if (parent && !/^(FORM|BODY|HTML|FIELDSET)$/.test(parent.tagName || "")) {
      const labeled = parent.querySelector(
        ":scope > label, :scope > legend, :scope > [class*='label'], :scope > [class*='Label']"
      );
      if (labeled && labeled !== el && !labeled.contains(el) && !el.contains(labeled)) {
        const text = FM.cleanNodeText(labeled);
        if (text.length >= 2 && text.length <= 80) return text;
      }
    }
    return "";
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

  function findBirthdayContext(el) {
    const isBirthdayText = (text) => /(date\s*of\s*birth|birth\s*date|\bbirthday\b|\bdob\b|\bbday\b)/i.test(text || "");
    const fieldset = el.closest("fieldset");
    if (fieldset) {
      const text = FM.cleanNodeText(fieldset.querySelector(":scope > legend"));
      if (isBirthdayText(text)) return text;
    }
    const group = el.closest('[role="group"]');
    if (group) {
      const text = (group.getAttribute("aria-label") || "").trim() || labelledByText(group);
      if (isBirthdayText(text)) return text.replace(/\s+/g, " ");
    }
    let node = el.parentElement;
    for (let i = 0; i < 6 && node; i += 1, node = node.parentElement) {
      if (/^(FORM|BODY|HTML)$/.test(node.tagName || "")) break;
      const heading = node.querySelector(
        ":scope > legend, :scope > label, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > [class*='question'], :scope > [class*='label']"
      );
      const text = FM.cleanNodeText(heading) || FM.cleanNodeText(node.querySelector(":scope > label"));
      if (isBirthdayText(text)) return text;
    }
    return "";
  }

  function nearbyConsentText(el) {
    const texts = [];
    const describedBy = el.getAttribute("aria-describedby");
    if (describedBy && el.ownerDocument) {
      texts.push(
        describedBy
          .split(/\s+/)
          .map((idRef) => el.ownerDocument.getElementById(idRef))
          .filter(Boolean)
          .map((node) => node.innerText || node.textContent || "")
          .join(" ")
      );
    }
    texts.push(el.getAttribute("aria-description") || "", el.getAttribute("title") || "");

    const next = el.nextElementSibling;
    if (next) texts.push(next.innerText || next.textContent || "");
    const prev = el.previousElementSibling;
    if (prev && !prev.querySelector("input, select, textarea, [role='checkbox'], [role='radio']")) {
      texts.push(prev.innerText || prev.textContent || "");
    }

    let node = el.parentElement;
    for (let i = 0; i < 3 && node && !/^(FORM|BODY|HTML)$/.test(node.tagName || ""); i += 1, node = node.parentElement) {
      const controls = Array.from(
        node.querySelectorAll("input, [role='checkbox'], [role='radio']")
      ).filter((control) => {
        const controlType = String(control.type || control.getAttribute("role") || "").toLowerCase();
        return controlType === "checkbox" || controlType === "radio";
      });
      if (controls.length === 1) texts.push(node.innerText || node.textContent || "");
    }

    return texts
      .map((text) => String(text || "").replace(/\s+/g, " ").trim())
      .filter((text) => text.length >= 8 && text.length <= 500)
      .sort((a, b) => b.length - a.length)[0] || "";
  }
  function isChecked(el) {
    // Native form state is authoritative even if ARIA decoration is stale.
    return el instanceof HTMLInputElement ? el.checked : el.getAttribute("aria-checked") === "true";
  }

  function inspect(el) {
    const tag = (el.tagName || "").toLowerCase();
    const role = (el.getAttribute("role") || "").toLowerCase();
    const type = (
      el.type ||
      (role === "checkbox" || role === "radio" ? role : tag === "textarea" ? "textarea" : tag === "select" ? "select" : "text")
    ).toLowerCase();
    let label = type === "radio" || type === "checkbox" ? optionLabel(el) : associatedLabel(el);
    const context = type === "checkbox" || type === "radio" ? nearbyConsentText(el) : "";
    if (type === "checkbox" || type === "radio") {
      label = FMMatcher.preferredCheckboxLabel(label, context);
    }
    const checked =
      type === "checkbox" || type === "radio"
        ? isChecked(el)
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
      groupLabel: type === "radio" ? findQuestion(el) : findBirthdayContext(el),
      context,
      disabled: !!el.disabled,
      readOnly: !!el.readOnly,
      required: !!(el.required || el.getAttribute("aria-required") === "true"),
      checked
    };
  }

  function collectFields(root = document) {
    const fields = Array.from(root.querySelectorAll("input, textarea, select, [role='checkbox']:not(input), [role='radio']:not(input)"));
    for (const host of root.querySelectorAll("*")) if (host.shadowRoot) fields.push(...collectFields(host.shadowRoot));
    return fields.filter(el => el.isConnected && isVisibleEnough(el));
  }
  function isVisibleEnough(el) {
    if (el.type === "hidden" || !el.isConnected || el.disabled || el.readOnly) return false;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height || !el.getClientRects().length) return false;
    for (let node = el; node; node = node.parentElement || node.getRootNode()?.host) {
      const style = getComputedStyle(node);
      if (node.hidden || node.inert || node.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility !== "visible" || Number(style.opacity) === 0 || style.contentVisibility === "hidden") return false;
    }
    return true;
  }
  function formScope(el) {
    const root = el.getRootNode(), form = el.form;
    const forms = Array.from(root.querySelectorAll("form")), hostPath = [];
    for (let host = root.host; host; host = host.getRootNode().host) hostPath.unshift(host.tagName + "#" + host.id + ":" + Array.from(host.parentNode.children).indexOf(host));
    return JSON.stringify([location.pathname,hostPath,form ? [form.id,form.name,new URL(form.action || location.href).pathname,forms.indexOf(form)] : "unowned"]);
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
  }

  function applyValue(el, resolved, highlight, force) {
    if (!resolved || resolved.skip) return false;
    // No answer is not an unchecked answer; saved false remains actionable.
    if (resolved.value === "" || resolved.value == null || resolved.suppressed) return false;
    if (!force && el.dataset.fmUserEdited === "1") return false;

    if (resolved.kind === "checkbox" || resolved.kind === "radio") {
      // ARIA alone describes appearance, not a widget's backing form state.
      // Only native checkable inputs have a safe, known activation behavior.
      if (!(el instanceof HTMLInputElement) || !["checkbox", "radio"].includes(el.type)) return false;
      const want = resolved.kind === "radio" ? FMMatcher.radioMatches(inspect(el), resolved) : FMMatcher.isCheckedValue(resolved.value);
      if (resolved.kind === "radio" && !want) return false;
      if (
        !force &&
        resolved.kind === "radio" &&
        collectFields(el.getRootNode()).some(
          (other) =>
            other.type === "radio" &&
            other.form === el.form &&
            other.name === el.name &&
            (other.checked || other.dataset.fmUserEdited === "1")
        )
      ) {
        return false;
      }
      const isOn = isChecked(el);
      if (isOn === want) return false;
      filling = true;
      try {
        // Activate from the current state: click-driven form libraries need
        // the click, and the browser supplies input/change exactly once.
        // Setting checked first would toggle it back to the wrong value.
        el.click();
        if (el.checked !== want) return false;
      } finally {
        filling = false;
      }
      if (highlight) el.classList.add(HIGHLIGHT);
      return true;
    }

    if (resolved.kind === "select") {
      if (!force && el.value !== "") return false;
      const options = Array.from(el.options || []);
      const match = options.find((o) => FMMatcher.selectOptionMatches(resolved, o));
      if (!match) return false;
      if (el.value === match.value) return false;
      filling = true;
      try {
        if (!setNativeValue(el, match.value)) return false;
        fire(el);
      } finally {
        filling = false;
      }
      if (highlight) el.classList.add(HIGHLIGHT);
      return true;
    }

    if (String(el.value || "") === String(resolved.value)) return false;
    if (!force && String(el.value || "").trim()) {
      // Don't clobber a value the page or user already put there.
      return false;
    }
    filling = true;
    try {
      if (!setNativeValue(el, resolved.value)) return false;
      fire(el);
    } finally {
      filling = false;
    }
    el.dataset.fmFilled = "1";
    if (highlight) el.classList.add(HIGHLIGHT);
    return true;
  }

  let epoch = 0;
  const snapshots = new Map();
  let lastError = "";
  function reportError(error) { lastError = error.message || String(error); console.warn("Open Autofill:", lastError); }

  async function fillPage(force) {
    const state = await FM.loadState();
    const host = FM.hostFromUrl(location.href);
    if (!host) return { filled: 0, host: "" };
    if (!state.settings.consented) return { filled: 0, host, disabled: true };
    if (FM.isExcluded(state.settings, host) || FM.isExcluded(state.settings, state.topHost)) {
      return { filled: 0, host, excluded: true };
    }
    if (!force && !state.settings.autoFill) return { filled: 0, host, disabled: true };

    ensureStyle();
    epoch = state.epoch;
    const site = state.sites[location.origin] || { forms: {} };
    let filled = 0;
    for (const el of collectFields()) {
      // Earlier field events may remove or hide later controls in this batch.
      if (!isVisibleEnough(el)) continue;
      const info = inspect(el);
      const resolved = FMMatcher.resolveValue(info, state.identity, site.forms[formScope(el)]?.fields || [], state.settings, state.cleared);
      if (resolved.skip) continue;
      if (!force && !FMMatcher.shouldFillResolvedValue(resolved)) continue;
      if (force && String(el.value || "").trim() && resolved.value) {
        delete el.dataset.fmUserEdited;
      }
      if (applyValue(el, resolved, state.settings.highlightFilled, force)) filled += 1;
    }
    lastFillCount = filled;
    return { filled, host };
  }

  async function sendSnapshot(snapshot, explicit = false) {
    return FM.mutate("learn", {epoch:snapshot.epoch, scope:snapshot.scope, edits:[{info:snapshot.info,value:snapshot.value}], explicit});
  }
  function currentLearnValue(el, info) {
    if (info.type === "checkbox") return !!info.checked;
    if (info.type === "radio") return info.checked ? FMMatcher.radioPersistValue(info, info.value) : "";
    return el.value;
  }

  async function rememberPage() {
    const state = await FM.loadState();
    const host = FM.hostFromUrl(location.href);
    if (!host) return { saved: 0, host: "" };
    if (!state.settings.consented) return { saved: 0, host, disabled: true };
    if (FM.isExcluded(state.settings, host) || FM.isExcluded(state.settings, state.topHost)) {
      return { saved: 0, host, excluded: true };
    }
    epoch = state.epoch;
    const byScope = new Map();
    for (const el of collectFields()) {
      const info = inspect(el);
      const value = currentLearnValue(el, info);
      const userEdited = el.dataset.fmUserEdited === "1" || snapshots.has(el);
      if (!FMMatcher.shouldRememberCurrentValue(info, value, state.identity, state.settings, { userEdited })) continue;
      const scope = formScope(el);
      const edits = byScope.get(scope) || [];
      edits.push({ info, value });
      byScope.set(scope, edits);
    }
    let saved = 0;
    for (const [scope, edits] of byScope) {
      const result = await FM.mutate("learn", { epoch, scope, edits, explicit: true });
      saved += result.saved || 0;
    }
    return { saved, host: location.origin };
  }
  function capture(event) {
    if (!event.isTrusted || filling || epoch === null) return;
    const el = event.composedPath()[0];
    if (!el?.matches?.("input,textarea,select,[role='checkbox'],[role='radio']") || !isVisibleEnough(el)) return;
    const info = inspect(el);
    if (info.type === "radio" && !info.checked) return;
    el.dataset.fmUserEdited = "1";
    const value = info.type === "checkbox" ? info.checked : info.type === "radio" ? FMMatcher.radioPersistValue(info,info.value) : el.value;
    const snapshot = {epoch, scope:formScope(el), info, value};
    snapshots.set(el,snapshot);
    enqueueLearn(() => sendSnapshot(snapshot)).catch(reportError);
  }
  let scheduled;
  const observed = new WeakSet();
  function observeRoots(root = document) {
    if (!observed.has(root)) {
      observed.add(root);
      new MutationObserver(() => {
        clearTimeout(scheduled);
        scheduled = setTimeout(() => { observeRoots(); fillPage(false).catch(reportError); },150);
      }).observe(root,{childList:true,subtree:true});
    }
    for (const el of root.querySelectorAll("*")) if (el.shadowRoot) observeRoots(el.shadowRoot);
  }
  function watch() {
    document.addEventListener("input",capture,true);
    document.addEventListener("change",capture,true);
    document.addEventListener("submit",event => {
      if (!event.isTrusted) return;
      for (const [el,snapshot] of snapshots) if (el.form === event.target) enqueueLearn(() => sendSnapshot(snapshot)).catch(reportError);
    },true);
    observeRoots();
    // Attaching an open root to an existing host does not emit a DOM mutation.
    setInterval(() => { observeRoots(); fillPage(false).catch(reportError); },1500);
  }

  function runCommand(type) {
    if (type === "fm.fill") return fillPage(true);
    if (type === "fm.remember") return enqueueLearn(() => rememberPage());
    if (type === "fm.ping") {
      return {
        ok: true,
        host: FM.hostFromUrl(location.href),
        lastFillCount,
        lastError,
        fields: collectFields().length
      };
    }
    return null;
  }
  globalThis.__oaCommand = (type) => runCommand(type);

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.type) return;
    const result = runCommand(msg.type);
    if (result && typeof result.then === "function") {
      result.then(sendResponse, e => sendResponse({error:e.message}));
      return true;
    }
    if (result) sendResponse(result);
  });

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
