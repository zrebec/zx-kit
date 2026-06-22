# Built-in Volume Bar

The smallest possible volume control: a looping beeper melody plus zx-kit's
built-in `+`/`-` volume keys and an auto-hide HUD bar — with **no extra setup**.

The entire wiring is two calls:

```js
initInput()        // +/- now control master volume (default on)
// ...in the render loop:
drawVolumeBar(ctx) // shows the bar ~1.5 s after any change, then hides it
```

No `setVolumeBarStyle()`, no `setVolumeKeys()` — the defaults (centred 10-cell
green bar, `+`/`=` up, `-`/`_` down, 1.5 s auto-hide) are exactly what you see.
Customise only if you want to:

```js
setVolumeBarStyle({ color: C.B_CYAN }) // recolour / move / resize the bar
setVolumeKeys('9', '8')                // remap the keys (or [], [] to disable)
```

## Scale-independence

The canvas runs at scale **3** here on purpose. `drawVolumeBar` reads the
context's transform, so the bar centres correctly at any scale — not just the
kit's default 4.

## Run

Build zx-kit first so `dist/` exists:

```bash
npm run build
```

Then serve the repository root with any static server and open:

```text
examples/volume-bar/index.html
```

The browser requires a user gesture before audio can start, so press any key (or
click the canvas) first; then nudge `+` / `-`.
