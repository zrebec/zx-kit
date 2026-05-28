# Runtime i18n

Interactive example showing `pickLocale()` switching a game's string pack while
the game is already running.

The ZX Spectrum never had the memory budget or UX expectations for instant
runtime language switching. zx-kit keeps the Spectrum look, but browser games
can still offer modern conveniences like translated menus, persisted
preferences, and live UI refreshes.

## What It Shows

- `pickLocale(defaultLocale, locales, code)` selects the active string pack.
- Unknown or empty codes fall back to the default locale.
- All locale packs share the same shape, including template functions.
- The selected language is saved in `localStorage` and restored on reload.
- Canvas text is kept ASCII-only because zx-kit's ROM font intentionally covers
  the original printable ASCII range.

## Controls

- Click `EN`, `SK`, or `DE`.
- Press `1`, `2`, or `3`.
- Press `L` to cycle languages.

## Run

Build zx-kit first so `dist/` exists:

```bash
npm run build
```

Then serve the repository root with any static server and open:

```text
examples/i18n-runtime/index.html
```
