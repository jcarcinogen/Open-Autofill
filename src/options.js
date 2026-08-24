const identityEl = document.getElementById("identity");
const sitesEl = document.getElementById("sites");
const excludedEl = document.getElementById("excluded");
document.getElementById("version").textContent = `v${chrome.runtime.getManifest().version}`;

const SETTING_IDS = ["autoFill", "autoLearn", "highlightFilled", "skipPasswords", "skipPaymentAndSsn", "fillSearchFields"];

async function render() {
  const state = await FM.loadState();
  for (const id of SETTING_IDS) {
    document.getElementById(id).checked = !!state.settings[id];
  }
  excludedEl.value = (state.settings.excludedHosts || []).join("\n");

  identityEl.innerHTML = "";
  for (const field of FM.IDENTITY_FIELDS) {
    const label = document.createElement("label");
    label.textContent = field.label;
    label.setAttribute("for", "opt-" + field.key);
    const input = document.createElement("input");
    input.id = "opt-" + field.key;
    if (field.type === "toggle") {
      input.type = "checkbox";
      input.checked = state.identity[field.key] === "true";
      input.addEventListener("change", async () => {
        await FM.setIdentityValue(field.key, input.checked ? "true" : "");
      });
    } else {
      input.type = field.key === "email" ? "email" : "text";
      input.placeholder = field.placeholder;
      input.value = state.identity[field.key] || "";
      input.addEventListener("change", async () => {
        await FM.setIdentityValue(field.key, input.value.trim());
      });
    }
    identityEl.append(label, input);
  }

  sitesEl.innerHTML = "";
  const hosts = Object.keys(state.sites).sort();
  if (!hosts.length) {
    sitesEl.innerHTML = "<p class='muted'>Nothing site-specific yet. Fill a form once and it will show up here.</p>";
    return;
  }
  for (const host of hosts) {
    const rec = state.sites[host] || { fields: [] };
    const box = document.createElement("article");
    box.className = "site";
    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = host;
    const del = document.createElement("button");
    del.className = "danger";
    del.textContent = "Forget site";
    del.addEventListener("click", async () => {
      const current = await FM.loadState();
      delete current.sites[host];
      await FM.saveState({ sites: current.sites });
      render();
    });
    header.append(title, del);
    const list = document.createElement("ul");
    for (const field of rec.fields || []) {
      const li = document.createElement("li");
      li.append(document.createTextNode(`${field.label || field.key}: ${field.value}`));
      if (field.override === true) {
        const badge = document.createElement("span");
        badge.className = "override-badge";
        badge.textContent = "Site override";
        li.append(document.createTextNode(" "), badge);
      }
      list.append(li);
    }
    if (!list.childElementCount) {
      const li = document.createElement("li");
      li.textContent = "No extra fields stored.";
      list.append(li);
    }
    box.append(header, list);
    sitesEl.append(box);
  }
}

for (const id of SETTING_IDS) {
  document.getElementById(id).addEventListener("change", async (e) => {
    const state = await FM.loadState();
    state.settings[id] = e.target.checked;
    await FM.saveState({ settings: state.settings });
  });
}

excludedEl.addEventListener("change", async () => {
  const state = await FM.loadState();
  state.settings.excludedHosts = excludedEl.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  await FM.saveState({ settings: state.settings });
});

function setBackupStatus(text) {
  const el = document.getElementById("backupStatus");
  el.hidden = false;
  el.textContent = text;
}

document.getElementById("export").addEventListener("click", async () => {
  const state = await FM.loadState();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "open-autofill-backup.json";
  a.click();
  URL.revokeObjectURL(url);
  const sites = Object.keys(state.sites || {}).length;
  setBackupStatus(`Saved open-autofill-backup.json on this computer. ${sites} site(s). Nothing was uploaded.`);
});

document.getElementById("import").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await FM.saveState({
      settings: { ...FM.DEFAULT_SETTINGS, ...(data.settings || {}) },
      identity: { ...FM.emptyIdentity(), ...(data.identity || {}) },
      sites: data.sites || {}
    });
    const sites = Object.keys(data.sites || {}).length;
    setBackupStatus(`Imported “${file.name}” from disk. ${sites} site(s). Nothing was uploaded.`);
    render();
  } catch (err) {
    setBackupStatus("Could not read that file. It needs to be an Open Autofill JSON export.");
  }
  e.target.value = "";
});

render();
