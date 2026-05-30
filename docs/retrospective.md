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

---

# Update — 2026-05-17 (post-v0.19.1)

> Picks up where the original retrospective above left off. Two short, focused work sessions moved zx-kit from "near zero tests" to "comprehensive coverage" and added the missing primitive every Spectrum-style game eventually needs: arbitrary-size sprites with per-cell colour attributes.

## Phase 1 (tests) — done

Coverage in two sessions:

| Metric | Before | Now |
|--------|--------|-----|
| Test files | 1 (save.tests.ts) | 15 |
| Tests | 31 | 615 |
| Statements | ~0% on 14 modules | 97.93% overall |
| Branches | ~0% on 14 modules | 93.6% overall |
| Functions | partial | **100%** overall |
| Lines | ~0% on 14 modules | 98.53% overall |

Every exported function in every module has at least one test. The hard block on new features was lifted on 2026-05-16.

## Phase 2 (Frogger) — shelved

The Frogger clone got most of the way there (intro / gameplay / game-over scenes, world lanes, camera scroll, sprites, collisions, audio) but was put on hold. The decision: cloning a known game wasn't satisfying, and the 8×8 sprite constraint was felt as a limit. Both concerns were addressed by the API expansion below — when a fresh game idea lands, the foundation is now stronger than it would have been with a finished Frogger.

## What got built between 0.16.0 and 0.19.1

| Release | What it added | Why it mattered |
|---------|---------------|-----------------|
| **0.17.0** | `Bitmap` type + `createBitmap` / `drawBitmap` / `mirrorBitmap` | Lifted the self-imposed 8×8 sprite limit. Heroes can now be 16×24, bosses 96×128, vines 8×64 — anything with width a multiple of 8. |
| **0.18.0** | `bitmapRect`, `resolveRectX/Y`, generic rect-based tile collision | Made the new larger sprites first-class for gameplay — tall hero correctly detects walls in middle tile rows; wide wagon checks every column it crosses. |
| **0.19.0** | `AttrMap` + `createAttrMap` / `drawBitmapAttrs` / `mirrorAttrMap` | Authentic per-8×8-cell ink/paper colour attributes — the constraint that produced Manic Miner / Jet-Pac multi-colour sprites and their famous "colour clash". |
| **0.19.1** | `setupCanvas` explicit throw, `flashBorder` on requestAnimationFrame | Quality fixes — clear error at setup time when 2D context is unavailable; vsync-synced, tab-throttle-aware border flashing. |

Compared to v0.16.0: ~330 KB more source, ~440 more tests, fundamentally larger surface for actual games to use.

## Roadmap

### Near-term — pick up when a game needs it

- **OffscreenCanvas caching layer.** Pre-render each `Bitmap` once into a tiny offscreen canvas; subsequent renders are a single `drawImage`. Optional opt-in (`cacheBitmap(bm, attrs)` → cached handle, `drawCached(ctx, h, x, y)`), existing `drawBitmap` / `drawBitmapAttrs` unchanged. Estimated ~1 day. Useful when sprite counts get into the hundreds or when a game animates a 32×32 boss at 60 FPS on mobile.

### Mid-term — accuracy & feel

- **Sample-accurate AY via AudioWorklet.** Current `ay.ts` is a *good approximation* — band-limited squares (cleaner than the real chip), smooth envelope ramps (vs the chip's 16 stepped values). For audiophile-level chip-tune authenticity, port a known AY emulator (e.g. MAME's AY core) into an AudioWorklet running at the chip's ~110 kHz tick rate, with raw squares and stepped envelopes. The existing API stays; user picks `createAY()` (current) vs `createAYAccurate()` (worklet). Estimated 3-5 days. Don't build until a music-heavy game justifies it.

### Long-term — wild ideas (analysis preserved, build deferred)

#### Chip-style speech synthesis (analysed 2026-05-17)

The user-facing question: how much work to add `speakAY("YOU ARE UNDER ARREST")` that synthesises authentic-feeling robotic speech through AY tone channels? The answer matters because games like Ghostbusters (C64), Three Weeks in Paradise (Spectrum), Currah Microspeech-enabled Spectrum titles and SAM-powered Apple II games used speech as a memorable, era-defining feature.

**Three paths exist:**

| Path | Approach | Effort | Dependencies | Authenticity |
|------|----------|--------|--------------|--------------|
| **A** | Wrap Web Speech API (`speechSynthesis`) | 2 hours | none | ⭐ — modern OS voices, no chip feel |
| **B** | Adapter around [`sam-js`](https://github.com/discordier/sam) (~30 KB), reroute output to AY | 1-2 days | +sam-js (peer dep) | ⭐⭐⭐⭐ — authentic SAM voice ("Mister Robot") |
| **C** | Pure zx-kit formant synthesis: text → phonemes → AY tone scheduling | 5-7 days | none | ⭐⭐⭐ — own robotic feel, full control |

**Three layers** are needed for Path C — text-to-phoneme rules engine (~500 LOC, the hardest part; SAM hand-tuned ~200 rules), phoneme-to-formant table (~200 LOC + data for ~50 phonemes with F1/F2/F3 frequencies), and a synthesis scheduler that maps formants to AY tone channels with smooth phoneme transitions (~300 LOC). Total estimated ~15-25 KB of source, < 30 KB shipped, zero external assets.

**Not a breaking change** in any path — adds `speakAY(text)` as a new exported function, existing API unchanged. **Not 1-2 MB** in any path — even Path B is ~30 KB; full eSpeak.js (1-2 MB) is explicitly rejected as anti-philosophy.

**Decision: defer until a game actually needs it.** Speech engines look simple in docs, but real integration (timing with music, interruption semantics, optional portrait lip-sync, voice configuration) needs a concrete gameplay context to design the API around. When the moment arrives, the recommended first step is a Path B MVP in `examples/` to validate the audio feel before committing to Path C.

#### WebGL renderer backend

Parity with the current canvas2d API but rendering through WebGL with instanced quads. Massive performance headroom — 100k+ sprites at 60 FPS plausible. Significant rewrite (~1-2 weeks for the renderer alone) and breaks the canvas-only assumption for the rest of the API. Justified only by a game design that demands it (large arena shooters, particle-heavy effects). Not on the immediate horizon.

### Still does NOT belong

`physics.ts`, `particle.ts`, networking, multiplayer. The Spectrum philosophy from the original retrospective still applies: **less is more**. Every module added is another surface to maintain — and zx-kit has comfortably enough surface already.

## The "big framework" question — partially answered

The original retrospective worried about zx-kit drifting into framework territory. Eight months later: it *is* a framework, and that's fine. The discipline that kept it consistent (functional API, no classes, palette enforcement, one module per concern) also kept it small — 15 modules, no transitive dependencies in the dist bundle, every function has a test. The cost the original retrospective warned about (every `feat:` commit means `npm install` in consuming projects) is real but manageable thanks to semantic-release automating the chore.

The unanswered piece: **zx-kit still has no game of its own.** Minefield is the live reference and Frogger was shelved. A fresh, original game design — not a clone — is the real next milestone. The library is ready for it.

---

# Update — 2026-05-27 (post-v0.21.0)

> Added: pixel-precise collision tier to `collision.ts`.

## What changed

`collision.ts` gained three new exports: `PixelMask`, `bitmapPixelMask`, `masksOverlap`, and `pixelSolidCount`.

### The motivation — the Dizzy problem

AABB and rect-vs-tile collision work correctly for rectangular sprites — which is most of the time. They fail at one specific boundary case that keeps coming up in classic platform games: a non-rectangular sprite (circular body, narrow feet, diagonal silhouette) hanging over the edge of a platform. The bounding box still overlaps the tile; the actual pixels do not. The player gets magically glued to empty air, or a bullet that missed registers as a hit.

The ZX Spectrum's own games worked around this with hand-tuned hitboxes — Dizzy's elliptical collision, for instance, was a smaller AABB inscribed inside the sprite. That works but is manual and imprecise.

`bitmapPixelMask` / `masksOverlap` / `pixelSolidCount` solve it generically: pre-compute which pixels of a sprite are actually opaque, then check only those pixels against the environment or another sprite. The check is O(opaque pixels) with sorted-merge intersection — no allocations per call, safe to run every frame.

### API

| Export | What it does |
|--------|-------------|
| `PixelMask` | Interface: `width`, `height`, per-row sorted opaque column arrays, `totalPixels` |
| `bitmapPixelMask(bitmap)` | Builds a `PixelMask` from any `Bitmap`. Pre-compute once at module load. |
| `masksOverlap(a, ax, ay, b, bx, by)` | Returns the count of overlapping opaque pixels between two masks at world positions. 0 = no collision. |
| `pixelSolidCount(mask, mx, my, map)` | Returns how many opaque pixels of a mask sit on solid tiles. 0 = no ground contact. |

### Design decisions

**Pre-compute, not compute-per-frame.** `bitmapPixelMask` is intentionally expensive (reads every bit of every row). It must be called once at module load time, not inside the game loop. The result is `readonly` — no mutation, no re-computation, full cache locality.

**Count, not boolean.** Both `masksOverlap` and `pixelSolidCount` return a pixel count, not a boolean. This is a deliberate API decision: `count > 0` is the hit-test, but the count itself expresses severity — overlap area, damage scale, grip fraction. A bullet grazing the corner of a shield (1 pixel) is handled differently from a direct hit (30 pixels). The caller decides what threshold matters.

**Sorted-merge intersection.** Each `rows[r]` array is sorted at build time. `masksOverlap` runs a merge-style two-pointer scan per overlapping row — the same algorithm used to intersect sorted lists. No `Set`, no allocations, no hash lookups. The cost is proportional to the number of opaque pixels in the overlap region.

**Relationship to `resolveRectX/Y`.** The rect resolvers remain the right tool for wall resolution (they're faster and give directional hit flags). Pixel-precise checks are complementary, not a replacement: use `resolveRectY` to stop the player at a tile boundary, then use `pixelSolidCount` to confirm the player is "on ground" with at least N foot pixels in contact. The two tiers coexist in the same game loop.

### Test coverage

Added 30 tests to `collision.tests.ts` (total: 59 across the module). Coverage: 100% statements, 100% functions, 100% lines.

Key test that validates the motivating scenario:

```ts
// Sprite with cols [2,3,4,5] — 4 pixels wide, offset from left edge
// Tile at (0,0) — solid from x=0..7
// Sprite at x=6: AABB overlaps tile [0,0], but the sprite's leftmost pixel is at col 6+2=8
// → AABB says "standing", pixelSolidCount says "falling"
expect(pixelSolidCount(narrowMask, 6, 0, solidMap([[0, 0]]))).toBe(0)
```

### Version

Released as part of v0.21.0. No breaking changes — all existing API is unchanged, three exports added.

---

# Update — 2026-05-27 (no release, but a significant day)

> The collision module existed on paper for a long time. Today it got its first real road test — literally.

## Context: what existed before today

`collision.ts` had three API tiers since v0.18.0: AABB, rect-vs-tile, and pixel-precise. The original retrospective said it plainly: *"Camera and Collision are unverified in practice."* Minefield didn't need them. Frogger was shelved. The module was written, the API was clean — but without a game that actually called it, it was theory.

## Ice Haul and the three-attempt traffic collision

Ice Haul — a pseudo-3D ice-road trucking simulator — was the first game to put the collision module to work. Hard.

Off-road detection was the first use case and it worked from day one: `bitmapPixelMask` builds the truck sprite mask, a manual row loop checks each opaque pixel against the perspective-projected road edge coordinates for that screen row. No tile map, no AABB — a custom boundary check using the pixel mask directly. The module did exactly what it was designed for.

Traffic collision took three attempts to get right.

**Attempt 1 — world-space AABB with radii (never fired).** `tickTraffic` compared `|vehicle.x − player.x| < radius`. Constants `TRAFFIC_COLLISION_RADIUS_CAR = 0.12` and `TRUCK = 0.16` were ~2.5× too small. Oncoming vehicles spawned at `x ∈ [−0.6, −0.2]`; minimum lateral distance from a centred player was always 0.2 — larger than the radius. Collision never triggered. Not once.

**Attempt 2 — corrected radii (fired too early).** Radii recalculated from real perspective geometry (road half-width ≈ 50 px at `worldZ ≈ 1–2 m`, combined half-widths ≈ 0.36). Oncoming spawn tightened to `x ∈ [−0.6, −0.3]`. Collision fired — but visually too early. The player watched a vehicle approach, saw no pixel contact on screen, and got a crash animation. It felt arbitrary and unfair.

The root cause: world-space distance doesn't know about perspective. The renderer projects vehicles through `PERSPECTIVE_K / worldZ → half → screenX`. The collision check used a different scale. The two coordinate systems were never reconciled.

**Attempt 3 — pixel-perfect screen-space (correct).** The world-space check was dropped entirely. In `drive.ts`, every vehicle within 6 m is projected using the **identical formula** the renderer uses: `dy = PERSPECTIVE_K / worldZ`, `i = round(dy) − 1`, `t = (i+1)/roadHeight`, `half = ROAD_HALF_TOP + (ROAD_HALF_BOTTOM − ROAD_HALF_TOP) × t`, `screenX = baseVanX + vehicle.x × half`. This gives an exact screen-space rectangle, pixel-for-pixel matching what the player sees.

Then `checkTruckTrafficCollision` (new export in `offroad.ts`) compares the truck pixel mask row-by-row against that rectangle. Collision fires at the exact frame a solid truck pixel enters the vehicle's screen area. Not one frame sooner.

`tickTraffic` now returns `void` — it only moves vehicles. Collision detection is `drive.ts`'s responsibility. Movement and detection are separate concerns.

## What changed in zx-kit

Directly in `collision.ts` — **nothing.** The API held without modification.

That is the real result. The module didn't need to be refactored, extended, or patched. It was used as documented and it worked. The "unverified in practice" debt from the original retrospective was paid — not by Frogger, but by Ice Haul.

What was added:

### Visual ground truth test (`src/__tests__/collision.test.ts`)

The question: can we prove, without any mathematical assumptions, that `masksOverlap` fires exactly when two sprites visually share a pixel — not one frame earlier, not one frame later?

The answer: a brute-force `Set<"x,y">` of absolute pixel coordinates.

An 8×8 bitmap with only a 2×2 lit region in the top-left corner (intentionally non-tile-aligned, non-square, atypical). `litPixels()` collects all absolute `(x, y)` coordinates of opaque pixels. `bruteForce()` checks whether any pixel of sprite B appears in the set for sprite A. No algorithm, no formula — just *"which pixels are painted and do any coordinates match?"*

Horizontal, vertical, and diagonal sweeps — one pixel at a time, every step compared: `masksOverlap > 0` must agree with `bruteForce`. If they disagree, the test fails with the exact position: `bx=N: masksOverlap=true but brute-force says false`.

Bonus assertion: AABB (8×8 bounding box) fires **6 pixels before** pixel-perfect. This gap is a visual false positive — the player sees empty space between sprites and the collision fires anyway. For non-rectangular sprites this isn't an edge case, it's the structural limitation of bounding-box collision. The test makes it measurable and permanent.

### Tutorial guide (`docs/collision.md`)

A new file — tutorial-style, not just API reference. Step by step: AABB for simple hit tests, rect-vs-tile for wall resolution, pixel-precise for everything that needs visual accuracy. Covers pre-computing masks at module load, calling `masksOverlap` per frame, combining both tiers (AABB as a cheap broad-phase gate before pixel-precise), and the custom boundary pattern (the exact pattern Ice Haul uses for off-road detection).

The README collision section links to it.

## What this means

The original retrospective noted: *"Camera and Collision are unverified in practice."*

`collision.ts` is now verified in practice — twice over. Off-road detection used a custom mask loop from day one. Traffic collision was built, iterated through three designs, and landed on pixel-perfect screen-space projection. The API didn't need to change for either use case.

No release today. Tests and documentation don't move semver. But the module matured — quietly, and for real.

---

# Update — 2026-05-30 (inkOnly — and the question of why we keep adding methods)

> Added: an `inkOnly` flag to `drawBitmap` and `drawBitmapAttrs`. Two functions, one boolean, ~12 lines. The interesting part isn't the code — it's the question the owner asked while we wrote it: *why do we keep adding methods to zx-kit at all?*

## What changed

`drawBitmap` gained a 7th optional parameter, `drawBitmapAttrs` a 6th: `inkOnly` (default `false`). When set, the function paints only the sprite's set ink pixels and skips the `paper` fill — the full bounding rectangle in `drawBitmap`, the per-cell 8×8 blocks in `drawBitmapAttrs`. No new module, no new type, no breaking change.

## Dizzy, again — the third time the box was the villain

This is the third time a bounding box has caused a bug in zx-kit, and the second time we've named the egg.

1. **Collision, v0.21.0 — "the Dizzy problem."** A non-rectangular sprite hangs over a platform edge. The AABB overlaps the tile; the pixels don't. The player gets glued to empty air. Fix: pixel-precise collision — *trust the pixels, not the box.*
2. **Rendering, today.** A sprite with `paper: C.BLACK` slides next to a white leaf. The visible pixels never touch it; the paper rectangle does, and blacks out the leaf's edge. Fix: `inkOnly` — *trust the pixels, not the box.*

Same sin, two subsystems. The bounding box is a convenient lie — fast to compute, easy to reason about, and wrong at exactly the boundary cases that make a retro sprite look hand-made instead of stamped. Both fixes are the same instinct expressed twice. That's not a coincidence worth ignoring; it's a pattern worth naming, so the *next* time a box lies to us we recognise it on sight.

## The historical anchor — what the Spectrum actually did

The box wasn't a mistake we invented. It's the Spectrum. The hardware had a 256×192 one-bit bitmap and a separate 32×24 attribute map — one ink, one paper, bright, flash, per 8×8 cell. v0.19.0 modelled that faithfully ("authentic colour clash"), and it should stay.

What we'd skipped was the hardware's *other* sprite technique. Cheap games stamped attributes and accepted clash. The clean-looking games used **masked sprites**: AND a mask into the screen to cut the sprite's silhouette, then OR the sprite in — only the sprite's own pixels change. `inkOnly` is that masked sprite, reborn on a canvas where "paint only the set pixels" is the default rather than an assembly-language ritual. We didn't invent a feature; we restored one the engine had been missing.

## Why do we keep adding methods to zx-kit?

The owner's real question. The honest answer, read straight off the git log:

**We don't add methods. Games extract them.**

Every single addition was *pulled* by a real game hitting a real wall — never *pushed* speculatively:

| Version | What was added | The game that pulled it |
|---------|----------------|-------------------------|
| 0.1–0.16 | canvas, audio, AY, tilemap, input, save | **Minefield** — the original host; the library *is* its extracted utilities |
| 0.17.0 | Bitmap API (arbitrary-size sprites) | sprites bigger than 8×8 — trucks, submarines, heroes |
| 0.18.0 | rect/bitmap collision | wall resolution for non-tile-grid sprites |
| 0.19.0 | per-cell ink/paper (colour clash) | multi-colour sprites crossing attribute cells |
| 0.21.0 | pixel-precise collision | **Ice Haul** — the Dizzy problem, off-road detection |
| 0.22.0 | (collision battle-tested) | **Ice Haul** — three-attempt traffic collision |
| 0.23.0 | `createBitmapFromRows` | authoring sprites as text, not hex |
| 0.24.0 | rng, particles, tilescroll | explosions, smooth scrolling |
| 0.25.0 | **`inkOnly`** | **chaosbunny** — a sprite that must read over a busy background, and the owner's own observation that the box bleeds |

The pattern holds for 25 releases. The library grew from ~3,300 lines to where it is now without ever growing a feature nobody was using. That is the discipline that keeps it from becoming the "big framework" the original retrospective warned against. The `What NOT to add` list — no `physics.ts`, no `particle` engine beyond a pool, no network, no multiplayer — still stands. `inkOnly` passes the test precisely because it *isn't* a new system; it's a flag on a function a game already calls.

So the answer to "why do we keep adding methods?" is really an answer to a different question: *we keep finishing games, and finished games find the engine's edges.* The methods are a side effect of play. The day we stop shipping games is the day zx-kit should stop growing — and that would be fine.

## The debt, stated plainly

`inkOnly` is a shortcut and we should say so. The faithful fix is a real masking layer — an explicit mask bitmap per sprite, or composing against an off-screen attribute buffer like the hardware. `inkOnly` buys ~90% of that for ~12 lines and zero allocations. Correct for a hobby engine; still a shortcut. The boundary where it runs out: a sprite that wants a *paper silhouette hugging its outline* (background behind the shape, but not the box). No game needs that today. When one does, the masking layer earns its keep, and this flag becomes its cheap special case.

## Test coverage

10 new tests in `renderer.tests.ts` across two describe blocks (`drawBitmap — inkOnly`, `drawBitmapAttrs — inkOnly`):

- paper suppression on all-zero and all-ones sprites (count assertions);
- per-cell inks preserved under `inkOnly`;
- default-`false` regression guards on both functions;
- equivalence proofs: `drawBitmap(..., inkOnly)` ≡ transparent; `drawBitmapAttrs(..., inkOnly)` ≡ a paper-less `AttrMap`, pixel-for-pixel;
- the exception path: dimension mismatch still throws with `inkOnly` set.

Suite total: 834 tests, all green. Build clean (`tsc`), `inkOnly?` present in `dist/renderer.d.ts`.

## Version

Released as **v0.25.0** (minor — additive, backwards compatible). `feat(renderer): inkOnly` triggers semantic-release on push to `main`.
