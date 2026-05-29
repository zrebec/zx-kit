# Particles

Interactive demo of the `particles` module — allocation-free pixel effects in the ZX Spectrum palette.

## What It Shows

- **Two independent pools** (`psHeavy` + `psLight`) with different gravity constants — same API, different physics. Fire and sparks use strong gravity; smoke barely falls at all.
- `createParticleSystem(n)` — allocated once at startup; `emitParticles` / `tickParticles` / `renderParticles` never allocate.
- Three visually distinct effects: explosion (radial, parabolic arcs), sparks (shoot upward, gravity pulls them back down in a clear arc), puff (slow smoke that actually floats).
- `createBitmapFromRows` — the target crosshair defined as readable pixel-art strings, no hex needed.
- Live pool meters (FIRE / SMKE) — colour shifts green → yellow → red as capacity fills. When full, `emitParticles` silently clamps.

## Controls

| Key | Button | Effect |
|-----|--------|--------|
| `E` | (E)xplode | Radial burst at centre target |
| `S` | (S)parks | Five upward spark fountains, gravity arcs them back down |
| `P` | (P)uff | Rising smoke from below — barely any gravity |
| `R` | (R)eset | `clearParticles` on both pools instantly |
| click | — | Explosion at cursor position |

## Run

Build zx-kit first so `dist/` exists:

```bash
npm run build
```

Then serve the repository root with any static server and open:

```
examples/particles/index.html
```
