# zx-kit — Retrospective (May 2026)

> Anchor written after v0.16.0 (save system). Reference point — where we are, what's next, and why.

---

## Where it started

The first commit was pragmatic: a handful of utilities extracted from Minefield to avoid duplication. `setupCanvas`, `playPattern`, `flashBorder` — things that would otherwise be copy-pasted into every project. v0.1, no grand vision, just a healthy refactor.

Today zx-kit has 16 releases, 15 modules, and 3,283 lines of code. That number wasn't planned — it grew organically from real need.

---

## What worked

**API style discipline.** The whole library is consistent: functional calls, no classes, no `new`. `createAnimation`, `createCamera`, `createSaveProfile` — all the same pattern. Across 15 modules written at different times, that takes real attention.

**AY-3-8912 emulator.** The most technically interesting piece in zx-kit. 397 lines, LFSR noise, envelope, tone channels. Most retro game libraries stop at "square wave oscillator." This goes further.

**Save system.** Discriminated result types, per-slot throttling, migrate callback, namespaced localStorage — decisions that will pay off. First serious test suite in zx-kit (31 tests), and it caught a real bug (`?? 0` throttle regression) in the process.

**TileMap.** Simple and sufficient. `getTile`, `setTile`, `TILE_EXPLODED` singleton — nothing superfluous.

**Documentation.** The README isn't just a function list — it has context, rationale, and ZX Spectrum philosophy baked in.

---

## What needs work

**Test coverage is near zero.** Save has 31 tests. The other 14 modules have 0. Camera, Scene manager, Animation, TileMap, Input, AY — all untested. When something breaks, debugging is manual. This is technical debt number one.

**Input module has no clean contract for multi-screen games.** `resetInput` clears buffers but gamepad state persists. Minefield works around this manually with `consumeAnyKey()` on phase transitions. The input module should own this contract, or at least document what reset does and doesn't cover.

**Scene manager is too thin.** Stack-based lifecycle is a good foundation, but Minefield doesn't use it — it manages phases with its own `appPhase`. Either the scene manager needs more (state ownership, automatic render dispatch) or it's ceremonial API.

**Camera and Collision are unverified in practice.** Minefield doesn't use either. Frogger will reveal whether the API fits a real use case.

**`palette.ts` is 43 lines exporting 1 type.** `SpectrumColor` could live in `renderer.ts`.

---

## The "big framework" problem

Looking at zx-kit today — 15 modules, AY emulator, save system, camera, scene manager — it's starting to look like a framework. And frameworks have well-known problems:

1. **Dependency flows one way.** Changing API in zx-kit means fixing Minefield simultaneously. Manageable now, but the friction is real.
2. **zx-kit has no game of its own.** Minefield is the de facto reference, which means the API is shaped around one use case.
3. **Versioning overhead.** Every `feat:` commit = `npm install` in consuming projects.

**But.** If zx-kit serves as a personal toolbox for a series of Spectrum-style games, that's a legitimate purpose and the current complexity is proportionate. "Big framework troubles" don't mean it's a bad idea — they mean you need to know *why* you're doing it.

---

## What's next

### Phase 1 — Tests (blocker for everything else)

**Target: 75% code coverage minimum, ideally higher. Smoke tests are the baseline.**

Priority by impact:

| Module | Why now |
|--------|---------|
| `save.ts` | Has 31 tests — maintain and extend |
| `tilemap.ts` | Used by Minefield and all future games |
| `animation.ts` | Tween and Blinker are critical for gameplay |
| `input.ts` | Gamepad + keyboard interaction, reset edge cases |
| `audio.ts` | At minimum a smoke test that init doesn't throw |
| `camera.ts` | Before Frogger use |
| `collision.ts` | Before Frogger use |
| `scene.ts` | Before deciding on refactor |
| `renderer.ts` | Canvas output — jsdom limits apply, but unit-test what's possible |
| `ui.ts` | Progress bar values, tickUI lifecycle |
| `ay.ts` | At minimum that chip init doesn't throw |

### Phase 2 — Frogger clone

**Why:** Minefield has nothing more to offer as a test bed. Frogger will validate Camera, Collision, and Scene manager against a real use case. If the API holds without a refactor — zx-kit is a healthy foundation. If not — better to know now than after five more modules.

Frogger is the right choice because:
- It uses Camera (scrolling, viewport)
- It uses Collision (vehicles vs. frog)
- It has clearly separated Scenes (menu, game, game over)
- It's different enough from Minefield to surface new API weaknesses

### What NOT to add

`physics.ts`, `particle.ts`, network, multiplayer. Spectrum philosophy: less is more. Every module added is another surface to maintain.

### Worth considering

Extending `sprite.ts` with animated sprite sequences (frame list) — `animation.ts` and `sprite.ts` are logically coupled but physically separate with no shared interface.

---

## Summary

zx-kit is in good shape — better than most hobbyist libraries at the same age. It has character, consistent style, and at least one non-trivial module. The main risk isn't "too big" — it's "too few tests and too few games to validate against."

**Order of operations: tests → tests → tests → Frogger.**
