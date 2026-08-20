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

console.log("ok");
