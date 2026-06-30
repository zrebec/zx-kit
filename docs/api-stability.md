# API stability & versioning

zx-kit is pre-1.0. This document is the contract: what you can rely on, what may still move,
and how changes are communicated — so the consumer games can pin and upgrade with confidence.

The package exposes **only its root export** (`import { … } from 'zx-kit'`). Subpaths are not part
of the public API. Anything not re-exported from `src/index.ts`, or prefixed with `_`, is internal.

## Status levels

| Level | Meaning | Change policy |
|-------|---------|---------------|
| **Stable** | Proven, tested, used across the games. The committed surface. | Pre-1.0: avoided; any break ships with a CHANGELOG **Migration** note. Post-1.0: breaking changes only in a **major** (SemVer). |
| **Experimental** | Newest / opt-in / still evolving. Safe to use, but expect movement. | May change signature or behaviour in a **minor**, even pre-1.0. Pin your version; read the CHANGELOG on upgrade. |
| **Internal** | Not exported from the barrel, or `_`-prefixed. Not public API. | May change anytime, no notice. Don't import via subpaths. |

## Module classification

| Module | Status | Since | Notes |
|--------|--------|:-----:|-------|
| `palette` | **Stable** | core | Identity constants (`C`, `CELL`, `SCALE`, `SpectrumColor`) — frozen, never change. |
| `font` | **Stable** | core | ROM 8×8 bitmap font — frozen. |
| `renderer` | **Stable** | core | Canvas setup, sprites, text, bitmaps, attr maps, scanlines, border flash. Dither/shade (`drawShade`, `DITHER`, 0.35) is **Experimental** at first. |
| `audio` | **Stable** | core | 1-bit beeper. Volume HUD bar (`setVolumeBarStyle`/`drawVolumeBar`, 0.34) and the `beep` `pan` arg (0.36) are **Experimental** at first. |
| `ay` | **Stable** | core | AY-3-8912 emulator; `AY_CLOCK`/`AY_VOL` are measured constants — frozen. Per-channel stereo (`pan`/`setStereoMode`) + volume (`volume`/`fade`), 0.36, are **Experimental** at first. |
| `input` | **Stable** | core | Keyboard + gamepad (transparent). Built-in volume keys + `setVolumeKeys` (0.34) **Experimental** at first. |
| `sprite` | **Stable** | core | Free-roaming sprites. |
| `collision` | **Stable** | core | AABB / rect-vs-tile / pixel-precise. Survived Ice Haul twice with no API change. |
| `animation` | **Stable** | core | Frame timer, tween, blinker. |
| `camera` | **Stable** | core | Scrolling viewport. |
| `scene` | **Stable** | core | Stack-based scene manager. |
| `tilemap` | **Stable** | core | Tile map engine. |
| `tilescroll` | **Stable** | core | Pixel-smooth sub-tile scrolling over `tilemap`. |
| `ui` | **Stable** | core | Boxes, frames, gauges, progress bars. |
| `particles` | **Stable** | core | Allocation-free particle pool. |
| `rng` | **Stable** | 0.24 | Seeded mulberry32. |
| `save` | **Stable** | 0.16 | Typed save/load + migration; full test suite. |
| `i18n` | **Stable** | core | `pickLocale`. |
| `cache` | **Stable** | 0.29 | Offscreen layer cache. Flagship-proven (chaosBunny). |
| `attrscreen` | **Stable** | 0.30 | Per-cell attribute clash. Flagship-proven (chaosBunny 4-mode cycle). |
| `monoscreen` | **Stable** | 0.31 | Monochrome playfield. Flagship-proven (chaosBunny). |
| `music` | **Experimental** | 0.31 | Note-name convenience layer over `ay` (`seq`, `playAYLoop`); the helper API may grow/change. |
| `presentation` | **Experimental** | 0.32 | Brand new title/loading helpers; the set is expected to expand (transitions, attract mode). |
| `lighting` | **Experimental** | core | Opt-in dithered darkness; likely to be reshaped by the planned GLOW/CRT work. |
| `debug` | **Experimental** | 0.33 | First slice (frame timing + FPS/CPU overlay); resolution / heap / draw-counts to follow, so the API will grow. |

**Experimental today:** `music`, `presentation`, `lighting`, `debug`. Everything else is **Stable** —
except the brand-new built-in volume control (`setVolumeBarStyle`/`drawVolumeBar` in `audio`,
`setVolumeKeys` + default `+`/`-` keys in `input`, 0.34), which is **Experimental at first** even though
its host modules are Stable: the options object (`color`/`segments`/`x`/`y`) may grow before it settles.
The same applies to the new **stereo controls** (`beep` `pan`; AY `pan`/`setStereoMode`/`volume`/`fade`,
0.36): the pan range, volume scale, and the `mono`/`abc`/`acb` presets may still move before they settle.

## Deprecation policy

- **Renames and removals go through a deprecation cycle.** The old export stays as a thin alias
  marked `@deprecated` (pointing at the replacement) for at least **one minor** pre-1.0, or **one
  major** post-1.0, with a CHANGELOG **Migration** note, before it is removed. No silent removals.
- **Behaviour changes are treated like API changes.** If output changes for the same call (e.g. the
  `flashBorder` rAF model change), it ships with a CHANGELOG note even though the signature is unchanged.
- **Identity constants are frozen.** The palette `C`, `CELL = 8`, the font bytes, and the measured AY
  constants (`AY_CLOCK`, `AY_VOL`) are not configuration and will never change — that is the whole point.
- **Experimental → Stable** is additive (no break); **Stable → Experimental** does not happen.

## Toward 1.0

- **1.0 locks the Stable set under SemVer.** At 1.0 the Experimental modules either graduate to Stable
  or are explicitly documented as still-experimental in the 1.0 notes.
- **No new engine modules are planned** (Spectrum philosophy: less is more). The remaining pre-1.0 work
  is hygiene — this classification, CHANGELOG cleanup, and consumer version bumps — not engine surface.

## Naming

- **`lighting`, not "lightning"** — a historical typo that is already resolved; the module is
  `lighting.ts`. There are no outstanding public-name typos.
- **Short names are intentional and kept** — `C` (palette), `seq`, `beep`, `stampMono`, etc. are
  established across the games. Any future rename for clarity follows the deprecation policy above
  rather than being changed silently.
