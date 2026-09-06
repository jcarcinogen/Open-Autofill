const hostEl = document.getElementById("host");
const statusEl = document.getElementById("status");
const identityEl = document.getElementById("identity");
const autoFillEl = document.getElementById("autoFill");
document.getElementById("version").textContent = `v${chrome.runtime.getManifest().version}`;

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
  const consented = !!state.settings.consented;
  document.getElementById("consent").hidden = consented;
  document.getElementById("fill").disabled = !consented;
  document.getElementById("remember").disabled = !consented;
  autoFillEl.disabled = !consented;

  identityEl.innerHTML = "";
  if (!consented) return;
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
      input.type = field.key === "birthday" ? "date" : field.key === "email" ? "email" : field.key === "phone" ? "tel" : "text";
      if (field.key === "birthday") input.title = "ISO date: YYYY-MM-DD. Recognized form dates are formatted automatically.";
      input.placeholder = field.placeholder;
      input.value = state.identity[field.key] || "";
      const save = async () => {
        await FM.setIdentityValue(field.key, input.value.trim());
      };
      input.addEventListener("change", save);
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

autoFillEl.addEventListener("change", async () => { await FM.mutate("settings",{patch:{autoFill:autoFillEl.checked}}); });
document.getElementById("enableMemory").addEventListener("click", async () => {
  await FM.mutate("settings",{patch:{consented:true,autoFill:true,autoLearn:true}}); await render();
});
window.addEventListener("unhandledrejection",e=>{e.preventDefault();showStatus("Save failed: "+e.reason.message,true);});
render().catch(e=>showStatus(e.message,true));
