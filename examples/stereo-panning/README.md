# Stereo Panning (AY + Beeper)

The two independent stereo features shipped in 0.36 — **wear headphones**:

- **AY channel spread** — `playAY` takes `pattern.pan` with a position per
  channel (`{ a: -0.9, b: 0, c: 0.9 }`): an A-major chord with one voice per
  ear and one in the middle, like the Melodik's hardware jack spread. Remove
  the pan map and the chord collapses to mono.
- **Beeper ping-pong** — `beep(freq, dur, when, pan)` takes a per-call pan:
  eight blips walk left-right with a narrowing spread.

Default is centre (`pan = 0`) everywhere, so existing games stay mono until
they opt in.

## Run

Build zx-kit first so `dist/` exists:

```bash
npm run build
```

Then serve the repository root with any static server and open:

```text
examples/stereo-panning/index.html
```

The browser requires a user gesture before audio can start — press **A** /
**Space** or the on-page buttons.
