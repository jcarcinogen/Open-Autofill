# Open Autofill

Chrome MV3 extension. Always free, local-only form memory. Not Lightning Autofill. Keep all documentation focused on general form-filling.

Repo: `~/Projects/Open-Autofill` · public `github.com/jcarcinogen/Open-Autofill`

## Product rules

- Identity + per-site extra fields stay in this Chrome profile, keeping the product local-only with no cloud dependency or daily cap.
- Search boxes stay skipped by default so ordinary browsing is not mistaken for form entry.
- All permitted corrections stay exact-origin-and-form-local. **Your usual answers never change from webpage learning, submit, or Remember.** Only popup/options edits and confirmed backup restore may change them.
- Preserve automatic filling and genuine-edit learning with no trust/teaching gate. Remember this page flushes captured edits, not page defaults. Capture trusted event values immediately; synthetic/autofill events never teach.
- Route every durable mutation through the service worker queue. Enforce sender/frame scope and stale-edit epochs. Keep legacy hostname records inactive and exportable.
- Use canonical Birthday settings and explicit page-format hints. Do not guess ambiguous date order; local corrected representations replay exactly.
- Backups validate, preview and confirm replacement; pre-restore recovery supports undo. No unconfirmed destructive import.
- Current implementation methodology and resumable progress: `.hermes/plans/2026-09-06_071621-automatic-hardening.md` and `.hermes/plans/STATUS.md`. Read both after a model switch; use regression-first fixes and independent isolated Chromium verification.
- Leave passwords, cards, CVV, and SSN fields untouched to keep secrets outside the extension’s data model.
- Increment `manifest.json` version on every behavioral or UI change so builds remain distinguishable.
- Keep broad `host_permissions` because general always-available form filling is the core function; `activeTab` would break that behavior.
- Keep the Ko-fi badge near the top of the README.

## How to work

- Tests in Chrome. Node checks: `node demo/test_matcher.js src/matcher.js`, `node demo/test_automatic_matcher.js`, `node demo/test_learning_queue.js`, `node demo/test_shared.js`, `node demo/test_storage_automatic.js`, `node demo/test_manifest.js`. Isolated Chromium: `PLAYWRIGHT_MODULE=/tmp/open-autofill-hybrid-qa/node_modules/playwright node demo/test_browser_automatic.js`.
- Practice form: `python3 -m http.server 8765 --directory demo` then Chrome → `http://127.0.0.1:8765/form.html`.
- Store zip = `manifest.json`, `src/`, `icons/` only. Listing copy in `store/`; public site/privacy in `docs/`.

## Chrome Web Store

- Reuse unpublished draft `kjpbmbnipcchfpedcmloghlfkdbbhlff`; “Ready to publish” does not mean public.
- Cancel publish when a new zip must be uploaded. Reusing the draft avoids splitting history across listings.
- Get Scott’s approval before Submit/Publish because those actions affect the external store. The first submit leaves automatic publishing off; an in-depth-review delay is expected.
- Scott uploads the zip, keeping Google credentials out of the agent session.

## Screenshots / privacy

Use isolated Hermes Chromium so screenshots cannot expose his logged-in Chrome data. Listing art uses only Alex Rivera / you@example.com / Springfield IL 62701; keep Everett, 98204, real phone numbers, and personal bookmarks out of every capture. Remade shots also go in `docs/screenshots/`.

## Done

A code change is complete when the relevant Node checks pass, behavior is exercised in Chrome, and `manifest.json` was incremented for any behavioral or UI change. Store submission remains pending until Scott explicitly approves it.
