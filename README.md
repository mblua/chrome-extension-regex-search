# Regex Search

A lightweight Chrome extension that finds regex matches in the **visible text** of any web page and **highlights every occurrence in place** — all matches in yellow, the current one in orange, with smooth scroll-to navigation between them. The last search is remembered and re-applied automatically as you browse.

Manifest V3. No build step, no dependencies — just vanilla JavaScript.

## Features

- **Live in-page highlighting** — every match is wrapped in a `<mark>` and painted yellow directly on the page; the currently focused match is emphasized in orange with a red ring. Matches disappear the moment you press **Clear**.
- **True regex search** — full JavaScript `RegExp` support with toggleable `i`, `m`, and `s` flags.
- **Visible-text only** — ignores `<script>`, `<style>`, hidden elements, form `value`/`placeholder` attributes, ARIA labels, and other internal fields. What you see is what gets searched.
- **Cross-node matching** — finds patterns even when the DOM splits the text across multiple elements (e.g. `<span>1</span><span>min</span>` still matches `\d+min`).
- **Persistent auto-search** — after you run a search, the extension re-highlights the same pattern on every page you visit and every time the DOM changes (SPAs, infinite scroll, lazy-load), without hijacking your scroll position.
- **Match navigation** — `▶` / `◀` or `Enter` / `Shift+Enter` to step through matches; the current one is scrolled into view and emphasized.
- **Localized UI** — English (default), Spanish, German, French, Portuguese, Italian. Chrome picks automatically based on browser language.
- **Privacy-respecting** — no network calls, no analytics, no remote code. Everything runs locally.

## Install

The extension is not on the Chrome Web Store. Install it unpacked:

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome (or Edge).
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select this folder.
5. Pin the extension icon to the toolbar if you want easy access.

When prompted, grant access to *"all sites"* — the extension needs this to run on each page you visit in order to re-apply the search.

## Usage

1. Click the extension icon.
2. Type a regex pattern (without the `/.../` delimiters).
3. Tick the flags you want (`i`, `m`, `s`). A `g` flag is always implied.
4. Press **Search** (or Enter). Matches are highlighted in yellow; the current one in orange.
5. Use `▶` / `◀` to navigate.
6. Navigate the site normally — matches re-appear on every page. Press **Clear** to stop.

### Tips

- `\b\d{2}min\b` → matches `15min` but not `150min` or `1min`.
- `\b[A-Z][a-z]+\s+[A-Z][a-z]+\b` → capitalized two-word names.
- Toggle `i` for case-insensitive search.

## Supported languages

| Locale | Code |
| ------ | ---- |
| English (default) | `en` |
| Spanish | `es` |
| German | `de` |
| French | `fr` |
| Portuguese | `pt` |
| Italian | `it` |

Translation files live in [`_locales/`](./_locales). Contributions for more locales welcome — copy `_locales/en/messages.json`, translate the `message` fields, and open a PR.

## Limitations

- **Shadow DOM** (closed roots) and **cross-origin iframes** are not traversed — a Chrome-enforced boundary.
- **SVG `<text>` elements** are skipped; HTML `<mark>` cannot be injected into SVG content.
- Very permissive patterns (`.*`) are capped at **10 000 matches** per page to keep the DOM responsive.

## Privacy

This extension:

- Does **not** make any network request.
- Does **not** load remote code or analytics.
- Stores only the last regex, its flags, and an on/off flag in `chrome.storage.local` (local to your browser profile).

The `<all_urls>` host permission is required so the content script can run on each page and re-apply the search after navigation.

## Development

```
.
├── manifest.json         # MV3 manifest
├── popup.html            # Extension action popup markup
├── popup.css             # Popup styles
├── popup.js              # Popup logic + i18n binding
├── content.js            # DOM walker, regex highlighter, MutationObserver
├── _locales/<lang>/      # messages.json per supported locale
│   ├── en/
│   ├── es/
│   ├── de/
│   ├── fr/
│   ├── pt/
│   └── it/
├── LICENSE               # MIT
└── README.md
```

To iterate:

1. Make changes.
2. Go to `chrome://extensions` → click the reload (🔄) button on the extension card.
3. Reload any page you were testing on (content scripts are injected fresh on new navigations, not existing tabs).

## Author

**Mariano Blua** — [LinkedIn](https://www.linkedin.com/in/mariano-blua)

## License

[MIT](./LICENSE) © [Mariano Blua](https://www.linkedin.com/in/mariano-blua)
