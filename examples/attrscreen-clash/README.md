# attrscreen-clash — authentic ZX colour clash

A white hero sweeps across green plants and yellow coins. In `attrscreen` mode every
8×8 cell can hold only **one ink + one paper**, so a cell the hero touches snaps to the
hero's colour — the background pixels in that cell bleed white. That is the real ZX
Spectrum **colour clash**.

Press **SPACE** to toggle the full-colour renderer (every sprite keeps its own colour,
no bleed) and compare the same scene side by side. Move the hero with **←/→**.

Open `index.html` in a browser. It imports from `../../dist/`, so run `npm run build`
first.

## The shape of it

```js
const attr = createAttrScreen()         // 32×24 cells = 256×192, once
// each frame, in screen space:
clearAttrScreen(attr, C.BLACK)           // blank paper
stampMono(attr, plant, x, y, C.B_GREEN, C.BLACK)  // background
stampMono(attr, hero,  hx, hy, C.B_WHITE, C.BLACK) // hero LAST → its cells win → clash
flushAttrScreen(ctx, attr)               // one putImageData + drawImage
```
