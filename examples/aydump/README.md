# PSG Register-Dump Playback (aydump)

Plays a PSG register stream through the kit's own AY chip emulator running in
an **AudioWorklet** — the 0.37 `aydump` module, the path real ZX scene music
takes (PT3/VTX/YM converted offline to PSG, then `loadPSG(url)` +
`playAYDump(dump)`).

To stay asset-free and copyright-free, the example **synthesises the PSG byte
stream in JS** (a tiny original A-minor arpeggio, three voices) and feeds it to
`parsePSG` — the exact bytes `loadPSG` would fetch from a `.psg` file. Because
the script imports the **built** `../../dist/index.js`, it also exercises the
bundler path of the worklet source (the classes are injected by `toString()`),
which is what the 0.37.1 anonymous-class fix guards.

Shows: `parsePSG` · `playAYDump` (loop, stereo preset) · live `setStereo`
(`acb` = Melodik jack order / `abc` / `mono`) · handle `stop`/`playing`.

## Run

Build zx-kit first so `dist/` exists:

```bash
npm run build
```

Then serve the repository root with any static server and open:

```text
examples/aydump/index.html
```

The browser requires a user gesture before audio can start — press **P** or the
on-page button.
