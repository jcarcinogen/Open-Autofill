const fs = require("fs");
const vm = require("vm");
const src = fs.readFileSync(process.argv[2], "utf8");
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const M = ctx.FMMatcher;
const assert = (cond, msg) => {
  if (!cond) {
    console.error("FAIL", msg);
    process.exit(1);
  }
};

assert(M.classifyAutocomplete("email") === "email", "ac email");
assert(M.classifyAutocomplete("given-name") === "firstName", "ac first");
assert(M.classifyFromText("instagram_handle") === "instagram", "ig");
assert(M.classifyFromText("first_name") === "firstName", "fname");
assert(M.classifyFromText("ZIP code") === "zip", "zip");
assert(
  M.isSensitive({
    type: "password",
    name: "pass",
    id: "",
    placeholder: "",
    autocomplete: "",
    label: "",
    ariaLabel: ""
  }),
  "password"
);
assert(
  M.isSensitive({
    type: "text",
    name: "cc-number",
    id: "",
    placeholder: "",
    autocomplete: "cc-number",
    label: "",
    ariaLabel: ""
  }),
  "cc"
);

const settings = { skipPasswords: true, skipPaymentAndSsn: true };
const emailInfo = {
  tag: "input",
  type: "email",
  name: "email",
  id: "email",
  placeholder: "",
  autocomplete: "email",
  label: "Email",
  ariaLabel: "",
  disabled: false,
  readOnly: false
};
const resolved = M.resolveValue(emailInfo, { email: "a@b.com" }, [], settings);
assert(resolved.semantic === "email" && resolved.value === "a@b.com" && resolved.source === "identity", "resolve email");

const flavor = {
  tag: "input",
  type: "text",
  name: "favorite_flavor",
  id: "fav",
  placeholder: "",
  autocomplete: "",
  label: "Favorite flavor",
  ariaLabel: "",
  disabled: false,
  readOnly: false
};
const learned = M.learnFromField(flavor, "vanilla", {}, [], settings);
assert(learned.siteFields[0].value === "vanilla", "learn site");
const again = M.resolveValue(flavor, {}, learned.siteFields, settings);
assert(again.value === "vanilla" && again.source === "site", "resolve site");

const pw = {
  tag: "input",
  type: "password",
  name: "password",
  id: "",
  placeholder: "",
  autocomplete: "current-password",
  label: "",
  ariaLabel: "",
  disabled: false,
  readOnly: false
};
const skipped = M.resolveValue(pw, { email: "x" }, [], settings);
assert(skipped.skip && !skipped.value, "skip password");

const rules = {
  tag: "input",
  type: "checkbox",
  name: "field197485275[]",
  id: "field197485275_1",
  placeholder: "",
  autocomplete: "",
  label: "I have read and agree to the Official Rules and Privacy Policy.",
  ariaLabel: "",
  value: "I have read and agree to the Official Rules and Privacy Policy.",
  disabled: false,
  readOnly: false
};
assert(M.checkboxRole(rules) === "agreement", "rules role");
const learnedRules = M.learnFromField(rules, true, {}, [], settings);
assert(learnedRules.identity.agreeToRules === "true", "learn agree");
const otherSite = {
  ...rules,
  name: "terms[]",
  id: "terms_1"
};
const fillOther = M.resolveValue(otherSite, learnedRules.identity, [], settings);
assert(fillOther.value === "true" && fillOther.source === "identity", "cross-site rules");

const marketing = {
  tag: "input",
  type: "checkbox",
  name: "field197485276[]",
  id: "field197485276_1",
  placeholder: "",
  autocomplete: "",
  label: "Sign up to receive information, offers, and promotions regarding Straight Talk products and services.",
  ariaLabel: "",
  value: "Sign up to receive information, offers, and promotions",
  disabled: false,
  readOnly: false
};
assert(M.checkboxRole(marketing) === "marketing", "marketing role");
const fillMarketing = M.resolveValue(marketing, learnedRules.identity, [], settings);
assert(!fillMarketing.value, "do not check marketing");

const rememberedOff = M.learnFromField(marketing, false, learnedRules.identity, [], settings);
assert(!rememberedOff.siteFields.length, "do not snapshot unchecked");

const cayman = {
  tag: "input",
  type: "checkbox",
  name: "",
  id: "checkbox_5786026767930-CheckboxField",
  placeholder: "",
  autocomplete: "",
  label: "I agree to the Official Rules.*",
  ariaLabel: "",
  value: "checkbox_5786026767930",
  disabled: false,
  readOnly: false
};
assert(M.checkboxRole(cayman) === "agreement", "cayman rules");
assert(M.siteKeys(cayman)[0] === "label:i agree to the official rules.*", "cayman stable key");
const stale = [{ key: "id:checkbox_1111111111111-CheckboxField", aliases: ["label:i agree to the official rules.*"], type: "checkbox", value: "false", role: "agreement" }];
const caymanFill = M.resolveValue(cayman, { agreeToRules: "true" }, stale, settings);
assert(caymanFill.value === "true" && caymanFill.source === "identity", "identity beats stale unchecked");

const cjMarketing = {
  tag: "input",
  type: "checkbox",
  name: "",
  id: "opt_in_7675029323762-CheckboxField",
  placeholder: "",
  autocomplete: "",
  label: "By ticking this box you indicate that you wish to receive Cayman Jack updates and you have read and acknowledge our Privacy Policy. You can unsubscribe at anytime.",
  ariaLabel: "",
  value: "opt_in_7675029323762",
  disabled: false,
  readOnly: false
};
assert(M.checkboxRole(cjMarketing) === "marketing", "cayman marketing");
assert(!M.resolveValue(cjMarketing, { agreeToRules: "true" }, [], settings).value, "no marketing fill");

const radioBase = {
  tag: "input",
  type: "radio",
  name: "QID2",
  placeholder: "",
  autocomplete: "",
  ariaLabel: "",
  groupName: "QID2",
  groupLabel: "When do you plan on acquiring your next vehicle?",
  disabled: false,
  readOnly: false
};
const undecided = { ...radioBase, id: "r6", label: "Undecided", value: "6" };
const month = { ...radioBase, id: "r1", label: "1 month or less", value: "1" };
assert(M.radioPersistValue(undecided, "6") === "Undecided", "persist label not code");
assert(M.radioPersistValue(undecided, true) === "Undecided", "persist boolean true");
const learnedRadio = M.learnFromField(undecided, "6", {}, [], settings);
assert(learnedRadio.siteFields[0].value === "Undecided", "store undecided");
const fillUndecided = M.resolveValue(undecided, {}, learnedRadio.siteFields, settings);
const fillMonth = M.resolveValue(month, {}, learnedRadio.siteFields, settings);
assert(fillUndecided.source === "site" && fillUndecided.value, "fill chosen radio");
assert(!fillMonth.value, "do not fill other radio");
assert(M.radioMatches(undecided, learnedRadio.siteFields[0]), "match undecided");
assert(!M.radioMatches(month, learnedRadio.siteFields[0]), "no match month");

const nbc = {
  tag: "input",
  type: "checkbox",
  name: "terms",
  id: "terms",
  placeholder: "",
  autocomplete: "",
  label: "I have read and agreed to the Win Like a Warrior Sweepstakes.",
  ariaLabel: "",
  value: "on",
  disabled: false,
  readOnly: false
};
assert(M.checkboxRole(nbc) === "agreement", "nbc agreed");
const nbcLearn = M.learnFromField(nbc, true, {}, [], settings);
assert(nbcLearn.identity.agreeToRules === "true", "nbc sets agree");

const addr2 = {
  tag: "input",
  type: "text",
  name: "address2",
  id: "address2",
  placeholder: "",
  autocomplete: "address-line2",
  label: "Address 2 (optional)",
  ariaLabel: "",
  value: "",
  disabled: false,
  readOnly: false
};
const siteJunk = [{ key: "name:address2", type: "text", value: "hnmgd", semantic: "address2" }];
const fromIdentity = M.resolveValue(addr2, { address2: "naphj" }, siteJunk, settings, {});
assert(fromIdentity.value === "naphj" && fromIdentity.source === "identity", "settings beat site junk");
const cleared = M.resolveValue(addr2, { address2: "" }, siteJunk, settings, { address2: true });
assert(!cleared.value, "cleared address2 stays empty");
const noOverwrite = M.learnFromField(addr2, "hnmgd", { address2: "naphj" }, [], settings, { overwriteIdentity: false });
assert(noOverwrite.identity.address2 === "naphj", "auto-learn does not overwrite");
const blocked = M.learnFromField(addr2, "hnmgd", { address2: "" }, [], settings, { overwriteIdentity: false, cleared: { address2: true } });
assert(!blocked.identity.address2, "cleared blocks auto-learn");

const googleQ = {
  tag: "textarea",
  type: "text",
  name: "q",
  id: "APjFqb",
  placeholder: "Search",
  autocomplete: "off",
  label: "",
  ariaLabel: "Search",
  disabled: false,
  readOnly: false
};
assert(M.isSearchField(googleQ), "google search");
assert(M.shouldSkip(googleQ, settings), "skip search by default");
assert(!M.shouldSkip(googleQ, { ...settings, fillSearchFields: true }), "opt-in search fill");
const gmail = {
  tag: "input",
  type: "text",
  name: "q",
  id: "gbqfq",
  placeholder: "Search mail",
  autocomplete: "off",
  label: "",
  ariaLabel: "Search mail",
  disabled: false,
  readOnly: false
};
assert(M.isSearchField(gmail), "gmail search");

console.log("ok");
