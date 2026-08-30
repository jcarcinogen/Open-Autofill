/* Open Autofill — service worker. */
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

  const existing = await chrome.storage.local.get(["settings", "identity", "sites"]);
  const patch = {};
  if (!existing.settings) {
    patch.settings = {
      autoFill: true,
      autoLearn: true,
      highlightFilled: true,
      skipPasswords: true,
      skipPaymentAndSsn: true,
      fillDelayMs: 150,
      excludedHosts: [],
      consented: false
    };
  }
  if (!existing.identity) {
    patch.identity = {
      email: "",
      firstName: "",
      middleName: "",
      lastName: "",
      fullName: "",
      nickname: "",
      phone: "",
      address1: "",
      address2: "",
      city: "",
      state: "",
      zip: "",
      country: "",
      instagram: "",
      threads: "",
      bluesky: "",
      twitter: "",
      tiktok: "",
      facebook: "",
      youtube: "",
      birthday: "",
      age: "",
      gender: "",
      company: "",
      website: ""
    };
  }
  if (!existing.sites) patch.sites = {};
  if (Object.keys(patch).length) await chrome.storage.local.set(patch);
});

async function sendToActiveTab(type) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null || !isInjectable(tab.url)) {
    return { error: "This page cannot be filled (browser or store pages are blocked)." };
  }
  try {
    return await chrome.tabs.sendMessage(tab.id, { type });
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["src/shared.js", "src/matcher.js", "src/content.js"]
      });
      return await chrome.tabs.sendMessage(tab.id, { type });
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
  const raw = await chrome.storage.local.get("settings");
  const settings = raw.settings || {};
  const excluded = new Set(settings.excludedHosts || []);
  excluded.add(host);
  settings.excludedHosts = Array.from(excluded);
  await chrome.storage.local.set({ settings });
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
  if (!msg || !msg.type) return;
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
