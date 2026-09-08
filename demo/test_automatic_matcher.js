const assert = require('node:assert/strict');
require('../src/matcher.js');
const M = globalThis.FMMatcher;
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
const field = (autocomplete, label = '') => ({ tag: 'input', type: 'text', name: autocomplete, autocomplete, label });
test('page learning never writes identity or clears even with overwriteIdentity', () => {
  for (const autocomplete of Object.keys(M.AUTOCOMPLETE_MAP)) {
    const info = field(autocomplete);
    const identity = Object.freeze({ firstName: 'Alex', agreeToRules: 'false' });
    const cleared = { email: true, birthday: true };
    const result = M.learnFromField(info, 'Local answer', identity, [], {}, { overwriteIdentity: true, cleared });
    assert.deepEqual(result.identity, identity, autocomplete);
    assert.deepEqual(result.cleared, cleared);
  }
  const result = M.learnFromField({type:'checkbox', name:'rules', label:'I agree to Official Rules', required:true}, true, {}, [], {}, {overwriteIdentity:true});
  assert.deepEqual(result.identity, {});
  assert.equal(result.learned.target, 'site');
});

test('every identity semantic supports local corrections and returning to usual', () => {
  for (const [ac, semantic] of Object.entries(M.AUTOCOMPLETE_MAP)) {
    if (semantic.startsWith('birthday')) continue;
    const info = field(ac);
    const usual = semantic === 'phone' ? '2065550100' : 'Usual';
    const local = semantic === 'phone' ? '3605550100' : 'Local';
    const identity = {[semantic]: usual};
    const learned = M.learnFromField(info, local, identity, [], {});
    assert.equal(M.resolveValue(info, identity, learned.siteFields, {}).value, local, semantic);
    const reset = M.learnFromField(info, usual, identity, learned.siteFields, {});
    assert.equal(M.resolveValue(info, identity, reset.siteFields, {}).source, 'identity', semantic);
  }
});

test('local blank corrections suppress identity and remain distinct from no match', () => {
  for (const info of [field('given-name'), field('bday-month'), field(''), {...field('country'),tag:'select'}]) {
    info.name ||= 'favorite';
    const identity = {firstName:'Alex',birthday:'1990-05-15',country:'US'};
    const learned = M.learnFromField(info, '', identity, [], {});
    assert.equal(learned.siteFields.length, 1);
    const result = M.resolveValue(info, identity, learned.siteFields, {});
    assert.equal(result.value, '');
    assert.equal(result.source, 'site');
    assert.equal(result.suppressed, true);
    assert.equal(M.shouldFillResolvedValue(result), false);
  }
});

test('local refusal wins over settings agreement and global clear wins over both', () => {
  for (const label of ['I agree to Official Rules', 'Send me newsletters']) {
    const info = {type:'checkbox',name:'choice',label,required:true};
    const identity = {agreeToRules:'true'};
    const learned = M.learnFromField(info, false, identity, [], {});
    assert.equal(learned.siteFields[0]?.value, 'false');
    assert.equal(M.resolveValue(info, identity, learned.siteFields, {}).value, 'false');
    if (M.classify(info, {}).semantic) assert.equal(M.resolveValue(info, identity, learned.siteFields, {}, {agreeToRules:true}).value, '');
  }
});

test('settings agreement never asserts eligibility even when mixed with rules', () => {
  for (const label of ['I certify that I am eligible to enter.', 'I am a legal resident', 'I am 21 years or older', 'I agree to Official Rules and certify I am over 18', 'I have reached the age of majority']) {
    const info = {type:'checkbox',name:'choice',label,required:true};
    assert.equal(M.resolveValue(info, {agreeToRules:'true'}, [], {}).value, '', label);
    const local = M.learnFromField(info, true, {}, [], {});
    assert.equal(M.resolveValue(info, {}, local.siteFields, {}).value, 'true');
  }
});

test('checkbox correction cannot replay after the question changes on a reused id', () => {
  const info = {type:'checkbox',id:'consent',name:'consent',label:'Send me newsletters'};
  const local = M.learnFromField(info, true, {}, [], {});
  assert.equal(M.resolveValue({...info,label:'Send my details to partners'}, {}, local.siteFields, {}).value, '');
});

test('canonical birthdays adapt only to explicit date order and separators', () => {
  const identity = {birthday:'1990-05-15'};
  for (const [placeholder,want] of [['MM/DD/YYYY','05/15/1990'],['DD/MM/YYYY','15/05/1990'],['YYYY-MM-DD','1990-05-15'],['DD.MM.YYYY','15.05.1990'],['MM-DD-YYYY','05-15-1990']]) {
    assert.equal(M.resolveValue({...field('bday'),placeholder},identity,[],{}).value,want,placeholder);
  }
  assert.equal(M.resolveValue({...field('bday'),type:'date',placeholder:'DD/MM/YYYY'},identity,[],{}).value,identity.birthday);
  assert.equal(M.resolveValue(field('bday'),identity,[],{}).value,identity.birthday);
});

test('invalid or ambiguous global birthdays never fill dates or components', () => {
  for (const birthday of ['05/06/1990','1990-02-30','1900-02-29','1990-13-01','1990-00-12','0000-01-01','1990']) {
    for (const ac of ['bday','bday-day','bday-month','bday-year']) assert.equal(M.resolveValue(field(ac),{birthday},[],{}).value,'',birthday + ac);
  }
  assert.equal(M.resolveValue(field('bday-day'),{birthday:'2000-02-29'},[],{}).value,'29');
  assert.equal(M.resolveValue({...field('bday'),placeholder:'DD/MM/YYYY',label:'Birthday MM/DD/YYYY'},{birthday:'1990-05-15'},[],{}).value,'');
});

test('identity month selects prefer semantic labels over zero-based raw codes', () => {
  const resolved = M.resolveValue(field('bday-month'),{birthday:'1990-05-15'},[],{});
  assert.equal(M.selectOptionMatches(resolved,{value:'5',text:'June'}),false);
  assert.equal(M.selectOptionMatches(resolved,{value:'4',text:'May'}),true);
  assert.equal(M.selectOptionMatches(resolved,{value:'5',text:'6'}),false);
  assert.equal(M.selectOptionMatches(resolved,{value:'4',text:'5'}),true);
});

test('site select corrections replay exact raw values without semantic reinterpretation', () => {
  for (const [ac,raw,wrong] of [['bday-month','4','5'],['address-level1','WA','Washington'],['country','US','USA'],['sex','M','Male']]) {
    const info = {...field(ac),tag:'select'};
    const local = M.learnFromField(info,raw,{},[],{});
    const resolved = M.resolveValue(info,{},local.siteFields,{});
    assert.equal(M.selectOptionMatches(resolved,{value:raw,text:'May'}),true,ac);
    assert.equal(M.selectOptionMatches(resolved,{value:wrong,text:raw}),false,ac);
  }
  assert.equal(M.selectOptionMatches({source:'site',value:' A ',semantic:null},{value:'A',text:' A '}),false);
});

test('Remember snapshots extras and checkbox state without changing usual answers', () => {
  const extra = {tag:'select', type:'select-one', name:'venue', id:'venue', label:'Location'};
  const box = {type:'checkbox', name:'rules', label:'I agree to the Official Rules', required:true};
  const identity = {email:'you@example.com', phone:'2065550100', agreeToRules:'true'};
  assert.equal(M.shouldRememberCurrentValue(extra, 'Renton', identity, {}), true);
  assert.equal(M.shouldRememberCurrentValue(box, false, identity, {}), true);
  const phone = {tag:'input', type:'tel', name:'phone', autocomplete:'tel', label:'Phone'};
  assert.equal(M.shouldRememberCurrentValue(phone, '3605550100', identity, {}), true);
  const learned = M.learnFromField(phone, '3605550100', identity, [], {});
  assert.deepEqual(learned.identity, identity);
  assert.equal(M.resolveValue(phone, identity, learned.siteFields, {}).value, '3605550100');
});

test('number MM/DD/YYYY parts under a Date of Birth heading classify and fill from identity', () => {
  const identity = {birthday:'1990-05-15'};
  const month = {type:'number', tag:'input', name:'month', id:'month', placeholder:'MM', label:'Month', groupLabel:'Date of Birth *'};
  const day = {type:'number', tag:'input', name:'day', id:'day', placeholder:'DD', label:'Day', groupLabel:'Date of Birth *'};
  const year = {type:'number', tag:'input', name:'year', id:'year', placeholder:'YYYY', label:'Year', groupLabel:'Date of Birth *'};
  assert.equal(M.classify(month, {}).semantic, 'birthdayMonth');
  assert.equal(M.classify(day, {}).semantic, 'birthdayDay');
  assert.equal(M.classify(year, {}).semantic, 'birthdayYear');
  assert.equal(M.resolveValue(month, identity, [], {}).value, '05');
  assert.equal(M.resolveValue(day, identity, [], {}).value, '15');
  assert.equal(M.resolveValue(year, identity, [], {}).value, '1990');
  assert.equal(M.classify({type:'number', name:'month', id:'month', placeholder:'MM', label:'Month'}, {}).semantic, null);
});

let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('PASS', name); } catch (error) { failed++; console.error('FAIL', name, error.message); }
}
console.log(`${tests.length - failed}/${tests.length} passed`);
process.exitCode = failed ? 1 : 0;
