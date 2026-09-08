/* Open Autofill — the only durable writer. */
importScripts("shared.js", "matcher.js");
const enqueueMutation = FM.createSerialTaskQueue();
function isUI(sender) {
  return sender.id === chrome.runtime.id && ["src/options.html", "src/popup.html"].some(p => sender.url === chrome.runtime.getURL(p));
}
async function pageOrigin(sender, state) {
  if (sender.id !== chrome.runtime.id || !sender.tab || !Number.isInteger(sender.tab.id)) throw new Error("Unauthorized page");
  const tab = await chrome.tabs.get(sender.tab.id);
  const origin = FM.originFromUrl(sender.url);
  const tabOrigin = FM.originFromUrl(tab.url);
  if (!origin || !tabOrigin) throw new Error("Unauthorized page");
  if (sender.origin && sender.origin !== origin) throw new Error("Frame origin mismatch");
  if (!state.settings.consented || FM.isExcluded(state.settings, FM.hostFromUrl(tab.url)) || FM.isExcluded(state.settings, FM.hostFromUrl(sender.url))) {
    throw new Error("Form memory disabled on this page");
  }
  return origin;
}
async function readState(sender) {
  const state = await FM.loadStoredState();
  if (isUI(sender)) { const raw = await chrome.storage.local.get("recovery"); return {state:{...state,hasRecovery:!!raw.recovery}}; }
  const origin = await pageOrigin(sender, state);
  return {state:{...state, sites:{[origin]:state.sites[origin] || {forms:{}}}, legacySites:{}, hybridOrigins:{}, topHost: FM.hostFromUrl(tabUrl(sender))}};
}
function tabUrl(sender) {
  return sender && sender.tab && sender.tab.url ? sender.tab.url : "";
}
async function mutate(msg, sender) {
  const state = await FM.loadStoredState();
  if (msg.op === "learn") {
    const origin = await pageOrigin(sender,state);
    if (msg.epoch !== state.epoch) throw new Error("Stale edits discarded; reload the page");
    if (!state.settings.autoLearn && !msg.explicit) throw new Error("Automatic learning disabled");
    if (typeof msg.scope !== "string" || !msg.scope || msg.scope.length > 4000 || !Array.isArray(msg.edits) || msg.edits.length > 200) throw new Error("Invalid edits");
    const rec = state.sites[origin] || {forms:{}};
    let fields = rec.forms[msg.scope]?.fields || [];
    let saved = 0;
    for (const edit of msg.edits) {
      if (!FM.isRecord(edit.info) || !["string","boolean"].includes(typeof edit.value) || String(edit.value).length > 2000 || JSON.stringify(edit.info).length > 16000) throw new Error("Invalid edit");
      const learned = FMMatcher.learnFromField(edit.info, edit.value, state.identity, fields, state.settings, {cleared:state.cleared});
      fields = learned.siteFields; if (learned.learned) saved++;
    }
    rec.forms[msg.scope] = {fields, lastSaved:new Date().toISOString()};
    state.sites[origin] = rec; state.revision++;
    await chrome.storage.local.set(state);
    return {ok:true,saved,epoch:state.epoch};
  }
  if (!isUI(sender)) throw new Error("Unauthorized mutation");
  if (msg.op === "identity") {
    if (!FM.IDENTITY_FIELDS.some(f => f.key === msg.key) || typeof msg.value !== "string" || msg.value.length > 500) throw new Error("Invalid identity patch");
    state.identity[msg.key] = msg.value;
    if (msg.value) delete state.cleared[msg.key];
    else {
      state.cleared[msg.key] = true;
      state.sites = FM.stripSemanticFromSites(state.sites, msg.key);
      state.epoch += 1;
    }
  } else if (msg.op === "settings") {
    if (!FM.isRecord(msg.patch)) throw new Error("Invalid settings patch");
    state.settings = FM.normalizeBackupState({settings:{...state.settings,...msg.patch}}).settings;
  } else if (msg.op === "restore" || msg.op === "undo") {
    if (msg.confirmed !== true) throw new Error("Replacement confirmation required");
    const raw = await chrome.storage.local.get("recovery");
    const restored = FM.parseBackup(msg.op === "restore" ? msg.backup : raw.recovery);
    restored.epoch = state.epoch + 1; restored.revision = state.revision + 1;
    await chrome.storage.local.set({...restored,recovery:msg.op === "restore" ? FM.createBackup(state) : null});
    return {ok:true,epoch:restored.epoch,revision:restored.revision};
  } else if (msg.op === "discardRecovery") {
    await chrome.storage.local.set({recovery:null}); return {ok:true};
  } else if (msg.op === "forget") {
    if (typeof msg.origin !== "string") throw new Error("Invalid origin");
    delete state.sites[msg.origin]; delete state.legacySites[msg.origin]; state.epoch++;
  } else throw new Error("Unknown mutation");
  state.revision += 1;
  await chrome.storage.local.set(state);
  return {ok:true, epoch:state.epoch, revision:state.revision};
}
const MENU = {
  fill: "fm-fill",
  remember: "fm-remember",
  exclude: "fm-exclude",
  options: "fm-options"
};

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU.fill, title: "Fill this page", contexts: ["page", "editable"] });
    chrome.contextMenus.create({ id: MENU.remember, title: "Remember fields on this page", contexts: ["page", "editable"] });
    chrome.contextMenus.create({ id: MENU.exclude, title: "Never autofill this site", contexts: ["page"] });
    chrome.contextMenus.create({ id: MENU.options, title: "Open Autofill settings", contexts: ["action", "page"] });
  });

  await enqueueMutation(async () => { await chrome.storage.local.set(await FM.loadStoredState()); });
  // Page scripts must use the authorized worker rather than reading all identities/sites directly.
  if (chrome.storage.local.setAccessLevel) await chrome.storage.local.setAccessLevel({accessLevel:"TRUSTED_CONTEXTS"});
});

async function sendToActiveTab(type) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null || !isInjectable(tab.url)) {
    return { error: "This page cannot be filled (browser or store pages are blocked)." };
  }
  const merge = (results) => {
    const out = { filled: 0, saved: 0, host: FM.hostFromUrl(tab.url) };
    for (const item of results || []) {
      const r = item && item.result;
      if (!r) continue;
      if (r.error) return r;
      out.filled += Number(r.filled) || 0;
      out.saved += Number(r.saved) || 0;
    }
    return out;
  };
  const dispatch = () =>
    chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: (command) => (typeof globalThis.__oaCommand === "function" ? globalThis.__oaCommand(command) : null),
      args: [type]
    });
  try {
    return merge(await dispatch());
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["src/shared.js", "src/matcher.js", "src/content.js"]
      });
      return merge(await dispatch());
    } catch (err) {
      return { error: String(err && err.message ? err.message : err) };
    }
  }
}

function isInjectable(url) {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

async function excludeActiveHost() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return { error: "No active tab." };
  let host = "";
  try {
    host = new URL(tab.url).hostname.replace(/^www\./, "");
  } catch {
    return { error: "Could not read this site." };
  }
  await enqueueMutation(async () => {
    const state = await FM.loadStoredState();
    state.settings.excludedHosts = [...new Set([...state.settings.excludedHosts,host])];
    state.epoch++; state.revision++;
    await chrome.storage.local.set(state);
  });
  return { host, excluded: true };
}

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === MENU.fill) sendToActiveTab("fm.fill");
  else if (info.menuItemId === MENU.remember) sendToActiveTab("fm.remember");
  else if (info.menuItemId === MENU.exclude) excludeActiveHost();
  else if (info.menuItemId === MENU.options) chrome.runtime.openOptionsPage();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "fill-page") sendToActiveTab("fm.fill");
  if (command === "remember-page") sendToActiveTab("fm.remember");
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "fm.state") {
    enqueueMutation(() => readState(_sender)).then(sendResponse, e => sendResponse({error:e.message})); return true;
  }
  if (msg && msg.type === "fm.mutate") {
    enqueueMutation(() => mutate(msg, _sender)).then(sendResponse, e => sendResponse({error:e.message}));
    return true;
  }
  if (!msg || !msg.type || !isUI(_sender)) return;
  if (msg.type === "fm.fill") {
    sendToActiveTab("fm.fill").then(sendResponse);
    return true;
  }
  if (msg.type === "fm.remember") {
    sendToActiveTab("fm.remember").then(sendResponse);
    return true;
  }
  if (msg.type === "fm.exclude") {
    excludeActiveHost().then(sendResponse);
    return true;
  }
  if (msg.type === "fm.openOptions") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
  }
});
