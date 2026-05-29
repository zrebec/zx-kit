# Particles

Interactive demo of the `particles` module — allocation-free pixel effects in the ZX Spectrum palette.

## What It Shows

- `createParticleSystem(200)` — a fixed pool, allocated once at startup.
- `emitParticles` / `tickParticles` / `renderParticles` — never allocate; safe to call every frame.
- Three visually distinct effects using the same pool: explosion (radial, fire palette), sparks (directional, gravity), and puff (upward, slow, pale palette).
- `createBitmapFromRows` — the target crosshair is defined as readable pixel-art strings, not hex bytes.
- Live pool meter at the bottom: fill colour shifts green → yellow → red as slots are consumed. When the pool is full, `emitParticles` silently clamps — no crash, no allocation.

## Controls

- **Click canvas** — explosion at cursor position.
- **Explode** — explosion at the centre target.
- **Sparks** — six downward showers from the top edge.
- **Puff** — slow upward smoke from the bottom.
- **Reset** — `clearParticles(ps)`: all slots returned to the pool instantly.

## Run

Build zx-kit first so `dist/` exists:

```bash
npm run build
```

Then serve the repository root with any static server and open:

```
examples/particles/index.html
```
