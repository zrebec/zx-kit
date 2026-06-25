# Developer-facing validation (PLANNED — not yet implemented)

> **Status:** TODO, scheduled **after** the current The Strip / Minefield v1.0 push (deadline pressure).
> This file is the survey + plan so it isn't lost. Nothing here is wired up yet.

## Goal

Catch invalid **enum-like argument values** at runtime with a **dev-only, deduped `console.warn`**, so a
typo or a bad data-driven value isn't a *silent* wrong render. The motivating case: a developer writes
`C.B_ZELLOW` instead of `C.B_YELLOW`. In TypeScript the compiler catches it — but **plain-JS consumers**,
**values coming from data/config**, and the **JS examples** get no such safety: `C.B_ZELLOW` is `undefined`,
`ctx.fillStyle = undefined` is ignored, and the frame renders wrong with no clue why.

> Origin: the `drawShade` review (0.35) — we deliberately let `pattern` be *any* `Uint8Array`. Good for
> extensibility, but "allow anything" with no feedback is the same trap as a typo'd colour. The fix is the
> same everywhere: tell the developer when a value isn't in the expected set.

## Why **warn**, not **throw**

The kit already **throws** for structural/numeric errors *at construction time* — `createAttrScreen`,
`createLayerCache`, `createRng`, `createMonoScreen`, `createParticleSystem`, `noteToFreq`, … Fail-fast is
correct there. But enum-like values are often passed **inside the render loop** (ink/paper every frame); a
throw would kill a frame. So the rule:

- **Structural / numeric args** (dimensions, capacity, seed) → **keep throwing** (construction-time).
- **Enum-like value-set args** (colour, direction, channel, policy, pattern) → **dev-only `console.warn`**,
  once per offending value, never throw.

## Survey — the enum-like value sets (what to validate)

| Module | Set / type | Form | Passed as | What a bad value does **today** |
|---|---|---|---|---|
| `palette` | `C` (15 colours) → `SpectrumColor` | `as const` object | **ink / paper in ~every draw call** (renderer, ui, attrscreen, monoscreen, presentation…) | `C.B_ZELLOW` → `undefined` → `fillStyle` ignored → silent wrong fill. **Biggest surface.** |
| `renderer` | `DITHER` (`QUARTER`/`HALF`/`THREE_QUARTERS`) | `as const` object | `drawShade(pattern)` | a non-8-byte `Uint8Array` → out-of-range rows read `undefined` → silent partial fill |
| `input` | `Direction` (`up`/`down`/`left`/`right`) | string union | movement APIs | bad string → silent no-match |
| `ay` | `AYChannel` (`A`/`B`/`C`) | string union | channel select | bad string → silent / wrong channel |
| `attrscreen` | `AttrPolicy` (`both`/`ink-only`/`paper-only`) | string union | stamp policy | bad string → silent default branch |
| `animation` | `Easings` keys | `as const` object | tween easing | bad key → `undefined` fn → **TypeError throws** (already loud-ish) |
| `ay` | `AY_ENVELOPE_SHAPES`, `AY_VOL` | readonly arrays | envelope/volume index | out-of-range index → `undefined` → silent |

`music.noteToFreq` already **throws** on a malformed note name — the precedent that value validation belongs
in the kit; this initiative extends that idea (as warnings) to the rest of the sets above.

## Proposed approach

- A tiny **internal** `warnInvalid(where, value, hint?)` that `console.warn`s **once** per unique
  `(where, value)` (a module-level `Set` dedupe), e.g.
  `[zx-kit] drawSprite: ink "#ff00ff?" is not a Spectrum colour — use a C.* value`.
- **Dev-gated, off by default:** a `setDevWarnings(true)` opt-in (bundler-agnostic; when never enabled the
  dedupe `Set` + message strings tree-shake away, so **production pays nothing**). Alternative
  `import.meta.env.DEV` is less portable across consumer bundlers — prefer the explicit toggle.
- A `SpectrumColor` membership check = "is value in `new Set(Object.values(C))`" (precomputed once).
- Wire it into the value-set entry points — **ink/paper first** (biggest win), then `Direction` /
  `AYChannel` / `AttrPolicy` consumers, `drawShade` pattern-length, `Easings` lookups, AY array indices.

## Tests (ship with it)

Per validated entry point: **warns on a bad value**, **silent on a good one**, **deduped** (one warn per
unique bad value), and **off unless `setDevWarnings(true)`**. Spy on `console.warn` (`vi.spyOn`).

## "Where could we *also* use it" (avoid future "misleading the developer")

Audit for raw strings / magic numbers passed where a fixed valid set exists but isn't named — e.g. any game
passing a bare string/number with a fixed domain (compass dirs already exist internally as
`_COMPASS_DIRS`). **New rule going forward:** every new value-set / enum-like param ships with this
warn-validation from day one, so we never "vovedieme vývojára do omylu" again.

## Timing & scope

Land after The Strip / Minefield v1.0. Naturally pairs with the `debug` module's dev-ergonomics direction.
Likely a **minor** (additive: a new `setDevWarnings` toggle + internal checks; no behaviour change when off).
