# glow — phosphor bloom (opt-in, additive)

A dark cave lit by a moving **torch**, three coloured **crystals** and the **moon**. With glow **on**,
each light source's own colour bleeds into a soft halo — that is the `glow` module: an *emissive* bloom
("path B"), so the crisp pixel-art framebuffer keeps its flat 15-colour palette and only the **glass**
picks up the extra light. Toggle glow **off** to see the same scene as hard-edged pixels and compare.

Glow is the **additive twin of `lighting`** and is **purely opt-in**: nothing here changes any other
render path, and a scene that never calls `renderGlow` looks exactly as before.

Controls: **G** toggles glow, **arrows** move the torch (its flame *flickers* via per-source
`intensity`), **+ / -** change the bloom strength (`alpha` — the layer is rebuilt on change).

Open `index.html` in a browser. It imports from `../../dist/`, so run `npm run build` first.

## The shape of it

```js
const glow = createGlowLayer(256, 192, { downscale: 4, passes: 2, alpha: 0.55 }) // once

// each frame, AFTER drawing the (flat, crisp) scene, BEFORE scanlines:
renderGlow(glow, ctx, (g) => {
  drawGlowSource(g, { x: moonX,  y: moonY,  radius: 34, color: C.B_WHITE,  intensity: 0.5 })
  drawGlowSource(g, { x: torchX, y: torchY, radius: 30, color: C.B_YELLOW, intensity: flicker }) // 0..1
  // …a source blooms in its OWN colour; draw sprites/pixels straight into `g` for pixel-exact glow
})
```

Pair it with `lighting`'s `renderDarkness` for the full "dark cave, glowing torch" look (darkness first,
glow second). For clash-mode games, `attrscreen`'s `stampMono(..., glow: true)` + `drawAttrGlowSources`
feed the same bloom straight from the attribute bit.
