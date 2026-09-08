# Open Autofill

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/scottangel)

Fast, automatic form memory for Chrome. **Always free. Local only. No daily cap.**

Set **Your usual answers** once in the popup or settings. New forms fill automatically. If an answer is wrong for a particular form, change it normally: Open Autofill remembers your correction for that site and form, without changing your usual answers elsewhere. No trust step or teaching panel.

Original software, not Lightning Autofill and not based on its code.

## Everyday use

1. Enable form memory once and enter Your usual answers in the extension.
2. Open a form. Recognizable identity fields fill automatically, including forms that appear late.
3. Correct a value, select an option, or enter an extra answer normally. Genuine edits are remembered automatically while Auto-learn is on.
4. Come back to the same form: local corrections take priority. Clearing a field remembers that it should stay blank; checked and unchecked choices both persist.

**Page edits never rewrite Your usual answers**, even on submit or **Remember this page**. Change those defaults only in popup/settings or through a confirmed backup restore. Different names, addresses, email addresses, and other answers can stay local—not just contact details.

- `Alt+Shift+F`: Fill this page explicitly (replaces permitted values).
- `Alt+Shift+S`: Remember this page (saves extras, checkbox/radio state, and site-specific answers currently on the form; never changes Your usual answers).
- Right-click: Fill, Remember, or ignore the current site.
- Settings: forget a site's local memory and manage ignored sites.

## Formats and matching

- Birthday is stored as a canonical date (`YYYY-MM-DD`) in Your usual answers. Recognized format hints adapt it to US/European ordering, separators, native date fields, or separate month/day/year controls.
- Month dropdowns support names and zero-based values. A locally corrected dropdown replays its exact stored option value.
- State/province names and codes, common country representations, full names, and required-marker labels are recognized.
- Truly ambiguous or invalid date formats are left alone rather than guessing a different birthday. Correct the form normally to remember its local representation.

## Safety without routine extra clicks

- Passwords, payment details, SSNs, one-time codes, CAPTCHAs, and search controls remain excluded, including during explicit Fill (search filling is an opt-in setting).
- Automatic filling preserves user edits and nonempty page defaults. It skips hidden controls; explicit Fill does not bypass safety exclusions.
- Global terms automation is settings-only. Checking one site's rules never turns it on globally. Age, residency, and eligibility facts are not inferred from that setting. A local unchecked choice takes precedence.
- Site memory uses the exact origin (scheme, host, port) and a form scope. Different origins and distinct forms do not share corrections.
- Embedded forms fill, including third-party http(s) frames. Site memory is stored for the frame's origin. Ignoring a site applies to that tab's frames too.
- Storage changes are serialized through the extension service worker to avoid lost updates and stale edits resurrecting forgotten data.

**Local-only is not a privacy shield from the page:** website scripts can read a filled value before Submit. Enable automatic filling only if that tradeoff suits your browsing, and ignore sites where you do not want it. No form is submitted automatically.

## Backup and recovery

Export creates a timestamped, versioned JSON file containing usual answers, settings, local corrections, cleared markers, and preserved legacy data. Nothing is uploaded.

Import validates the file and previews a **replacement**, not a merge. Confirm only if you want its contents to replace current memory. A local pre-restore snapshot lets you undo a restore. Invalid, unsupported, or incomplete files are rejected before writing.

Backups are readable personal data, not encrypted archives. Store them privately. A recovery snapshot is local too and is not a substitute for an exported file on another disk.

### Upgrading from older builds

Global answers and existing consent are retained. Old hostname-only site records remain preserved as inactive legacy data rather than silently sharing them across schemes, ports, or forms. New genuine edits rebuild precisely scoped memory automatically. Legacy exports remain importable when they contain a valid complete state. Export a backup before changing builds.

## Install in Chrome

1. Clone or download this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked**, choosing this folder (the one containing `manifest.json`).
4. Pin Open Autofill, enable form memory, and set Your usual answers.

After updating files, click **Reload** on the extension, then reload form tabs. Reloading a website alone leaves the previous content script running. Do not remove/reinstall the extension just to update it.

## Try locally

```sh
python3 -m http.server 8765 --directory demo
```

Open <http://127.0.0.1:8765/form.html>. Use fake data for testing.

## Tests

```sh
node demo/test_matcher.js src/matcher.js
node demo/test_automatic_matcher.js
node demo/test_learning_queue.js
node demo/test_shared.js
node demo/test_storage_automatic.js
node demo/test_manifest.js
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node demo/test_browser_automatic.js
```

The browser suite uses local fixtures, fake identity and a disposable Chromium profile. It does not access your personal Chrome data. Implementation plan and resumable status are in `.hermes/plans/`.

## Honest limits

Closed shadow roots, cross-origin embedded forms, and nonnative custom widgets may not fill. Changed form identifiers or question wording can need a new local correction. Automatic matching cannot determine a website's intent or safely guess every unlabeled date format. No macros, CAPTCHA solving, cloud sync, analytics, or external model calls.

Earlier-interface screenshots are in `docs/screenshots/`; they are examples, not current backup UI documentation. Public site/privacy and store copy are maintained in `docs/` and `store/`. Release packages contain only `manifest.json`, `src/`, and `icons/`.

Support: <https://github.com/jcarcinogen/Open-Autofill/issues>
