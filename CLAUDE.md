# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

`zx-kit` is published on npm (`0.1.0`) but currently exports raw TypeScript source (`"exports": { ".": "./src/index.ts" }`). The immediate goal is to add a proper build step that outputs compiled JS + `.d.ts` to `/dist`, so the package works with any bundler without requiring a Vite alias.

## Build

Currently there is no build script. The planned setup (in progress):

```bash
npm run build       # tsc → dist/
npm version patch
npm publish
```

`tsconfig.json` must be updated to emit: add `"outDir": "dist"`, `"declaration": true`, `"declarationMap": true`, `"sourceMap": true`, and remove `"noEmit": true` and `"allowImportingTsExtensions": true`.

## Package structure

Five modules, all re-exported through the barrel `src/index.ts`:

| Module | What it provides |
|--------|-----------------|
| `palette.ts` | `SCALE=4`, `CELL=8`, 15-color `C` object, `SpectrumColor` type |
| `font.ts` | ZX Spectrum ROM font as `Uint8Array` (96 chars × 8 bytes), `getCharRow()` |
| `renderer.ts` | `drawSprite`, `drawChar`, `drawText`, `drawTextCentered`, `mirrorSprite` |
| `audio.ts` | `initAudio`, `resumeAudio`, `beep`, `getAudioContext`, `getMasterGain` |
| `input.ts` | `initInput`, `tickMovement`, `consumeFlag/Debug/Pause/AnyKey`, `isHeld`, `Direction` |

## Architecture constraints

- **No runtime dependencies** — only browser platform APIs (Canvas, Web Audio, KeyboardEvent).
- **Singleton state** — `audio.ts` and `input.ts` hold module-level state; not suitable for multiple game instances on the same page.
- **ZX Spectrum authenticity** — palette values in `palette.ts`, font bytes in `font.ts`, and cell size (`CELL=8`) are constants, not configuration. Do not alter them.
- **`SpectrumColor` type** is `typeof C[keyof typeof C]` — the hex value union, not the key names. Renderer `ink`/`paper` params should use this type, not plain `string`.

## Consuming project (minefield)

The sibling project at `/Users/zrebec/Projects/minefield` currently uses `"zx-kit": "file:../zx-kit"` plus a Vite alias. Once this package builds to `/dist` and exports compiled JS, minefield can switch to the npm version and remove the Vite alias. That is the end goal.

## Key pending work

In priority order (derived from `zx-kit_make_installable_package.md`):

1. Fix `tsconfig.json` to emit (remove `noEmit`, add `outDir: "dist"`, `declaration: true`)
2. Fix `package.json` exports to point at `dist/` and add `build` + `prepublishOnly` scripts
3. Update README — move `file:` instructions to a "Local Development" section; make npm install the default
4. Add `LICENSE` file (MIT)
5. Add `examples/vite-basic` — minimal Vite project that imports from npm, proves the package works end-to-end
