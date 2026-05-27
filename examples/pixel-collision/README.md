# Pixel Collision

Interactive collision demo showing why zx-kit has both AABB and pixel-precise
collision tiers.

The scene uses two 16x16 circular/diamond-like bitmaps with transparent
corners. Their bounding boxes overlap before the visible pixels touch. That
produces the classic "I did not touch it" false positive.

## What It Shows

- `rectsOverlap()` reports collision as soon as the 16x16 boxes overlap.
- `masksOverlap()` reports collision only when opaque pixels share coordinates.
- The false-positive gap is visible and measurable: AABB fires before
  pixel-perfect for this non-rectangular sprite shape.
- The same idea applies to round characters, narrow feet, bullets, bosses, and
  platform edges.

## Controls

- `Space` or `Play Sweep`: replay the automatic approach.
- Arrow keys or `W A S D`: manually move the cyan sprite.
- `Reset`: return to the start position.

## Run

Build zx-kit first so `dist/` exists:

```bash
npm run build
```

Then serve the repository root with any static server and open:

```text
examples/pixel-collision/index.html
```
