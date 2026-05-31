# Bitmap Attributes

Interactive demo of larger bitmap sprites with ZX Spectrum-style per-cell
attributes.

## What It Shows

- `createBitmapFromRows()` defines a readable 16x24 character sprite.
- `createAttrMap(2, 3, inks, papers)` assigns independent ink and paper colours
  to the sprite's 8x8 cells.
- `drawBitmapAttrs()` renders the multi-colour sprite with authentic attribute
  paper blocks.
- The `inkOnly` flag keeps the same per-cell ink colours while suppressing
  paper fills, so the sprite can pass over a busy background without stamping
  opaque 8x8 blocks.
- `mirrorBitmap()` and `mirrorAttrMap()` derive the left-facing sprite and its
  matching colour layout from the right-facing source.

## Controls

| Key | Button | Effect |
|-----|--------|--------|
| `I` / `Space` | Ink Only | Toggle paper blocks on and off |
| `P` | Pause | Pause the walking animation |

## Run

Build zx-kit first so `dist/` exists:

```bash
npm run build
```

Then serve the repository root with any static server and open:

```text
examples/bitmap-attrs/index.html
```
