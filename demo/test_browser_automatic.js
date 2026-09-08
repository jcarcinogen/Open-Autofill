/* Real MV3 integration checks. Temporary profile and fake local forms only. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const repo = path.resolve(__dirname, '..');
const failures = [];
let passed = 0;
const html = `<!doctype html><html><head><title>Local form QA</title><style>label{display:block;margin:8px}input,select{min-height:24px}</style></head><body>
<form id="primary" action="/done"><label>First name <input id="first" name="firstName" autocomplete="given-name"></label>
<label>Email <input id="email" name="email" type="email" autocomplete="email"></label>
<label>Favorite flavor <input id="extra" name="flavor"></label>
<label>Favorite fruit <input id="race" name="fruit"></label>
<label><input id="news" name="news" type="checkbox">Send me product news</label>
<fieldset><legend>Preferred color</legend><label><input id="red" type="radio" name="color" value="red">Red</label><label><input id="blue" type="radio" name="color" value="blue">Blue</label></fieldset>
<label>Preferred size <select id="size" name="size"><option value="">Choose</option><option value="s">Small</option><option value="l">Large</option></select></label>
<button type="submit">Submit local form</button></form>
<form id="secondary"><label>Favorite flavor <input id="other-extra" name="flavor"></label></form>
<div style="display:none"><label>Email <input id="hidden-email" autocomplete="email"></label></div>
<label>Password <input id="secret" type="password"></label>
<label>Security code <input id="otp" autocomplete="one-time-code"></label>
<label>Search <input id="search" type="search"></label>
<label><input id="captcha" type="checkbox" checked>I'm not a robot</label>
<script>document.querySelector('form').addEventListener('submit', e=>e.preventDefault());</script></body></html>`;
const dateHtml = `<!doctype html><html><body>
<label>Birthday (MM/DD/YYYY)<input id="us" autocomplete="bday" placeholder="MM/DD/YYYY"></label>
<label>Birthday (DD/MM/YYYY)<input id="eu" autocomplete="bday" placeholder="DD/MM/YYYY"></label>
<label>Birthday<input id="iso" type="date" autocomplete="bday"></label>
<fieldset><legend>Date of birth</legend><label>Month<select id="dob_m" name="dob_m"><option value="">Month</option>${['January','February','March','April','May','June','July','August','September','October','November','December'].map((m,i)=>`<option value="${i}">${m}</option>`).join('')}</select></label>
<label>Day<select id="dob_d" name="dob_d"><option value="">Day</option><option value="17">17</option></select></label><label>Year<select id="dob_y" name="dob_y"><option value="">Year</option><option value="1990">1990</option></select></label></fieldset>
<label>ZIP Required *<input id="zip" type="tel" name="zip"></label></body></html>`;
let remoteOrigin = '';
const activationHtml = `<!doctype html><html><body>
<form id="activation"><label><input id="rules" name="rules" type="checkbox" required>I agree to the Official Rules and Privacy Policy</label>
<button>Validate locally</button><output id="result"></output></form>
<script>
// Model the click-driven state used by controlled checkbox form libraries.
window.accepted = false;
window.events = [];
if (location.search === '?aria') document.querySelector('#rules').setAttribute('aria-checked','true');
if (location.search === '?cancel') document.querySelector('#rules').addEventListener('click',event=>event.preventDefault());
for (const type of ['click', 'input', 'change']) document.addEventListener(type, event => {
  if (event.target.id !== 'rules') return;
  events.push({type, checked: event.target.checked});
  if (type === 'click') accepted = event.target.checked;
});
document.querySelector('form').addEventListener('submit', event => {
  event.preventDefault();
  document.querySelector('#result').textContent = accepted ? 'Accepted' : 'Required field';
});
</script></body></html>`;
function server() { const s = http.createServer((req,res)=> { res.setHeader('Content-Type','text/html');
 let body = html;
 if(req.url.startsWith('/activation')) body=activationHtml;
 if(req.url.startsWith('/rerender')) body=`<!doctype html><body>
<label>Email<input id="trigger" autocomplete="email"></label>
<label>Email<input id="removed" autocomplete="email"></label>
<label id="section"><input id="hidden" type="checkbox" required>I agree to the Official Rules</label>
<label>Email<input id="disabled" autocomplete="email"></label>
<label>Email<input id="readonly" autocomplete="email"></label>
<script>
window.later=['removed','hidden','disabled','readonly'].map(id=>document.getElementById(id));
window.laterEvents=[];
later.forEach(el=>['click','input','change'].forEach(type=>el.addEventListener(type,()=>laterEvents.push(el.id+':'+type))));
document.querySelector('#trigger').addEventListener('input',()=>{
 later[0].remove(); document.querySelector('#section').hidden=true; later[2].disabled=true; later[3].readOnly=true;
});
</script></body>`;
 if(req.url.startsWith('/unsaved-checkbox')) body=`<!doctype html><body>
<label><input id="optional" type="checkbox" checked>Send me product news</label>
<label><input id="eligible" type="checkbox" checked>I am age 18 or older</label></body>`;
 if(req.url.startsWith('/custom-check')) body=`<!doctype html><body><form>
<div role="checkbox" aria-checked="false" aria-required="true" aria-label="I agree to the Official Rules and Privacy Policy" tabindex="0">Agree</div>
<button role="checkbox" aria-checked="false" aria-label="I agree to the Official Rules and Privacy Policy">Agree</button>
</form><script>window.submits=0;document.querySelector('form').addEventListener('submit',event=>{event.preventDefault();submits++;});</script></body>`;
 if(req.url.startsWith('/dates')) body=dateHtml;
 if(req.url.startsWith('/frames')) body=`<!doctype html><body><iframe title="same" src="/form"></iframe><iframe title="cross" src="${remoteOrigin}/form"></iframe></body>`;
 if(req.url.startsWith('/obfuscated')) body=`<!doctype html><html><body>
<div class="wl_label">F\u200bir\u200bst \u200bN\u200bam\u200be*</div><input id="hw-first" name="ctl00$body_content$f" placeholder="F i r s t   N a m e">
<div class="wl_label">E\u200bma\u200bil*</div><input id="hw-email" name="ctl00$body_content$e" placeholder="E m a i l">
<label>Location <select id="venue" name="venue"><option value="">Choose</option><option value="renton">WA - Seattle - Renton</option></select></label>
<label><input id="age" type="checkbox">By clicking Submit, I acknowledge that I am 18 or over and agree to the Official Rules.</label>
</body></html>`;
 if(req.url.startsWith('/dynamic')) body=`<!doctype html><body><div id="host"></div><script>setTimeout(()=>{const root=document.querySelector('#host').attachShadow({mode:'open'});root.innerHTML='<label>Email<input id="shadow-email" autocomplete="email"></label><label>Favorite flavor<input id="shadow-extra" name="flavor"></label>';},200);</script></body>`;
 if(req.url.startsWith('/defaults')) body=`<!doctype html><body><label>Email<input id="default-email" autocomplete="email" value="page@example.com"></label><label>State<select id="state" autocomplete="address-level1"><option value="NY" selected>New York</option><option value="IL">Illinois</option></select></label></body>`;
 res.end(body);
 }); return new Promise(resolve=>s.listen(0,'127.0.0.1',()=>resolve(s))); }
async function check(name, fn) { try { await fn(); passed++; console.log('PASS',name); } catch(e) { failures.push({name,error:e.message}); console.error('FAIL',name,e.message); } }
async function eventually(fn, expected, message) { let last; for(let i=0;i<50;i++){last=await fn();if(JSON.stringify(last)===JSON.stringify(expected))return;await new Promise(r=>setTimeout(r,100));} assert.deepEqual(last,expected,message); }
(async()=>{
 const servers = await Promise.all([server(),server()]);
 const base = servers.map(s=>`http://127.0.0.1:${s.address().port}`);
 remoteOrigin=base[1];
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'open-autofill-automatic-'));
 let context;
 try {
 context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${repo}`,`--load-extension=${repo}`]});
 const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
 const extensionId=new URL(worker.url()).host;
 const opts=await context.newPage();await opts.goto(`chrome-extension://${extensionId}/src/options.html`);
 const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 const identity=await opts.evaluate(()=>({...FM.emptyIdentity(),firstName:'Alex',email:'you@example.com',birthday:'1990-02-17',zip:'62701'}));
 // QA setup writes fake data only inside the disposable extension profile.
 await opts.evaluate(async identity=>{await chrome.storage.local.clear();await chrome.storage.local.set({settings:{...FM.DEFAULT_SETTINGS,consented:true},identity,sites:{},cleared:{}});},identity);
 const page=await context.newPage();
 const go=async(url=base[0]+'/form')=>{await page.goto(url);await page.waitForTimeout(650);};
 const edit=async(sel,value)=>{await page.locator(sel).fill(value);await page.locator(sel).press('Tab');await page.waitForTimeout(350);};
 const storedIdentity=()=>opts.evaluate(async()=> (await chrome.storage.local.get('identity')).identity);
 const pageCommand=type=>opts.evaluate(async({url,type})=>{const tabs=await chrome.tabs.query({});const tab=tabs.find(t=>t.url===url);return chrome.tabs.sendMessage(tab.id,{type},{frameId:0});},{url:page.url(),type});
 await check('new pages autofill usual answers without trust or teaching',async()=>{await go();await eventually(()=>page.locator('#email').inputValue(),identity.email);assert.equal(await page.locator('#first').inputValue(),'Alex');});
 await check('real name and email corrections replay locally and never change global answers',async()=>{await edit('#first','Jordan');await edit('#email','local@example.com');await page.reload();await page.waitForTimeout(700);assert.equal(await page.locator('#first').inputValue(),'Jordan');assert.equal(await page.locator('#email').inputValue(),'local@example.com');assert.deepEqual(await storedIdentity(),identity);});
 await check('a separate origin still receives global answers',async()=>{await go(base[1]+'/form');assert.equal(await page.locator('#first').inputValue(),'Alex');assert.equal(await page.locator('#email').inputValue(),identity.email);});
 await check('ordinary extra answers automatically persist for repeat visits',async()=>{await go();await edit('#extra','Vanilla');await page.reload();await page.waitForTimeout(700);assert.equal(await page.locator('#extra').inputValue(),'Vanilla');});
 await check('current user correction survives automatic retries and DOM changes',async()=>{await edit('#extra','Vanilla');await page.evaluate(()=>document.body.append(document.createElement('div')));await page.waitForTimeout(1300);assert.equal(await page.locator('#extra').inputValue(),'Vanilla');});
 await check('captured trusted input is not replaced by a later page-script value',async()=>{await page.evaluate(()=>document.querySelector('#race').addEventListener('input',e=>{e.target.value='Script replacement';},{once:true}));await page.locator('#race').fill('Peach');await page.waitForTimeout(500);await page.reload();await page.waitForTimeout(650);assert.equal(await page.locator('#race').inputValue(),'Peach');});
 await check('same-name question in a separate form does not inherit the correction',async()=>{assert.equal(await page.locator('#other-extra').inputValue(),'');});
 await check('empty correction suppresses old answer after reload',async()=>{await edit('#extra','');await page.reload();await page.waitForTimeout(700);assert.equal(await page.locator('#extra').inputValue(),'');});
 await check('cleared identity input remains blank locally, global value remains intact',async()=>{await edit('#email','');await page.reload();await page.waitForTimeout(700);assert.equal(await page.locator('#email').inputValue(),'');assert.deepEqual(await storedIdentity(),identity);});
 await check('checkbox checked and unchecked choices are remembered',async()=>{await page.locator('#news').check();await page.waitForTimeout(350);await page.reload();await page.waitForTimeout(650);assert.equal(await page.locator('#news').isChecked(),true);await page.locator('#news').uncheck();await page.waitForTimeout(350);await page.reload();await page.waitForTimeout(650);assert.equal(await page.locator('#news').isChecked(),false);});
 await check('latest radio selection wins after replay',async()=>{await page.locator('#red').check();await page.waitForTimeout(300);await page.locator('#blue').check();await page.waitForTimeout(350);await page.reload();await page.waitForTimeout(650);assert.equal(await page.locator('#blue').isChecked(),true);assert.equal(await page.locator('#red').isChecked(),false);});
 await check('real native dropdown input replays its raw value',async()=>{await page.locator('#size').focus();await page.keyboard.press('l');await page.keyboard.press('Tab');await page.waitForTimeout(350);assert.equal(await page.locator('#size').inputValue(),'l');await page.reload();await page.waitForTimeout(650);assert.equal(await page.locator('#size').inputValue(),'l');});
 await check('synthetic events and submit do not harvest unrelated fields or mutate identity',async()=>{await page.evaluate(()=>{let e=document.querySelector('#other-extra');e.value='Script injected';e.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#first').value='Page Person';document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});await page.waitForTimeout(400);assert.deepEqual(await storedIdentity(),identity);await page.reload();await page.waitForTimeout(650);assert.equal(await page.locator('#other-extra').inputValue(),'');assert.notEqual(await page.locator('#first').inputValue(),'Page Person');});
 await check('hidden, password, OTP and search fields remain untouched',async()=>{for(const id of ['hidden-email','secret','otp','search'])assert.equal(await page.locator('#'+id).inputValue(),'');});
 await check('explicit Fill cannot modify skipped checkboxes or secrets',async()=>{await pageCommand('fm.fill');assert.equal(await page.locator('#captcha').isChecked(),true);for(const id of ['secret','otp','search'])assert.equal(await page.locator('#'+id).inputValue(),'');});
 await check('Remember snapshots extras without rewriting usual answers',async()=>{await page.evaluate(()=>{document.querySelector('#other-extra').value='Untouched default';});await pageCommand('fm.remember');assert.deepEqual(await storedIdentity(),identity);await page.reload();await page.waitForTimeout(650);assert.equal(await page.locator('#other-extra').inputValue(),'Untouched default');});
 await check('birthday formats, native date and zero-based month dropdown fill correctly',async()=>{await go(base[0]+'/dates');assert.equal(await page.locator('#us').inputValue(),'02/17/1990');assert.equal(await page.locator('#eu').inputValue(),'17/02/1990');assert.equal(await page.locator('#iso').inputValue(),'1990-02-17');assert.equal(await page.locator('#dob_m').inputValue(),'1');assert.equal(await page.locator('#dob_d').inputValue(),'17');assert.equal(await page.locator('#dob_y').inputValue(),'1990');assert.equal(await page.locator('#zip').inputValue(),'62701');});
 await check('dynamic open-shadow fields autofill and remember genuine corrections',async()=>{await go(base[0]+'/dynamic');await eventually(()=>page.locator('#shadow-email').inputValue(),identity.email);await edit('#shadow-extra','Peach');await page.reload();await page.waitForTimeout(800);assert.equal(await page.locator('#shadow-extra').inputValue(),'Peach');});
 await check('same-origin and cross-origin form frames both fill',async()=>{await go(base[0]+'/frames');await eventually(()=>page.frameLocator('iframe[title="same"]').locator('#first').inputValue(),'Jordan');await eventually(()=>page.frameLocator('iframe[title="cross"]').locator('#email').inputValue(),identity.email);});
 await check('automatic filling preserves page-prefilled text and dropdown selection',async()=>{await opts.evaluate(()=>FM.setIdentityValue('state','IL'));await go(base[0]+'/defaults');assert.equal(await page.locator('#default-email').inputValue(),'page@example.com');assert.equal(await page.locator('#state').inputValue(),'NY');});
 await check('concurrent settings edits do not lose changes',async()=>{const second=await context.newPage();await second.goto(`chrome-extension://${extensionId}/src/options.html`);await Promise.all([opts.evaluate(()=>FM.setIdentityValue('firstName','Robin')),second.evaluate(()=>FM.setIdentityValue('lastName','Rivera'))]);const got=await storedIdentity();assert.equal(got.firstName,'Robin');assert.equal(got.lastName,'Rivera');await second.close();});
 let exported;
 await check('backup export produces a versioned timestamped real download',async()=>{await opts.reload();const pending=opts.waitForEvent('download');await opts.locator('#export').click();const download=await pending;assert.match(download.suggestedFilename(),/open-autofill.*\d{4}/);const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);exported=JSON.parse(Buffer.concat(chunks).toString());assert.equal(exported.format,'open-autofill');assert.equal(exported.version,1);assert.ok(exported.exportedAt);assert.equal(exported.state.identity.firstName,'Robin');assert.ok(Object.keys(exported.state.sites).length);});
 await check('import preview and cancel leave existing answers unchanged',async()=>{assert.ok(exported,'export prerequisite');const candidate=structuredClone(exported);candidate.state.identity.firstName='Restored';await opts.locator('#import').setInputFiles({name:'test-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(candidate))});await opts.locator('#confirmRestore').waitFor({state:'visible'});assert.equal((await storedIdentity()).firstName,'Robin');await opts.locator('#cancelRestore').click();assert.equal((await storedIdentity()).firstName,'Robin');});
 await check('confirmed restore replaces answers and undo recovers the previous state',async()=>{assert.ok(exported,'export prerequisite');const candidate=structuredClone(exported);candidate.state.identity.firstName='Restored';await opts.locator('#import').setInputFiles({name:'test-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(candidate))});opts.on('dialog',d=>d.accept());await opts.locator('#confirmRestore').click();await eventually(async()=>(await storedIdentity()).firstName,'Restored');await opts.locator('#undoRestore').click();await eventually(async()=>(await storedIdentity()).firstName,'Robin');});
 await check('malformed and future-version backups cannot wipe stored answers',async()=>{for(const candidate of [{identity:{}},{...exported,version:999}]){await opts.locator('#import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(candidate))});await opts.waitForTimeout(150);assert.equal((await storedIdentity()).firstName,'Robin');assert.equal(await opts.locator('#confirmRestore').isVisible(),false);}});
 await check('obfuscated labels fill and Remember keeps extras plus eligibility boxes',async()=>{const usual=await storedIdentity();await go(base[0]+'/obfuscated');await eventually(()=>page.locator('#hw-email').inputValue(),usual.email);assert.equal(await page.locator('#hw-first').inputValue(),usual.firstName);await page.locator('#venue').selectOption('renton');await page.locator('#age').check();await page.waitForTimeout(350);await pageCommand('fm.remember');assert.deepEqual(await storedIdentity(),usual);await page.reload();await page.waitForTimeout(700);assert.equal(await page.locator('#venue').inputValue(),'renton');assert.equal(await page.locator('#age').isChecked(),true);});
 await check('autofilled checkbox reaches click-driven validation, not only its visual state',async()=>{
   await opts.evaluate(()=>FM.setIdentityValue('agreeToRules','true'));
   await go(base[0]+'/activation');
   assert.equal(await page.locator('#rules').isChecked(),true);
   await page.locator('button').click();
   assert.equal(await page.locator('#result').textContent(),'Accepted');
   assert.deepEqual(await page.evaluate(()=>events),['click','input','change'].map(type=>({type,checked:true})));
 });
 await check('native checked state wins over stale aria-checked decoration',async()=>{
   await go(base[0]+'/activation?aria');
   assert.equal(await page.locator('#rules').isChecked(),true);
   assert.equal(await page.evaluate(()=>accepted),true);
 });
 await check('explicit Fill preserves checked boxes with no saved answer',async()=>{
   await go(base[0]+'/unsaved-checkbox');
   assert.equal((await pageCommand('fm.fill')).filled,0);
   assert.equal(await page.locator('#optional').isChecked(),true);
   assert.equal(await page.locator('#eligible').isChecked(),true);
 });
 await check('rerendered hidden detached disabled and readonly controls are not filled',async()=>{
   await go(base[0]+'/rerender');
   assert.equal(await page.locator('#trigger').inputValue(),(await storedIdentity()).email);
   assert.deepEqual(await page.evaluate(()=>later.map(el=>el.type==='checkbox'?el.checked:el.value)),['',false,'','']);
   assert.deepEqual(await page.evaluate(()=>laterEvents),[]);
   assert.equal((await pageCommand('fm.fill')).filled,0);
 });
 await check('unsupported custom checkbox is not cosmetically checked or activated as submit',async()=>{
   await go(base[0]+'/custom-check');
   assert.deepEqual(await page.locator('[role=checkbox]').evaluateAll(els=>els.map(el=>el.getAttribute('aria-checked'))),['false','false']);
   assert.equal((await pageCommand('fm.fill')).filled,0);
   assert.equal(await page.evaluate(()=>submits),0);
 });
 await check('canceled activation is not forced or reported as filled',async()=>{
   await go(base[0]+'/activation?cancel');
   assert.equal(await page.locator('#rules').isChecked(),false);
   assert.equal(await page.locator('#rules').evaluate(el=>el.classList.contains('fm-filled')),false);
   assert.equal((await pageCommand('fm.fill')).filled,0);
   assert.equal(await page.locator('#rules').isChecked(),false);
 });
 await check('activation does not teach synthetic changes and repeat fills do not click again',async()=>{
   await go(base[0]+'/activation');
   const before=await opts.evaluate(()=>chrome.storage.local.get(['identity','sites']));
   await page.waitForTimeout(1800);
   await pageCommand('fm.fill');
   assert.deepEqual(await page.evaluate(()=>events),['click','input','change'].map(type=>({type,checked:true})));
   assert.deepEqual(await opts.evaluate(()=>chrome.storage.local.get(['identity','sites'])),before);
   assert.equal(await page.locator('#rules').getAttribute('data-fm-user-edited'),null);
 });
 await check('remembered unchecked choice updates click-driven state and survives retries',async()=>{
   await page.locator('#rules').uncheck();
   await page.waitForTimeout(400);
   await page.reload();
   await page.waitForTimeout(700);
   assert.equal(await page.locator('#rules').isChecked(),false);
   // Simulate a page default, then explicitly replay the stored false value.
   await page.evaluate(()=>{document.querySelector('#rules').checked=true;accepted=true;events=[];});
   await pageCommand('fm.fill');
   assert.equal(await page.locator('#rules').isChecked(),false);
   assert.equal(await page.evaluate(()=>accepted),false);
   assert.deepEqual(await page.evaluate(()=>events),['click','input','change'].map(type=>({type,checked:false})));
   await page.waitForTimeout(1700);
   assert.equal(await page.locator('#rules').isChecked(),false);
 });
 await check('ignored top-level sites block same-origin iframe filling too',async()=>{await opts.evaluate(()=>FM.mutate('settings',{patch:{excludedHosts:['127.0.0.1']}}));await go(base[0]+'/frames');assert.equal(await page.frameLocator('iframe[title="same"]').locator('#email').inputValue(),'');assert.equal(await page.frameLocator('iframe[title="cross"]').locator('#email').inputValue(),'');});
 await check('extension pages and fixture pages have no uncaught JavaScript errors',async()=>assert.deepEqual(errors,[]));
 console.log(JSON.stringify({extensionId,passed,failures},null,2));
 } finally {if(context)await context.close();for(const s of servers)await new Promise(r=>s.close(r));fs.rmSync(profile,{recursive:true,force:true});}
 process.exitCode=failures.length?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
