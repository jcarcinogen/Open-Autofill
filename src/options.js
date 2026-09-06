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
  document.getElementById("undoRestore").disabled = !state.hasRecovery;
  document.getElementById("discardRecovery").disabled = !state.hasRecovery;

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
      input.type = field.key === "birthday" ? "date" : field.key === "email" ? "email" : "text";
      if (field.key === "birthday") input.title = "ISO date: YYYY-MM-DD. Other forms are formatted automatically.";
      input.placeholder = field.placeholder;
      input.value = state.identity[field.key] || "";
      input.addEventListener("change", async () => {
        await FM.setIdentityValue(field.key, input.value.trim());
      });
    }
    identityEl.append(label, input);
  }

  sitesEl.innerHTML = "";
  const hosts = [...Object.keys(state.sites),...Object.keys(state.legacySites)].sort();
  if (!hosts.length) {
    sitesEl.innerHTML = "<p class='muted'>Nothing site-specific yet. Fill a form once and it will show up here.</p>";
    return;
  }
  for (const host of hosts) {
    const rec = state.sites[host] || state.legacySites[host];
    const fields = rec.forms ? Object.entries(rec.forms).flatMap(([scope,form]) => form.fields.map(f => ({...f,scope}))) : rec.fields;
    const box = document.createElement("article");
    box.className = "site";
    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = host + (rec.forms ? "" : " — legacy, inactive");
    const del = document.createElement("button");
    del.className = "danger";
    del.textContent = "Forget site";
    del.addEventListener("click", async () => {
      await FM.mutate("forget", {origin:host});
      render();
    });
    header.append(title, del);
    const list = document.createElement("ul");
    for (const field of fields || []) {
      const li = document.createElement("li");
      li.append(document.createTextNode(`${field.label || field.key}: ${field.blocked ? "Leave blank" : field.value}`));
      if (field.scope) li.title = "Form scope: " + field.scope;
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
    await FM.mutate("settings", {patch:{[id]:e.target.checked}});
  });
}

excludedEl.addEventListener("change", async () => {
  await FM.mutate("settings",{patch:{excludedHosts:excludedEl.value.split("\n").map(s=>s.trim()).filter(Boolean)}});
});

function setBackupStatus(text) {
  const el = document.getElementById("backupStatus");
  el.hidden = false;
  el.textContent = text;
}

let pendingBackup = null;
document.getElementById("export").addEventListener("click", async () => {
  try {
    const state = await FM.loadState(), backup = FM.createBackup(state);
    const filename = "open-autofill-backup-" + backup.exportedAt.replace(/[:.]/g,"-") + ".json";
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}));
    const a = document.createElement("a"); a.href=url; a.download=filename; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    setBackupStatus(`Saved ${filename}. Contains personal data; keep it private. Nothing uploaded.`);
  } catch(e) { setBackupStatus(e.message); }
});
document.getElementById("import").addEventListener("change", async e => {
  pendingBackup = null; document.getElementById("restorePreview").hidden = true;
  const file = e.target.files?.[0]; if (!file) return;
  try {
    if (file.size > FM.MAX_BACKUP_BYTES) throw new Error("Backup exceeds the 5 MB limit");
    const data = JSON.parse(await file.text()), state = FM.parseBackup(data);
    const forms = Object.values(state.sites).flatMap(s=>Object.values(s.forms));
    pendingBackup = data;
    document.getElementById("previewCounts").textContent = `${Object.values(state.identity).filter(Boolean).length} identity answers, ${Object.keys(state.sites).length} origins, ${forms.length} forms, ${forms.reduce((n,f)=>n+f.fields.length,0)} local answers, ${Object.keys(state.legacySites).length} inactive legacy sites. Replace all current identity, settings, clear markers and site memory? A recovery snapshot will be saved.`;
    document.getElementById("restorePreview").hidden = false;
    setBackupStatus("Preview only — nothing changed.");
  } catch(error) { setBackupStatus("Could not read backup: " + error.message); }
  e.target.value = "";
});
document.getElementById("cancelRestore").addEventListener("click",()=>{
  pendingBackup=null;document.getElementById("restorePreview").hidden=true;setBackupStatus("Restore cancelled. Nothing changed.");
});
document.getElementById("confirmRestore").addEventListener("click",async()=>{
  if (!pendingBackup) return;
  try {
    await FM.mutate("restore",{backup:pendingBackup,confirmed:true});
    pendingBackup=null;document.getElementById("restorePreview").hidden=true;
    setBackupStatus("Replaced current data. Undo restore is available. Reload form pages.");await render();
  } catch(e) { setBackupStatus(e.message); }
});
document.getElementById("undoRestore").addEventListener("click",async()=>{
  if (!confirm("Replace current data with the pre-restore recovery snapshot? Changes since restore will be lost.")) return;
  try { await FM.mutate("undo",{confirmed:true});setBackupStatus("Recovery restored. Reload form pages.");await render(); } catch(e) { setBackupStatus(e.message); }
});
document.getElementById("discardRecovery").addEventListener("click",async()=>{
  if (!confirm("Permanently delete the recovery snapshot? Undo restore will no longer be available.")) return;
  try { await FM.mutate("discardRecovery");setBackupStatus("Recovery snapshot deleted.");await render(); } catch(e) { setBackupStatus(e.message); }
});
window.addEventListener("unhandledrejection",e=>{e.preventDefault();setBackupStatus("Save failed: "+e.reason.message);});
render().catch(e=>setBackupStatus(e.message));
