# AY Music + Beeper SFX

Four-voice Spectrum-style audio example:

- AY channel A: lead square-wave melody.
- AY channel B: bass ostinato.
- AY channel C: LFSR noise percussion with envelope shaping.
- Beeper: parallel one-bit accent hits scheduled over the AY pattern.

The tune is a short zx-kit arrangement inspired by Edvard Grieg's **In the Hall
of the Mountain King** from *Peer Gynt*.

## Copyright Note

This example intentionally avoids modern game themes, fan remakes, MIDI files,
recordings, and copied arrangements. It uses a public-domain composition and a
new, minimal chiptune arrangement written directly as note names/frequencies.

Reference sources:

- Mutopia Project lists *In the Hall of the Mountain King* with source year
  1918 and copyright status **Public Domain**.
- Mutopia states that its scores are free to download, modify, print, copy,
  distribute, perform, and record when public domain or Creative Commons.

No third-party audio assets are included.

## Run

Build zx-kit first so `dist/` exists:

```bash
npm run build
```

Then serve the repository root with any static server and open:

```text
examples/ay-music/index.html
```

The browser requires a user gesture before audio can start, so press the on-page
button or hit `Space`.
