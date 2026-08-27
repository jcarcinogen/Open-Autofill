# Open Autofill

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/T2J625IUHY)

A Chrome extension that remembers what you type in forms and fills it again the next time. Local only. **No daily cap. Always free.**

This is original software for your own browser profile. It is not Lightning Autofill and does not use their code.

## What it does

- Keeps a reusable **identity** (email, name, address, phone, Instagram, etc.)
- Also remembers **odd extra fields per website** that Chrome’s built-in autofill misses
- Learns as you type, blur, or submit
- Remembers **Official Rules / I agree** checkboxes (not marketing opt-ins)
- Auto-fills when a page loads, including fields that appear late
- Leaves **search boxes** alone by default (Google, Bing, Gmail, Outlook). Turn that on in settings if you want it.
- Keyboard: `Alt+Shift+F` fill, `Alt+Shift+S` remember
- Right-click: fill, remember, or ignore this site
- Skips passwords, card numbers, CVV, and SSN
- Export / import a JSON backup from the options page

## Install in Chrome

1. Clone or download this repo
2. Open Chrome → `chrome://extensions`
3. Turn on **Developer mode**
4. Click **Load unpacked**
5. Choose the **Open-Autofill** folder (the one that contains `manifest.json`)
6. Pin **Open Autofill** on the toolbar
7. Open the icon and type your usual answers once

If it is already loaded from an older folder name, remove it and Load unpacked again from `Open-Autofill`.

## Try the practice form

From this folder:

```bash
python3 -m http.server 8765 --directory demo
```

Visit [http://127.0.0.1:8765/form.html](http://127.0.0.1:8765/form.html) **in Chrome**, fill it, submit or click **Remember this page**, then reload.

## Limits (honest)

- It is not a clone of Lightning Autofill’s rule language, JavaScript macros, or recaptcha features.
- Custom dropdowns that are not real `<select>` elements may not fill.
- Cross-origin widgets inside iframes only fill if the iframe is a normal `http(s)` page the extension can see.
- Data lives in this Chrome profile only. It does not sync unless you export the JSON.

## Support

Open Autofill is free and always will be. Tips are optional:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/T2J625IUHY)

## Tests

```bash
python3 demo/test_matcher.py
```

## Chrome Web Store (later)

Draft listing and privacy policy live in `store/`. Do not zip or submit until testing is done. The extension will stay free and local-only.
