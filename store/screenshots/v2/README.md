# Open Autofill — listing art v2

Four 1280×800 RGB PNGs, in upload order. Their sibling HTML files are self-contained: frozen product CSS, embedded current icon, real popup/settings markup excerpts, and presentation-only scale/layout overrides. No live extension or personal profile is loaded. Artwork retains its **v1.7.6** label as requested for an icon-only edit; the icon-refresh package is **v1.7.7**. These are composed marketing illustrations of the real UI, not recordings of live extension execution. Form content is fictional.

## Claim map — one line per image

- **`01-already-answered-1280x800.png` — “Less typing. Already answered.”** Automatic matching/subhead/filled annotation: README Everyday use, “Recognizable identity fields fill automatically, including forms that appear late.” Free/no daily limit chips: README introduction, “Always free. Local only. No daily cap.” No automatic submission chip: README Safety, “No form is submitted automatically.” “Already answered” is qualified by **matching fields**, not all forms.
- **`02-extra-questions-1280x800.png` — “Even the extra questions. Answered again.”** Extras/Remember/button story: README Everyday use, “Remember this page (saves extras, checkbox/radio state, and site-specific answers currently on the form; never changes Your usual answers).” Next visit/same form annotation: “Come back to the same form: local corrections take priority.” Checkbox chip: “Clearing a field remembers that it should stay blank; checked and unchecked choices both persist.” Dropdown chip: README Formats, “A locally corrected dropdown replays its exact stored option value.” LISTING also supports “Odd extra questions that only appear on some sites.” No comparative claim about all other autofill products.
- **`03-defaults-stay-yours-1280x800.png` — “Your usual answers. Still yours.”** Headline/subhead/local correction and unchanged-default labels/chips: README, “Page edits never rewrite Your usual answers, even on submit or Remember this page.” Scope: README Safety, “Site memory uses the exact origin (scheme, host, port) and a form scope. Different origins and distinct forms do not share corrections.” Example: the fictional form’s Preferred name is Alex Rivera; the popup’s default remains Alex. “Site-and-form local” is shorthand for exact-origin-and-form scope, not whole-domain sharing.
- **`04-free-and-local-1280x800.png` — “Always free. Local only. No daily limit.”** Headline/chips: README introduction, “Always free. Local only. No daily cap.” Storage: LISTING, “Your answers stay in this Chrome profile.” Account/cloud: LISTING, “Always free. No ‘10 fills per day.’ No account. No cloud.” Telemetry: README Honest limits, “No macros, CAPTCHA solving, cloud sync, analytics, or external model calls” (no telemetry describes the documented absence of analytics). Safety settings: README, “Passwords, payment details, SSNs, one-time codes, CAPTCHAs, and search controls remain excluded, including during explicit Fill”; exact checkbox copy is from `src/options.html`. Privacy qualifier: README, “Local-only is not a privacy shield from the page: website scripts can read a filled value before Submit.” Source availability: README local development, “Clone or download this repository,” with its GitHub support/repository link. The narrower **“Source on GitHub”** is used because neither approved copy document explicitly states an open-source license.

## Deliberate limits and fidelity

- No encryption claim, blanket “private from websites” promise, every-form guarantee, password/payment filling, competitor name, or claim that one page can change defaults.
- “Fields other autofills skip” was softened to “Even the extra questions”: the sources establish extra-question memory, not a universal comparison with competing extensions.
- “No daily limit” follows the requested wording and LISTING short description.
- No account/cloud/telemetry is about the extension, not the websites where a user fills forms.
- The first two cards excerpt the real `.topbar`, `.app-heading`, `.title-row`, `.version`, `.actions`, and button markup from `src/popup.html`; the third uses its `.grid`/`.field` identity treatment. The fourth uses the real options header and disabled safety settings. Typography and spacing are enlarged for store readability. Omitted parts are excerpts, not replacement product UI.
- Generic example.com forms use native inputs and the existing filled-outline treatment; they are not presented as the extension's settings UI. Mint and Saturday are fictional extra-answer examples. Identity is limited to Alex Rivera/Alex, you@example.com, Springfield and 62701. No phone, bookmarks, inbox, or real user data.
- Artwork uses the approved refreshed icon, also installed under `icons/`. The proposal sources remain in `../../assets/icon-proposal/`. Pixel comparison confirms only the two icon regions (including resampling edges) changed in each image; all other pixels and all non-icon HTML are identical.

## Review and verification

- Each PNG rendered with headless installed Google Chrome at **2560×1600 (2×)** using a fresh disposable profile, then LANCZOS-downsampled to **1280×800**, RGB without alpha.
- Each final image visually reviewed at both **1280×800** and a separately generated **640×400** raster. Review repairs included separating the trust footnote from the card, increasing comparison labels, and clearing popup/card edges from captions and the benefit row.
- Live browser DOM measurements: headlines **76px**, subheadlines **32px**, smallest visible text **24px**. Most supporting labels on image 03 are 26px. Text/input horizontal overflow checks passed. Decorative background rings intentionally extend beyond the clipped canvas.
- Solid square-corner full-bleed backgrounds; no outer shadow border, transparency, or outer padding. Shadows are only on UI cards within the canvas.
- `contact-sheet.html` embeds all four PNGs and displays each at exactly 640×400 CSS pixels, at browser zoom 100%. It works offline without sibling assets. `contact-sheet.png` is a compact 2×2 overview.
- Identical copies of the four PNGs are in `../../../docs/screenshots/`, using the same filenames. Earlier-generation screenshot PNGs remain untouched. Refreshed production icons ship with manifest v1.7.7; extension behavior and screenshot copy/layout are unchanged. Chrome Web Store submission remains manual.

## Re-render one image after changing copy

Run from the repository root. Use a **new isolated profile**, never the normal Chrome profile:

```sh
PROFILE=$(mktemp -d "$HOME/.hermes/cache/scratch/oa-render.XXXXXX")
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --hide-scrollbars --no-first-run --no-default-browser-check \
  --user-data-dir="$PROFILE" \
  --force-device-scale-factor=2 --window-size=1280,800 \
  --screenshot="$PWD/store/screenshots/v2/01-already-answered-1280x800.png" \
  "file://$PWD/store/screenshots/v2/01-already-answered.html"
sips -z 800 1280 store/screenshots/v2/01-already-answered-1280x800.png
```

On this machine Chrome can remain running after it writes the complete PNG. If that happens, interrupt only that dedicated renderer once the output is fully written, then run `sips`. Never terminate a daily-browser instance. Recheck the resulting dimensions and RGB/no-alpha mode, inspect at 50%, update the docs copy and regenerate the contact sheet after changing a frame.
