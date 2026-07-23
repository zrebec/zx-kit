# Examples

Short, runnable patterns. For full module APIs see the [reference](api.md); for a start-to-finish build see [getting started](getting-started.md). The two flagship games are the living, full-scale examples:

- **chaosBunny** — cycles four playfield looks (fantasy bricks → mono anti-clash → authentic attr clash) through one small `Painter` adapter.
- **Minefield** — `save`, `rng` daily seed, and presentation helpers in a complete game.

**[Minefield — ZX Spectrum Minesweeper](https://zrebec.github.io/minefield/)** — live demo built entirely with zx-kit.

The repository also includes small static examples that import `../../dist/index.js`
directly, so each one doubles as a browser-checkable API recipe:

| Example | Shows |
|---------|-------|
| `examples/ay-music/` | AY channels A/B/C plus beeper SFX as a four-voice Spectrum-style setup |
| `examples/volume-bar/` | Built-in `+`/`-` volume keys + auto-hide HUD bar with zero extra setup (`initInput` + `drawVolumeBar`) |
| `examples/pixel-collision/` | AABB false positives vs `bitmapPixelMask()` / `masksOverlap()` |
| `examples/particles/` | Allocation-free particle pools for sparks, smoke, and explosions |
| `examples/i18n-runtime/` | Runtime language switching with `pickLocale()` and persisted preference |
| `examples/bitmap-attrs/` | `Bitmap`, `AttrMap`, mirroring, colour clash, and `inkOnly` rendering |
| `examples/dither-shade/` | `drawShade` + `DITHER` (`QUARTER`/`HALF`/`THREE_QUARTERS`) — two colours → five tones (ramps) and a flat-vs-dithered night sky |
| `examples/glow/` | Additive phosphor **bloom** (`createGlowLayer`/`renderGlow`/`drawGlowSource`) — a moving flickering torch + coloured crystals + moon in a dark cave; glow ON/OFF to compare crisp vs. haloed, `+`/`-` bloom strength |
| `examples/save-slots/` | Save profiles, auto/manual slots, latest-slot restore, throttling, and delete |
| `examples/aydump/` | PSG register-dump playback through the AudioWorklet AY emulator (`parsePSG` + `playAYDump`), live stereo presets — the byte stream is synthesised in-page, so no audio assets |
| `examples/stereo-panning/` | Per-channel AY pan (`pattern.pan`) + per-call beeper pan (`beep(..., pan)`) — an L/C/R chord and a ping-pong; headphones required |
| `examples/hiscore/` | High-score table: `isHighScore`/`insertScore` with game `Extra` fields, plus a live "cheat in localStorage" button showing the tamper signature wiping the table |

Build first with `npm run build`, then serve the repository root and open any
example path in the browser.

---
