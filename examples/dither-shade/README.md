# Dither / Shade

A ZX Spectrum 8×8 cell can hold only **one ink + one paper** — there is no third
colour for a midtone. The classic workaround is to **dither**: alternate ink and
paper pixels in a regular pattern so the eye blends them into an in-between tone.

`drawShade` does exactly that over a rectangle:

```js
drawShade(ctx, x, y, w, h, ink, paper, pattern) // pattern = an 8×8 dither tile
```

The `pattern` is a named `DITHER` constant — `DITHER.QUARTER` / `DITHER.HALF` /
`DITHER.THREE_QUARTERS` (25 / 50 / 75 % ink; default `DITHER.HALF`) — **or any 8×8
`Uint8Array` of your own**, so you're not boxed into three densities (want ~10 %?
pass your own tile). Named, honest, extensible — no fake "percentage" argument.

This demo shows the payoff two ways:

- **Ramps** — `solid paper → QUARTER → HALF → THREE_QUARTERS → solid ink`. Two
  colours, **five perceived tones**. Three pairs: black→white, black→cyan, and
  blue→white (a non-black paper; both colours are *bright*, so the cell stays
  clash-legal).
- **In use** — the same little night sky drawn flat `B_BLUE` (left) vs
  `drawShade(ctx, …, C.BLACK, C.B_BLUE, DITHER.HALF)` (right). The dither turns a
  garish bright blue into a dim, overcast night — no extra colour spent.

The `DITHER` tiles are plain 8×8 `Uint8Array`s, so you can also stamp them per-cell
with `drawSprite` / `drawBitmap` when you want the pattern aligned to the 8×8 grid.

> **Clash-safe by construction:** the whole rect is one ink + one paper, so pick a
> pair that shares a bright plane (both bright, or both normal).
>
> **Perf:** `drawShade` is per-pixel like the kit's other primitives. For a large
> *static* backdrop, draw it once or cache it on a `createLayerCache` layer —
> don't re-shade a full screen every frame.

## Run

Build zx-kit first so `dist/` exists:

```bash
npm run build
```

Then serve the repository root with any static server and open:

```text
examples/dither-shade/index.html
```
