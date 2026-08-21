const hostEl = document.getElementById("host");
const statusEl = document.getElementById("status");
const identityEl = document.getElementById("identity");
const autoFillEl = document.getElementById("autoFill");

function showStatus(text, err) {
  statusEl.hidden = false;
  statusEl.textContent = text;
  statusEl.classList.toggle("err", !!err);
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function render() {
  const state = await FM.loadState();
  const tab = await activeTab();
  const host = tab && tab.url ? FM.hostFromUrl(tab.url) : "";
  hostEl.textContent = host || "This page cannot be filled";
  autoFillEl.checked = !!state.settings.autoFill;

  identityEl.innerHTML = "";
  for (const field of FM.IDENTITY_FIELDS) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const label = document.createElement("label");
    label.textContent = field.label;
    label.setAttribute("for", field.key);
    const input = document.createElement("input");
    input.id = field.key;
    if (field.type === "toggle") {
      input.type = "checkbox";
      input.checked = state.identity[field.key] === "true";
      input.addEventListener("change", async () => {
        await FM.setIdentityValue(field.key, input.checked ? "true" : "");
      });
    } else {
      input.type = field.key === "email" ? "email" : field.key === "phone" ? "tel" : "text";
      input.placeholder = field.placeholder;
      input.value = state.identity[field.key] || "";
      const save = async () => {
        await FM.setIdentityValue(field.key, input.value.trim());
        if (field.key === "firstName" || field.key === "lastName") {
          const current = await FM.loadState();
          const full = [current.identity.firstName, current.identity.lastName].filter(Boolean).join(" ");
          if (full && !current.identity.fullName) await FM.setIdentityValue("fullName", full);
        }
      };
      input.addEventListener("change", save);
      input.addEventListener("blur", save);
    }
    wrap.append(label, input);
    identityEl.append(wrap);
  }
}

document.getElementById("fill").addEventListener("click", async () => {
  const result = await chrome.runtime.sendMessage({ type: "fm.fill" });
  if (result && result.error) showStatus(result.error, true);
  else showStatus(`Filled ${result && result.filled != null ? result.filled : 0} field(s).`);
});

document.getElementById("remember").addEventListener("click", async () => {
  const result = await chrome.runtime.sendMessage({ type: "fm.remember" });
  if (result && result.error) showStatus(result.error, true);
  else {
    showStatus(`Remembered ${result && result.saved != null ? result.saved : 0} field(s) on ${result.host || "this site"}.`);
    render();
  }
});

document.getElementById("exclude").addEventListener("click", async () => {
  const result = await chrome.runtime.sendMessage({ type: "fm.exclude" });
  if (result && result.error) showStatus(result.error, true);
  else showStatus(`Won't autofill ${result.host}.`);
});

document.getElementById("options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

autoFillEl.addEventListener("change", async () => {
  const state = await FM.loadState();
  state.settings.autoFill = autoFillEl.checked;
  await FM.saveState({ settings: state.settings });
});

render();
