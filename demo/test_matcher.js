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
assert(M.classifyFromText("Threads username") === "threads", "threads handle");
assert(M.classifyFromText("Bluesky / Bsky handle") === "bluesky", "bluesky handle");
assert(M.classifyFromText("worker threads") !== "threads", "worker threads are not a social handle");
assert(M.classifyFromText("number of threads") !== "threads", "thread-count fields are not a social handle");
assert(M.classifyFromText("first_name") === "firstName", "fname");
assert(M.classifyFromText("ZIP code") === "zip", "zip");
assert(M.classifyFromText("state_us_4006867878369-MultipleChoiceField") === "state", "state ID with underscore separator");
assert(M.classifyFromText("billing_state") === "state", "state suffix with underscore separator");
assert(M.classifyFromText("province_ca") === "state", "province ID with underscore separator");
assert(M.classifyFromText("State:") === "state", "state label with trailing punctuation");
assert(M.classifyFromText("State/Province") === "state", "state/province slash label");
assert(M.classifyFromText("Region (required)") === "state", "region label with punctuation");
assert(M.classifyFromText("interstate") !== "state", "embedded state text is not a state field");

const zipAsTel = {
  tag: "input",
  type: "tel",
  name: "postal_zip",
  id: "postal_zip",
  placeholder: "ZIP Code",
  autocomplete: "",
  label: "ZIP Code",
  ariaLabel: "",
  value: "",
  disabled: false,
  readOnly: false
};
assert(M.classify(zipAsTel, {}).semantic === "zip", "zip meaning beats tel input type");
const anonymousTel = { ...zipAsTel, name: "", id: "", placeholder: "", label: "" };
assert(M.classify(anonymousTel, {}).semantic === "phone", "tel type remains a phone fallback");

const dobMonth = {
  tag: "select",
  type: "select-one",
  name: "month",
  id: "field-month",
  placeholder: "",
  autocomplete: "",
  label: "Month",
  ariaLabel: "Month",
  groupLabel: "Date of Birth",
  value: "",
  disabled: false,
  readOnly: false
};
const dobDay = { ...dobMonth, name: "day", id: "field-day", label: "Day", ariaLabel: "Day" };
const dobYear = { ...dobMonth, name: "year", id: "field-year", label: "Year", ariaLabel: "Year" };
assert(M.classify(dobMonth, {}).semantic === "birthdayMonth", "DOB month select classification");
assert(M.classify(dobDay, {}).semantic === "birthdayDay", "DOB day select classification");
assert(M.classify(dobYear, {}).semantic === "birthdayYear", "DOB year select classification");
assert(M.classifyAutocomplete("bday-month") === "birthdayMonth", "bday month autocomplete");
assert(M.classifyAutocomplete("bday-day") === "birthdayDay", "bday day autocomplete");
assert(M.classifyAutocomplete("bday-year") === "birthdayYear", "bday year autocomplete");
assert(M.selectOptionMatches({ semantic: "birthdayMonth", value: "05" }, { value: "5", text: "May" }), "derived padded month matches unpadded option");
assert(M.selectOptionMatches({ semantic: "birthdayMonth", value: "05" }, { value: "May", text: "May" }), "derived month matches month-name option");
assert(M.selectOptionMatches({ semantic: "birthdayDay", value: "05" }, { value: "5", text: "5" }), "derived padded day matches unpadded option");
assert(!M.selectOptionMatches({ semantic: null, value: "05" }, { value: "5", text: "5" }), "ordinary selects retain exact matching");
assert(
  M.selectOptionMatches({ semantic: "state", value: "Washington" }, { value: "WA", text: "WA" }),
  "full state name matches postal abbreviation option"
);
assert(
  M.selectOptionMatches({ semantic: "state", value: "WA" }, { value: "Washington", text: "Washington" }),
  "postal abbreviation matches full state name option"
);
assert(
  M.selectOptionMatches({ semantic: "state", value: "United States Virgin Islands" }, { value: "VI", text: "VI" }),
  "official Virgin Islands name matches territory code"
);
assert(
  M.selectOptionMatches({ semantic: "state", value: "United States Minor Outlying Islands" }, { value: "UM", text: "UM" }),
  "official Minor Outlying Islands name matches territory code"
);
assert(
  !M.selectOptionMatches({ semantic: "country", value: "Washington" }, { value: "WA", text: "WA" }),
  "state normalization does not loosen unrelated selects"
);
const welchsDobMonth = {
  ...dobMonth,
  name: "dob_m",
  id: "dob_m",
  label: "Date of Birth",
  ariaLabel: "",
  groupLabel: ""
};
const welchsDobDay = { ...welchsDobMonth, name: "dob_d", id: "dob_d", label: "Date of Birth - Day" };
const welchsDobYear = { ...welchsDobMonth, name: "dob_y", id: "dob_y", label: "Date of Birth - Year" };
assert(M.classify(welchsDobMonth, {}).semantic === "birthdayMonth", "Welch's dob_m classifies as DOB month");
assert(M.classify(welchsDobDay, {}).semantic === "birthdayDay", "Welch's dob_d classifies as DOB day");
assert(M.classify(welchsDobYear, {}).semantic === "birthdayYear", "Welch's dob_y classifies as DOB year");
assert(
  M.classify({ ...welchsDobMonth, label: "", groupLabel: "" }, {}).semantic === "birthdayMonth",
  "bare dob_m identifier classifies as DOB month"
);
assert(
  M.classify({ ...welchsDobDay, label: "", groupLabel: "" }, {}).semantic === "birthdayDay",
  "bare dob_d identifier classifies as DOB day"
);
assert(
  M.classify({ ...welchsDobYear, label: "", groupLabel: "" }, {}).semantic === "birthdayYear",
  "bare dob_y identifier classifies as DOB year"
);
const welchsEmail = { ...zipAsTel, type: "email", name: "email", id: "email", label: "Email Address" };
assert(M.classify(welchsEmail, {}).semantic === "email", "Welch's email field classifies as email");
const welchsRules = {
  ...zipAsTel,
  type: "checkbox",
  name: "optin_rules",
  id: "optin_rules",
  label: "I have read and agree to the Official Rules.",
  value: "yes",
  checked: true
};
assert(M.classify(welchsRules, {}).semantic === "agreeToRules", "Welch's Official Rules checkbox classifies as agreement");
let welchsIdentity = { birthday: "1978-02-13" };
let welchsSiteFields = [];
for (const [field, value] of [
  [welchsDobMonth, "02"],
  [welchsDobDay, "13"],
  [welchsDobYear, "1978"],
  [welchsEmail, "scott@example.com"],
  [welchsRules, true]
]) {
  const learned = M.learnFromField(field, value, welchsIdentity, welchsSiteFields, {}, { overwriteIdentity: false });
  welchsIdentity = learned.identity;
  welchsSiteFields = learned.siteFields;
}
assert(welchsIdentity.email === "scott@example.com", "Welch's email is learned");
assert(welchsIdentity.agreeToRules === "true", "Welch's Official Rules agreement is learned");
assert(
  ["birthdayMonth", "birthdayDay", "birthdayYear"].every((semantic) =>
    welchsSiteFields.some((field) => field.semantic === semantic)
  ),
  "all Welch's DOB parts are learned per site"
);
const manuallyRestoredEmail = M.learnFromField(welchsEmail, "scott@example.com", {}, [], {}, {
  overwriteIdentity: true,
  cleared: { email: true }
});
assert(manuallyRestoredEmail.identity.email === "scott@example.com", "manual Remember restores a previously cleared email");
assert(!manuallyRestoredEmail.cleared.email, "manual Remember removes the email clear marker");
const manuallyRestoredDob = M.learnFromField(welchsDobMonth, "02", {}, [], {}, {
  overwriteIdentity: true,
  cleared: { birthday: true }
});
assert(!manuallyRestoredDob.cleared.birthday, "manual Remember makes explicitly entered DOB parts fillable again");
const welchsLegacyDobFields = [
  { key: "name:dob_m", aliases: ["id:dob_m", "label:date of birth"], semantic: "birthday", type: "select", value: "02" },
  { key: "name:dob_d", aliases: ["id:dob_d", "label:date of birth - day"], semantic: "birthday", type: "select", value: "13" },
  { key: "name:dob_y", aliases: ["id:dob_y", "label:date of birth - year"], semantic: "birthday", type: "select", value: "1978" }
];
assert(
  M.resolveValue(welchsDobMonth, { birthday: "1978" }, welchsLegacyDobFields, {}).value === "02",
  "legacy generic Welch's DOB month record remains readable"
);
assert(
  M.resolveValue(welchsDobDay, { birthday: "1978" }, welchsLegacyDobFields, {}).value === "13",
  "legacy generic Welch's DOB day record remains readable"
);
assert(
  M.resolveValue(welchsDobYear, { birthday: "1978" }, welchsLegacyDobFields, {}).value === "1978",
  "legacy generic Welch's DOB year record remains readable"
);

const learnedDobMonth = M.learnFromField(dobMonth, "May", { birthday: "1990-05-15" }, [], {}, {
  overwriteIdentity: true
});
assert(!Object.prototype.hasOwnProperty.call(learnedDobMonth.identity, "birthdayMonth"), "DOB part does not create hidden identity");
assert(learnedDobMonth.siteFields[0].value === "May", "DOB month is stored per site");
assert(learnedDobMonth.siteFields[0].key === "dob:birthdayMonth", "DOB month uses a semantic-qualified site key");
const resolvedDobMonth = M.resolveValue(dobMonth, learnedDobMonth.identity, learnedDobMonth.siteFields, {});
assert(resolvedDobMonth.value === "May" && resolvedDobMonth.source === "site", "site DOB format beats derived identity part");
const eventMonth = { ...dobMonth, id: "event-month", groupLabel: "Event date" };
const unrelatedMonth = M.resolveValue(eventMonth, {}, learnedDobMonth.siteFields, {});
assert(!unrelatedMonth.value, "DOB month does not fill an unrelated month select");
const legacyDobMonth = [{ key: "name:month", aliases: ["label:month"], semantic: "birthday-month", value: "May" }];
const unrelatedLegacyMonth = M.resolveValue(eventMonth, {}, legacyDobMonth, {});
assert(!unrelatedLegacyMonth.value, "legacy DOB month does not fill an unrelated month select");
const migratedDobMonth = M.learnFromField(dobMonth, "May", {}, legacyDobMonth, {}, { overwriteIdentity: true });
assert(migratedDobMonth.siteFields.length === 1 && migratedDobMonth.siteFields[0].key === "dob:birthdayMonth", "legacy DOB part is replaced safely");
const derivedDobDay = M.resolveValue(dobDay, { birthday: "1990-05-15" }, [], {});
const derivedDobYear = M.resolveValue(dobYear, { birthday: "1990-05-15" }, [], {});
assert(derivedDobDay.value === "15" && derivedDobDay.source === "identity", "derive DOB day from ISO birthday");
assert(derivedDobYear.value === "1990" && derivedDobYear.source === "identity", "derive DOB year from ISO birthday");
const clearedDobMonth = M.resolveValue(dobMonth, learnedDobMonth.identity, learnedDobMonth.siteFields, {}, { birthday: true });
assert(!clearedDobMonth.value, "cleared birthday suppresses remembered DOB parts");
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
const caymanState = {
  tag: "select",
  type: "select-one",
  name: "",
  id: "state_us_4006867878369-MultipleChoiceField",
  placeholder: "",
  autocomplete: "",
  label: "",
  ariaLabel: "",
  disabled: false,
  readOnly: false
};
const caymanStateValue = M.resolveValue(caymanState, { state: "Washington" }, [], settings);
assert(caymanStateValue.semantic === "state" && caymanStateValue.source === "identity", "Cayman state select resolves from identity");
assert(M.selectOptionMatches(caymanStateValue, { value: "WA", text: "WA" }), "Cayman WA option matches Washington identity");

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

const bestBuyEmail = {
  ...emailInfo,
  id: "use_your_my_best_buy_account_email_for_e",
  name: "",
  autocomplete: "",
  label: "Use your My Best Buy account email for entry."
};
const bestBuyLearned = M.learnFromField(
  bestBuyEmail,
  "site@example.com",
  { email: "usual@example.com" },
  [],
  settings,
  { overwriteIdentity: false }
);
assert(bestBuyLearned.identity.email === "usual@example.com", "Best Buy email does not replace the usual email");
assert(bestBuyLearned.siteFields[0].override === true, "Best Buy alternate email is marked as a site override");
const bestBuyResolved = M.resolveValue(bestBuyEmail, bestBuyLearned.identity, bestBuyLearned.siteFields, settings);
assert(
  bestBuyResolved.value === "site@example.com" && bestBuyResolved.source === "site",
  "Best Buy site email beats the usual email"
);
const bestBuyRemembered = M.learnFromField(
  bestBuyEmail,
  "site@example.com",
  { email: "usual@example.com" },
  [],
  settings,
  { overwriteIdentity: true }
);
assert(bestBuyRemembered.identity.email === "usual@example.com", "manual Remember preserves the usual email");
assert(bestBuyRemembered.siteFields[0].override === true, "manual Remember stores the Best Buy override");
const bestBuyReset = M.learnFromField(
  bestBuyEmail,
  "usual@example.com",
  bestBuyLearned.identity,
  bestBuyLearned.siteFields,
  settings,
  { overwriteIdentity: false }
);
assert(!bestBuyReset.siteFields[0].override, "entering the usual email removes the Best Buy override");
assert(
  M.resolveValue(bestBuyEmail, bestBuyReset.identity, bestBuyReset.siteFields, settings).source === "identity",
  "Best Buy returns to the usual email after its override is removed"
);

const maverikPhone = {
  ...emailInfo,
  type: "tel",
  name: "phoneNumber",
  id: "",
  autocomplete: "tel",
  label: "Phone Number (Format: 1234567890)"
};
const maverikLearned = M.learnFromField(maverikPhone, "3605550100", { phone: "2065550100" }, [], settings, {
  overwriteIdentity: false
});
assert(maverikLearned.identity.phone === "2065550100", "Maverik phone does not replace the usual phone");
assert(maverikLearned.siteFields[0].override === true, "Maverik alternate phone is marked as a site override");
const maverikResolved = M.resolveValue(maverikPhone, maverikLearned.identity, maverikLearned.siteFields, settings);
assert(
  maverikResolved.value === "3605550100" && maverikResolved.source === "site",
  "Maverik site phone beats the usual phone"
);

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

const matrixBase = {
  ...radioBase,
  groupLabel: "Brand 1 2 3 4 5 6 7 8 9 10",
  label: ""
};
const alfaTwo = { ...matrixBase, name: "RecommendRateAlfa", groupName: "RecommendRateAlfa", id: "alfa-2", value: "2" };
const alfaTen = { ...alfaTwo, id: "alfa-10", value: "10" };
const jeepNine = { ...matrixBase, name: "RecommendRateJeep", groupName: "RecommendRateJeep", id: "jeep-9", value: "9" };
const jeepTen = { ...jeepNine, id: "jeep-10", value: "10" };
const learnedAlfa = M.learnFromField(alfaTwo, "2", {}, [], settings);
const learnedMatrix = M.learnFromField(jeepNine, "9", {}, learnedAlfa.siteFields, settings);
assert(learnedMatrix.siteFields.length === 2, "radio matrix keeps one record per row");
assert(
  learnedMatrix.siteFields.some((field) => field.key === "radioname:RecommendRateAlfa") &&
    learnedMatrix.siteFields.some((field) => field.key === "radioname:RecommendRateJeep"),
  "radio matrix uses each row's stable group name"
);
assert(M.resolveValue(alfaTwo, {}, learnedMatrix.siteFields, settings).source === "site", "restore Alfa Romeo rating");
assert(!M.resolveValue(alfaTen, {}, learnedMatrix.siteFields, settings).value, "do not force the last column for Alfa Romeo");
assert(M.resolveValue(jeepNine, {}, learnedMatrix.siteFields, settings).source === "site", "restore Jeep rating");
assert(!M.resolveValue(jeepTen, {}, learnedMatrix.siteFields, settings).value, "do not force the last column for Jeep");
const legacyJeepMatrix = [
  {
    key: "radiogroup:Brand 1 2 3 4 5 6 7 8 9 10",
    aliases: ["radioname:RecommendRateJeep"],
    type: "radio",
    value: "9",
    optionLabel: "",
    optionValue: "9"
  }
];
assert(!M.resolveValue(alfaTwo, {}, legacyJeepMatrix, settings).value, "legacy Jeep matrix record cannot fill Alfa Romeo");
assert(M.resolveValue(jeepNine, {}, legacyJeepMatrix, settings).source === "site", "legacy Jeep matrix record remains readable");
const migratedLegacyJeep = M.learnFromField(jeepNine, "9", {}, legacyJeepMatrix, settings);
assert(
  migratedLegacyJeep.siteFields.length === 1 && migratedLegacyJeep.siteFields[0].key === "radioname:RecommendRateJeep",
  "legacy Jeep matrix record migrates to its stable row name"
);

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
const manualAddressUpdate = M.learnFromField(addr2, "new apartment", { address2: "old apartment" }, [], settings, {
  overwriteIdentity: true
});
assert(manualAddressUpdate.identity.address2 === "new apartment", "manual Remember still updates non-contact identity fields");

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

const gmailSelect = {
  tag: "div",
  type: "checkbox",
  name: "",
  id: "",
  placeholder: "",
  autocomplete: "",
  label: "",
  ariaLabel: "Select",
  value: "",
  disabled: false,
  readOnly: false
};
assert(M.isUiCheckbox(gmailSelect), "gmail select is ui");
assert(M.shouldSkip(gmailSelect, settings), "skip gmail select");
assert(M.checkboxRole(gmailSelect) !== "agreement", "gmail select not agreement");
const gmailSelectAll = { ...gmailSelect, ariaLabel: "Select all conversations" };
assert(M.shouldSkip(gmailSelectAll, settings), "skip gmail select all");
assert(M.checkboxRole(nbc) === "agreement", "nbc still agreement");

const captcha = {
  tag: "input",
  type: "text",
  name: "captcha_answer",
  id: "captcha_answer",
  placeholder: "",
  autocomplete: "",
  label: "Type the characters seen in the picture above:",
  ariaLabel: "",
  value: "",
  disabled: false,
  readOnly: false
};
assert(M.shouldSkip(captcha, settings), "skip captcha field");
assert(M.classifyFromText("captcha_answer") !== "address2", "captcha is not address2");
assert(M.classifyFromText("Apt 2") === "address2", "apt still address2");
assert(M.classifyFromText("Address 2 (optional)") === "address2", "address 2 label");

const sharedSrc = fs.readFileSync(require("path").join(__dirname, "..", "src", "shared.js"), "utf8");
vm.runInContext(sharedSrc, ctx);
const FM = ctx.FM;
assert(FM.IDENTITY_FIELDS.some((field) => field.key === "threads"), "identity profile includes Threads");
assert(FM.IDENTITY_FIELDS.some((field) => field.key === "bluesky"), "identity profile includes Bluesky");
assert(FM.cleanNodeText(null) === "", "missing DOM context cleans to an empty string");
assert(
  FM.cleanNodeText({ textContent: "  Date   of Birth  " }) === "Date of Birth",
  "DOM context text is normalized"
);
assert(FM.isExcluded(settings, "mail.google.com"), "skip gmail host");
assert(FM.isExcluded(settings, "outlook.office.com"), "skip outlook host");
assert(!FM.isExcluded(settings, "nbc.com"), "do not skip contest host");
assert(!FM.isExcluded({ ...settings, fillOnAppSites: true }, "mail.google.com"), "opt-in app sites");
const dobSites = {
  "example.com": {
    fields: [
      { key: "name:birthday", semantic: "birthday", value: "1990-05-15" },
      { key: "name:month", semantic: "birthdayMonth", value: "May" },
      { key: "name:day", semantic: "birthdayDay", value: "15" },
      { key: "name:legacy-month", semantic: "birthday-month", value: "May" },
      { key: "name:favorite", semantic: null, value: "blue" }
    ]
  }
};
const strippedDobSites = FM.stripSemanticFromSites(dobSites, "birthday");
assert(strippedDobSites["example.com"].fields.length === 1, "clearing birthday removes all DOB parts");

console.log("ok");
