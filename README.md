# zx-kit

> **A Speccy-flavoured fantasy toolkit for tiny TypeScript browser games.**
> Inspired by the ZX Spectrum — not an emulator, not a hardware clone.

Spectrum-palette canvas rendering. ROM bitmap font. AY-3-8912 three-channel audio. Beeper SFX. Tile maps. Free-roaming sprites. Collision detection. Saves. Camera. Scene manager. Particle pool. Dithered lighting. Offscreen layer cache. Authentic attribute clash. Monochrome playfield. Zero dependencies. TypeScript-first.

[![npm](https://img.shields.io/npm/v/zx-kit)](https://www.npmjs.com/package/zx-kit)
[![license](https://img.shields.io/npm/l/zx-kit)](LICENSE)

---

## Why zx-kit?

The ZX Spectrum was a marvel of constraint: its 8×8 pixel grid, 15-color palette, and 1-bit beeper defined an entire visual and sonic language. Thousands of games were made with nearly nothing — and they were unforgettable.

zx-kit captures that aesthetic in TypeScript. You get the Spectrum's palette, ROM font, 8×8 cell thinking, beeper sounds, and AY-style chiptune audio — but without the hardware prison. Sprites keep their own colors. Lighting is smooth. Saves work. Mouse and gamepad are supported. The 256×192 canvas is a soft constraint, not a law.

**Think of it as a tiny fantasy console in the spirit of the ZX Spectrum** — not an emulator, not a hardware clone, but a tool that lets that aesthetic live in modern TypeScript games.

---

## Key Features

- **AY-3-8912 Melodik emulator** — three independent square-wave channels, LFSR noise generator, all 16 hardware envelope shapes, logarithmic amplitude table accurate to the real chip
- **ZX Spectrum ROM font** — all 96 printable ASCII characters, 8×8 pixels, byte-for-byte faithful to the original ROM
- **Authentic 15-color palette** — normal and bright variants, palette-enforced at compile time via the `SpectrumColor` type
- **Canvas renderer** — pixel-perfect scaled rendering, sprite flipping, text drawing, CRT scanline overlay, animated border flashing
- **Tile map engine** — scrollable maps, O(1) id-index, smart seasonal background swapping, solid-tile collision queries
- **Offscreen layer cache** — render a static or rarely-changing layer (tile map, CRT overlay) once to an offscreen canvas and blit it each frame; `dirty`-flag invalidation turns thousands of per-pixel `fillRect`s into a single `drawImage`
- **Authentic attribute clash (opt-in)** — a 32×24 cell ink/paper screen that reproduces the real Spectrum colour bleed when a sprite and the background share an 8×8 cell; resolved to one `putImageData`/frame. Off by default, on when you want it
- **Monochrome playfield (opt-in)** — the classic anti-clash trick: render the action area in a single ink + paper at its own size, keep the colour in the HUD around it. Everything inside becomes a clean two-colour silhouette — no clash, ever
- **Free-roaming sprites** — position, velocity, gravity, `flipX` caching, transparent or opaque background
- **Three-tier collision** — AABB overlap tests, generic rect-vs-tile wall resolution (any sprite size), and pixel-precise mask overlap with O(pixels) sorted-merge intersection — no allocations per frame
- **Keyboard and gamepad input** — configurable key-repeat, transparent gamepad polling, single-consume action flags, instant state reset on phase transitions, built-in `+`/`-` volume with an auto-hide HUD bar (one render-loop line)
- **ZX-style UI widgets** — progress bars with managed lifetime, boxes, frames, panel titles
- **Typed save / load** — persistent saves via `localStorage` with schema versioning, migrations, slot enumeration, in-memory throttling, and discriminated Result types for every failure mode
- **Runtime locale switching** — type-safe string-pack selection via `pickLocale()`, so a game can switch language while running — unimaginable on the original Spectrum, natural in the browser
- **Zero dependencies** — only Web platform APIs: `Canvas`, `Web Audio`, `KeyboardEvent`, `Gamepad`
- **Tree-shakeable** — `sideEffects: false`, so unused modules are dropped from your production bundle
- **TypeScript-first** — strict mode, full `.d.ts` declarations, no `any`

---

## Spectrum-inspired, not hardware-accurate by default

zx-kit is not a ZX Spectrum emulator, and the **default** renderer does not model the hardware attribute clash (where every 8×8 cell can hold only one ink/paper pair), the ULA timing, or the Z80 memory layout. The default path composites in full colour, so sprites keep their own colours and never bleed into the background.

What it does model is the **aesthetic discipline** of the Spectrum:

- 256×192 canvas (soft constraint — you can go larger)
- 15-color palette, compile-time enforced via `SpectrumColor`
- 8×8 cell rhythm for tiles, sprites, and UI
- ROM-accurate font (byte-for-byte from the original ROM)
- Monochromatic bitmap sprites
- Beeper-style 1-bit SFX
- AY-3-8912-style three-channel chiptune audio

**Want the real thing?** Three opt-in rendering paths cover the spectrum from fantasy to faithful:

| Path | Module | Look |
|------|--------|------|
| **Fantasy** (default) | `renderer` | Full-colour compositing — sprites keep their colours, no bleed. Best for readability. |
| **Authentic clash** | `attrscreen` | 1-bit pixels + a 32×24 ink/paper grid: real per-cell colour bleed when a sprite and the background share an 8×8 cell. |
| **Anti-clash** | `monoscreen` | One ink/paper for the whole playfield — clash-proof monochrome action, with a colourful HUD around it. |

A white hero walking past a green plant stays white under the **default** renderer, bleeds the shared cell under **`attrscreen`**, and is a clean silhouette under **`monoscreen`** — your choice, per game or per in-game toggle.

---

## Installation

### From npm (recommended)

```bash
npm install zx-kit
```

Then import directly — no Vite alias, no path mapping, no bundler configuration required:

```ts
import { setupCanvas, C, CELL, initAudio, playAY, initInput } from 'zx-kit'
```

The package ships compiled JavaScript (`dist/`) with full TypeScript declarations.

### From source (local / offline development)

Clone the repository and link it into your project:

```bash
# 1. Clone and build zx-kit
git clone https://github.com/zrebec/zx-kit.git
cd zx-kit
npm install
npm run build

# 2. In your game project — install from local path
npm install ../zx-kit
```

> Use `npm install ../zx-kit --prefer-online` if npm caches the local path aggressively.
> Switch back to the npm version any time: `npm install zx-kit@latest`

---

## Quick Start

A game loop in under 30 lines:

```ts
import {
  setupCanvas, C, CELL,
  drawText, drawSprite,
  initAudio, createAY,
  initInput, tickMovement,
} from 'zx-kit'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = setupCanvas(canvas, 4)  // 256×192 game px → 1024×768 CSS px

initInput()

// Audio must start inside a user gesture (browser policy)
let ay: ReturnType<typeof createAY> | null = null
window.addEventListener('keydown', () => {
  initAudio()
  ay = createAY()
  ay.tone('A', 440, 10)  // start a tone on channel A
}, { once: true })

const PLAYER = new Uint8Array([0x18, 0x3C, 0x7E, 0xFF, 0xFF, 0x7E, 0x24, 0x66])
let px = 120, py = 88

let last = performance.now()
function loop(now: number) {
  const dt = now - last; last = now

  const dir = tickMovement(dt)
  if (dir === 'left')  px -= 1
  if (dir === 'right') px += 1
  if (dir === 'up')    py -= 1
  if (dir === 'down')  py += 1

  ctx.fillStyle = C.BLACK
  ctx.fillRect(0, 0, 256, 192)
  drawText(ctx, 'ZX-KIT', 0, 0, C.B_GREEN, C.BLACK)
  drawSprite(ctx, PLAYER, px, py, C.B_CYAN, C.BLACK)

  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
```

---

## Documentation

| Guide | What's inside |
|-------|---------------|
| [Getting started](docs/getting-started.md) | Project setup + a complete first game, start to finish. |
| [Rendering](docs/rendering.md) | Canvas, sprites, bitmaps, attr/mono screens, cache, scrolling, lighting, palette, font. |
| [Audio](docs/audio.md) | Beeper vs AY, the AY-3-8912 emulator, note-name music. |
| [Collision](docs/collision.md) | AABB, rect-vs-tile, pixel-precise — when and how. |
| [Save / load](docs/save.md) | Typed `localStorage` saves with versioning and migration. |
| [API reference](docs/api.md) | Input, sprites, animation, camera, scenes, tilemap, UI, particles, RNG, i18n, presentation. |
| [Examples](docs/examples.md) | Runnable snippets + the flagship games. |
| [API stability](docs/api-stability.md) | What's Stable vs Experimental, the deprecation policy, and the road to 1.0. |

Background: [retrospective](docs/retrospective.md) · [debug / telemetry analysis](docs/analyza-debug.md).

## Modules

Everything is re-exported from the package root — `import { setupCanvas, createAY, /* ... */ } from 'zx-kit'`.
Zero runtime dependencies, `sideEffects: false`, fully tree-shakeable.

| Module | Summary | Guide |
|--------|---------|-------|
| `palette` | `SCALE`, `CELL`, the 15-colour `C` object, `SpectrumColor` type | [rendering](docs/rendering.md#palettets--color-constants) |
| `font` | 96-char ROM 8×8 bitmap font, `getCharRow` | [rendering](docs/rendering.md#fontts--rom-bitmap-font) |
| `renderer` | Canvas setup, sprites, text, bitmaps, attribute maps, scanlines, border flash | [rendering](docs/rendering.md#rendererts--canvas-renderer) |
| `cache` | Offscreen layer cache with dirty-flag invalidation | [rendering](docs/rendering.md#cachets--offscreen-layer-cache) |
| `attrscreen` | Opt-in authentic per-cell ink/paper colour clash | [rendering](docs/rendering.md#attrscreents--attribute-clash-opt-in) |
| `monoscreen` | Opt-in monochrome playfield + colour HUD (clash-proof) | [rendering](docs/rendering.md#monoscreents--monochrome-playfield) |
| `tilescroll` | Pixel-smooth sub-tile tilemap scrolling | [rendering](docs/rendering.md#tilescrollts--pixel-smooth-scrolling) |
| `lighting` | Dithered cave darkness, one blit per frame | [rendering](docs/rendering.md#lightingts--dithered-cave-darkness) |
| `audio` | 1-bit beeper: square-wave notes, patterns, volume + built-in auto-hide volume bar | [audio](docs/audio.md#audiots--beeper-audio) |
| `ay` | AY-3-8912: 3-channel tone, LFSR noise, 16 envelopes | [audio](docs/audio.md#ayts--ay-3-8912-melodik-audio) |
| `music` | AY music by note name (`A5`, `C#4`) + looping | [audio](docs/audio.md#musicts--note-name-ay-music) |
| `collision` | AABB / rect-vs-tile / pixel-precise mask overlap | [collision](docs/collision.md) |
| `save` | Typed save/load: versioning, migration, slots, throttle | [save](docs/save.md) |
| `input` | Keyboard + gamepad movement, key-repeat, action flags, built-in `+`/`-` volume keys | [api](docs/api.md#inputts--keyboard--gamepad-input) |
| `sprite` | Free-roaming sprites: position, velocity, gravity, flip | [api](docs/api.md#spritets--free-roaming-sprites) |
| `animation` | Frame timer, position tween, blinker | [api](docs/api.md#animationts--frame-timer--tween) |
| `camera` | Viewport follow with lerp + deadzone, world clamp | [api](docs/api.md#camerats--scrolling-camera) |
| `scene` | Stack-based scene manager with lifecycle hooks | [api](docs/api.md#scenets--scene-manager) |
| `tilemap` | Scrollable maps, solid tiles, O(1) id-index, bg swap | [api](docs/api.md#tilemapts--tile-map-engine) |
| `ui` | Boxes, frames, panel titles, progress bars, gauges | [api](docs/api.md#uits--ui-widgets) |
| `particles` | Allocation-free particle pool for pixel effects | [api](docs/api.md#particlests--particle-pool) |
| `rng` | Seeded mulberry32 PRNG (int/range/float/pick/shuffle/fork) | [api](docs/api.md#rngts--seeded-rng) |
| `i18n` | Type-safe runtime locale selection | [api](docs/api.md#i18nts--runtime-locale-selection) |
| `presentation` | Title/loading helpers: blink, tape stripes, menus | [api](docs/api.md#presentationts--title--loading-helpers) |
| `debug` | Frame-timing monitor + FPS/CPU/custom overlay | [api](docs/api.md#debugts--debug-overlay) |

## Architecture

### Module structure

```
zx-kit/
├── package.json           # exports: { ".": "./dist/index.js" }, sideEffects: false
├── tsconfig.json          # strict, emits to dist/
├── README.md
├── src/
│   ├── index.ts           # barrel — re-exports everything
│   ├── palette.ts         # SCALE, CELL, C, SpectrumColor
│   ├── font.ts            # FONT, getCharRow
│   ├── renderer.ts        # canvas setup, 8×8 sprites, arbitrary-size Bitmap,
│   │                      # AttrMap colour attributes, text, scanlines, border flash
│   ├── audio.ts           # initAudio, resumeAudio, beep, playPattern,
│   │                      # getAudioContext, getMasterGain,
│   │                      # getMasterVolume, setMasterVolume,
│   │                      # increaseVolume, decreaseVolume, Note,
│   │                      # setVolumeBarStyle, drawVolumeBar
│   ├── ay.ts              # createAY, playAY, AYChannel, AYNote, AYChip,
│   │                      # AY_VOL, AY_CLOCK, AY_ENVELOPE_SHAPES
│   ├── input.ts           # initInput, tickMovement, consumeFlag,
│   │                      # consumePause, consumeDebug, consumeAnyKey,
│   │                      # isHeld, resetInput, setVolumeKeys, Direction
│   ├── ui.ts              # drawBox, drawFrame, drawPanelTitle,
│   │                      # instrumentation widgets, progress bars
│   ├── tilemap.ts         # createTileMap, Tile, Viewport, TileMap
│   ├── tilescroll.ts      # drawTileMapAt, tileMapWorldSize (sub-pixel scroll)
│   ├── sprite.ts          # createSprite, moveSprite, applyGravity,
│   │                      # renderSprite, Sprite
│   ├── collision.ts       # AABB, rect-vs-tile, pixel-precise masks
│   ├── particles.ts       # createParticleSystem, emitParticles,
│   │                      # tickParticles, renderParticles, clearParticles
│   ├── rng.ts             # createRng, hashSeed (seeded mulberry32)
│   ├── animation.ts       # frame timers, tweens, blinkers
│   ├── camera.ts          # scrolling viewport, lerp, deadzone, bounds
│   ├── scene.ts           # stack-based scene manager
│   ├── save.ts            # typed localStorage save/load with migrations
│   └── i18n.ts            # pickLocale runtime locale selection
└── dist/                  # compiled output (npm run build)
    ├── index.js
    ├── index.d.ts
    └── ...
```

### Design decisions

**No runtime dependencies.** Every module uses only Web platform APIs — `CanvasRenderingContext2D`, `AudioContext`, `KeyboardEvent`. There is nothing to install, no transitive vulnerabilities, no version drift from third-party packages.

**Singleton state.** `audio.ts`, `ay.ts`, and `input.ts` hold module-level state. This is intentional: a game has one audio context, one input handler. It is not suitable for multiple independent game instances on the same page.

**Compiled distribution.** The package ships compiled JS + `.d.ts` to `dist/`. Any bundler (Vite, webpack, esbuild, Rollup) consumes it without aliases or configuration.

**`sideEffects: false`.** All module-level initialisation is lazy — no DOM access, no event listeners, no network calls at import time. Bundlers can tree-shake any module whose exports are not used. Import only `playAY` and `createAY` and the beeper, input, and UI modules are completely excluded from your production bundle.

**Spectrum aesthetic constants.** The palette values, cell size (`CELL = 8`), and font bytes are fixed constants, not configuration — they define zx-kit's visual identity. The `SpectrumColor` type enforces the palette at the TypeScript level: you cannot accidentally pass an arbitrary hex string where a Spectrum color is expected. This is aesthetic discipline, not hardware emulation — zx-kit is a Speccy-flavoured fantasy toolkit, not a ZX Spectrum clone.

**AY clock accuracy.** `AY_CLOCK = 1_773_400 Hz` and `AY_VOL[]` are measured values from the real AY-3-8912 chip. The LFSR noise buffer uses the correct 17-bit polynomial (`bit = (lfsr ^ (lfsr >> 2)) & 1`). The logarithmic amplitude table uses the real chip's ≈ √2 step factor (3 dB per level).

---

## License

MIT — see [LICENSE](LICENSE).

---

*zx-kit is extracted from [Minefield](https://github.com/zrebec/minefield), a ZX Spectrum-style minesweeper game.*
