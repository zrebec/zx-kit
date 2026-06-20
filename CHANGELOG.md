# [0.33.0](https://github.com/zrebec/zx-kit/compare/v0.32.1...v0.33.0) (2026-06-20)


### Features

* **debug:** frame-timing monitor + FPS/CPU overlay ([7f8ca5b](https://github.com/zrebec/zx-kit/commit/7f8ca5bbaef2fdffac34ab67e19fc2cc3475bb1d))

## [0.32.1](https://github.com/zrebec/zx-kit/compare/v0.32.0...v0.32.1) (2026-06-14)


### Bug Fixes

* **packaging:** stop shipping the collision test in the npm package ([03bedda](https://github.com/zrebec/zx-kit/commit/03bedda91a7dba756e9c244e218ece52be1c96be))

# [0.32.0](https://github.com/zrebec/zx-kit/compare/v0.31.2...v0.32.0) (2026-06-09)


### Features

* **presentation:** title/loading-screen helpers (blink, tape stripes, menu) ([be24610](https://github.com/zrebec/zx-kit/commit/be2461011a90c564ece02d522a2467a879f56136))

## [0.31.2](https://github.com/zrebec/zx-kit/compare/v0.31.1...v0.31.2) (2026-06-08)


### Performance Improvements

* **attrscreen:** memoise hexToU32 packing in stampMono ([b2b2e1b](https://github.com/zrebec/zx-kit/commit/b2b2e1bde502ef2e6f51c5b0ee2f6c898a689736))

## [0.31.1](https://github.com/zrebec/zx-kit/compare/v0.31.0...v0.31.1) (2026-06-05)


### Bug Fixes

* **ay:** let playAY() return a handle to stop voices immediately ([700a4b5](https://github.com/zrebec/zx-kit/commit/700a4b589e9708e5fa3ea67aa17c50c10a48c1ba))

# [0.31.0](https://github.com/zrebec/zx-kit/compare/v0.30.0...v0.31.0) (2026-06-05)


### Features

* **monoscreen:** opt-in monochrome playfield (clash-proof, own size) ([e9faa16](https://github.com/zrebec/zx-kit/commit/e9faa160d5741b9a42aa5db7c9021ac908c5abd2))

# [0.30.0](https://github.com/zrebec/zx-kit/compare/v0.29.0...v0.30.0) (2026-06-05)


### Features

* **attrscreen:** opt-in authentic ZX colour clash (attribute screen) ([906edb1](https://github.com/zrebec/zx-kit/commit/906edb19285bef82fc04e1538a52ce79c9d9a00f))

# [0.29.0](https://github.com/zrebec/zx-kit/compare/v0.28.0...v0.29.0) (2026-06-05)


### Features

* **cache:** offscreen layer cache for static/rarely-changing layers ([1372f5d](https://github.com/zrebec/zx-kit/commit/1372f5d81153ef5b790a439d7312a50aea57eb6d))

# [0.28.0](https://github.com/zrebec/zx-kit/compare/v0.27.0...v0.28.0) (2026-06-04)


### Features

* **ui:** add segmentColors per-segment colour array to drawSegmentedBar ([586b13c](https://github.com/zrebec/zx-kit/commit/586b13c948cf94fef1d1ff4ea9c56139fc60efdb))

# [0.27.0](https://github.com/zrebec/zx-kit/compare/v0.26.0...v0.27.0) (2026-06-01)


### Features

* **ay:** added notes to the AY raw register writer ([81f522d](https://github.com/zrebec/zx-kit/commit/81f522d34e207f2c4205edf8d2558052cf2e5709))

# [0.26.0](https://github.com/zrebec/zx-kit/compare/v0.25.0...v0.26.0) (2026-06-01)


### Features

* **lighting:** add dithered cave-darkness lighting ([dbe4860](https://github.com/zrebec/zx-kit/commit/dbe48608bb0e340cbe9e8d9a8a7008b78cf30839))

# [0.25.0](https://github.com/zrebec/zx-kit/compare/v0.24.2...v0.25.0) (2026-05-31)


### Features

* **renderer:** add inkOnly to drawBitmap and drawBitmapAttrs ([921c79d](https://github.com/zrebec/zx-kit/commit/921c79d575b5010a4baa3b89da3aa40b05a3d10e))

## [0.24.2](https://github.com/zrebec/zx-kit/compare/v0.24.1...v0.24.2) (2026-05-29)


### Bug Fixes

* **examples/particles:** two pools fix puff, sparks arc upward, add E/S/P/R keys ([8e0a89d](https://github.com/zrebec/zx-kit/commit/8e0a89d79ca57ba44dc0d6a989f758fa54b5213b))

## [0.24.1](https://github.com/zrebec/zx-kit/compare/v0.24.0...v0.24.1) (2026-05-29)


### Bug Fixes

* **release:** keep package lock and changelog in sync ([fede48a](https://github.com/zrebec/zx-kit/commit/fede48adf7be9ee178b73104a892dcc352b9edf4))

# [0.24.0](https://github.com/zrebec/zx-kit/compare/v0.23.0...v0.24.0) (2026-05-29)


### Features

* **particles:** allocation-free particle pool for pixel effects ([e6f2793](https://github.com/zrebec/zx-kit/commit/e6f27939ecf1dc9a32d4de5938269d30571722f8))
* **rng:** seeded deterministic PRNG (mulberry32) ([09a41b8](https://github.com/zrebec/zx-kit/commit/09a41b88061f912d42ab5b1278a08cc442eaa04a))
* **tilescroll:** pixel-smooth tile-map scrolling ([fdf1b09](https://github.com/zrebec/zx-kit/commit/fdf1b099812e61e35a11fcd0b1962cdfcb962157))

# [0.23.0](https://github.com/zrebec/zx-kit/compare/v0.22.0...v0.23.0) (2026-05-28)


### Features

* **renderer:** add createBitmapFromRows for readable pixel-art bitmap definitions

`createBitmapFromRows(rows)` is a new Bitmap constructor for authoring sprites as
plain text rows instead of hand-packed hexadecimal bytes. It accepts `X` or `#`
as solid pixels and `.` or space as transparent pixels, validates equal row
lengths and byte-aligned width, then returns the same `Bitmap` shape used by
`createBitmap`, `drawBitmap`, `drawBitmapAttrs`, and collision helpers.

This is a minor release because it adds public API without changing existing
renderer behaviour.

# [0.22.0](https://github.com/zrebec/zx-kit/compare/v0.21.0...v0.22.0) (2026-05-27)


### Features

* **collision:** pixel-precise collision — bitmapPixelMask, masksOverlap, pixelSolidCount ([f3274ba](https://github.com/zrebec/zx-kit/commit/f3274ba0e715110f3c250f7b70904e5e7cbc1366))

# [0.21.0](https://github.com/zrebec/zx-kit/compare/v0.20.0...v0.21.0) (2026-05-21)


### Features

* **i18n:** add pickLocale helper for runtime locale switching ([b18478f](https://github.com/zrebec/zx-kit/commit/b18478f00d3032e000949a0f8bf6d3b8a114f19e))

# [0.20.0](https://github.com/zrebec/zx-kit/compare/v0.19.1...v0.20.0) (2026-05-20)


### Features

* **ui:** instrumentation widgets — dotted grid, segmented bar, tank, dial, compass ([12c6e1c](https://github.com/zrebec/zx-kit/commit/12c6e1c7a3490d3f8063cf21dc42ab5e0ffa2e45))

## [0.19.1](https://github.com/zrebec/zx-kit/compare/v0.19.0...v0.19.1) (2026-05-17)


### Bug Fixes

* **renderer:** drive flashBorder via requestAnimationFrame instead of setInterval ([bfd2cc4](https://github.com/zrebec/zx-kit/commit/bfd2cc4da8ffaccc72dfd72b875afcec6b3189ad))
* **renderer:** replace setupCanvas non-null assertion with explicit throw ([3789bda](https://github.com/zrebec/zx-kit/commit/3789bdab57750884d7c5f1cb934686b998e441b5))

# [0.19.0](https://github.com/zrebec/zx-kit/compare/v0.18.0...v0.19.0) (2026-05-17)


### Features

* **renderer:** per-cell ink/paper for authentic Spectrum colour clash ([aacffc5](https://github.com/zrebec/zx-kit/commit/aacffc50c2a6e0022e20f1fc9056986d93c6b2e7))

# [0.18.0](https://github.com/zrebec/zx-kit/compare/v0.17.0...v0.18.0) (2026-05-16)


### Features

* **collision:** generic rect/bitmap collision for arbitrary-size sprites ([20e2477](https://github.com/zrebec/zx-kit/commit/20e2477cab1807299d03ae41bf9092484c21d4ed))

# [0.17.0](https://github.com/zrebec/zx-kit/compare/v0.16.2...v0.17.0) (2026-05-16)


### Features

* **renderer:** add Bitmap API for arbitrary-size sprites ([81d9cd0](https://github.com/zrebec/zx-kit/commit/81d9cd0bcb500f8e674cdda82195946dce413726))

## [0.16.2](https://github.com/zrebec/zx-kit/compare/v0.16.1...v0.16.2) (2026-05-16)


### Bug Fixes

* **quality:** verify all module behaviour — 487 tests, 100% function coverage ([4a03b76](https://github.com/zrebec/zx-kit/commit/4a03b76dd7df10bdd36d1ede5e2a934d4f2a861c))

## [0.16.1](https://github.com/zrebec/zx-kit/compare/v0.16.0...v0.16.1) (2026-05-16)


### Bug Fixes

* **deps:** override nested npm to >=11.14.1 to resolve ip-address XSS ([3fecfb4](https://github.com/zrebec/zx-kit/commit/3fecfb41c68a83fd09fedb5ea82885ed6fcb94ce))

# [0.16.0](https://github.com/zrebec/zx-kit/compare/v0.15.0...v0.16.0) (2026-05-15)


### Features

* **save:** add typed save/load with versioning, throttling, and slot enumeration ([ea5d35c](https://github.com/zrebec/zx-kit/commit/ea5d35c41d54b290a218fbfa5857f489a6cecc25))

# [0.15.0](https://github.com/zrebec/zx-kit/compare/v0.14.0...v0.15.0) (2026-05-15)


### Features

* **input:** add analogStepMs param to tickMovement for discrete stick control ([a71499f](https://github.com/zrebec/zx-kit/commit/a71499f6653d74e827c3f08a431caa68f16c760a))

# [0.14.0](https://github.com/zrebec/zx-kit/compare/v0.13.0...v0.14.0) (2026-05-15)


### Features

* **input:** add transparent gamepad support via Gamepad API ([ffb7fda](https://github.com/zrebec/zx-kit/commit/ffb7fda2e74112602491e1f975b71799bc2b5df0))

# [0.13.0](https://github.com/zrebec/zx-kit/compare/v0.12.0...v0.13.0) (2026-05-12)


### Features

* **camera:** add scrolling camera with lerp, deadzone and world-bounds clamping ([b8017d6](https://github.com/zrebec/zx-kit/commit/b8017d6d1b920c4f27fbe3ce3de7e172f7b8baa1))
* **scene:** add stack-based scene manager with lifecycle hooks ([9b01f5d](https://github.com/zrebec/zx-kit/commit/9b01f5d62e5a2f14eef0f8fdad804a7977b78e09))

# [0.12.0](https://github.com/zrebec/zx-kit/compare/v0.11.0...v0.12.0) (2026-05-10)


### Features

* **animation:** add Blinker toggle timer ([7ca1b44](https://github.com/zrebec/zx-kit/commit/7ca1b447d8600515ab847419ca8cdf8dd121c458))

# [0.11.0](https://github.com/zrebec/zx-kit/compare/v0.10.0...v0.11.0) (2026-05-10)


### Features

* **animation:** add Animation + Tween primitives — frame timer, position interpolator, easings ([e227c6b](https://github.com/zrebec/zx-kit/commit/e227c6bd038778a879bad9223eba824a642fa6c3))

# [0.10.0](https://github.com/zrebec/zx-kit/compare/v0.9.2...v0.10.0) (2026-05-08)


### Features

* **audio:** add AY-3-8912 (Melodik) emulator — tone, LFSR noise, envelope ([109f6e9](https://github.com/zrebec/zx-kit/commit/109f6e9bda6b71c8030bba92dd06571ab73f444a))

## [0.9.2](https://github.com/zrebec/zx-kit/compare/v0.9.1...v0.9.2) (2026-05-08)


### Bug Fixes

* **security:** validate row in getCharRow, fix flashBorder interval leak, add sideEffects/engines ([439d5fe](https://github.com/zrebec/zx-kit/commit/439d5fe5059bddc6a76e6a7e491d46efbc94fdd2))

## [0.9.1](https://github.com/zrebec/zx-kit/compare/v0.9.0...v0.9.1) (2026-05-04)


### Bug Fixes

* **renderer:** remove rotateX tilt from curveDisplay ([2e9a19a](https://github.com/zrebec/zx-kit/commit/2e9a19a6e2eb943aed740c8609ca18e27b816051))

# [0.9.0](https://github.com/zrebec/zx-kit/compare/v0.8.0...v0.9.0) (2026-05-04)


### Features

* **renderer:** add curveDisplay() CRT curvature abstraction ([5fbed08](https://github.com/zrebec/zx-kit/commit/5fbed08760b39cc0e75c3ed692273b186d1cd970))

# [0.8.0](https://github.com/zrebec/zx-kit/compare/v0.7.0...v0.8.0) (2026-05-03)


### Features

* **sprite,collision:** add Sprite entity system and AABB collision resolution ([99941ff](https://github.com/zrebec/zx-kit/commit/99941ffdd2066dbf67da952d8988118424702b22))

# [0.7.0](https://github.com/zrebec/zx-kit/compare/v0.6.7...v0.7.0) (2026-05-03)


### Features

* **renderer:** add drawScanlines CRT overlay function ([522db73](https://github.com/zrebec/zx-kit/commit/522db7341b458eac1c26b3e18b29ab41749c7000))

## 0.6.1 – 0.6.7 (2026-05-02)

CI/CD pipeline bring-up only — semantic-release wiring, npm OIDC trusted publishing, `latest` dist-tag, npm provenance (`repository` field), and package-lock sync. **No functional changes.**

---

## [0.6.0] — 2026-05-02

> First properly installable npm release. All versions 0.6.1–0.6.7 are CI/CD setup fixes only — no functional changes.

### Changed

- Package now ships compiled JavaScript (`dist/`) — no longer requires TypeScript source import or a Vite alias
- `tsconfig.json` configured to emit to `dist/` with `declaration`, `declarationMap`, `sourceMap`
- `package.json` exports updated to `./dist/index.js`; added `build` and `prepublishOnly` scripts
- Automated release pipeline added (semantic-release + GitHub Actions on push to `main`)
- Branch `master` removed; `main` is the single source of truth

## [0.5.1] — 2026-05-02

### Fixed

- TileMap tests
- Color handling in tests and renderer comments
- `SpectrumColor` type refactored for full palette safety (`typeof C[keyof typeof C]` hex-value union)

## [0.5.0] — 2026-04-30

### Added

- **`tilemap.ts`** — scrollable tile map engine: `createTileMap`, `setTile`, `getTile`, `clearTile`, `fill`, `fillRect`, `isSolid`, `findById` (O(1) id index), `render` with viewport clipping, smart `setBackground` seasonal swap
- **`ui.ts`** — ZX-style UI primitives: `drawBox`, `drawFrame`, `drawPanelTitle`; managed progress bar widget (`drawProgressBar`, `tickUI`, `renderUI`, `resetUI`) with auto-hide timer
- `SpectrumColor` strict type — all `ink`/`paper` params palette-typed at compile time
- Idempotency guard for `initInput` — safe to call multiple times with updated timing params
- `resetInput()` — clears all pending key state on phase transitions
- Full `files` manifest in `package.json`; `LICENSE` (MIT) added

## [0.4.0] — 2026-04

### Added

- `setupCanvas(canvas, scale, width?, height?)` — one-call canvas initialisation (replaces manual boilerplate)
- `flashBorder(color, times, intervalMs, resetColor?)` — fire-and-forget border flash effect
- Volume control: `getMasterVolume`, `setMasterVolume`, `increaseVolume`, `decreaseVolume`
- `playPattern(notes, startDelay?)` — schedule a sequence of `Note` objects on the shared `AudioContext`

## [0.1.0] — 2026-04

### Added

- Initial release: ZX Spectrum primitives extracted from [Minefield](https://github.com/zrebec/minefield)
- `palette.ts` — `SCALE`, `CELL`, `C` (15-color palette), `SpectrumColor` type
- `font.ts` — `FONT` (96-char ROM bitmap font), `getCharRow`
- `renderer.ts` — `drawSprite`, `drawChar`, `drawText`, `drawTextCentered`, `mirrorSprite`
- `audio.ts` — `initAudio`, `resumeAudio`, `beep`, `getAudioContext`, `getMasterGain`
- `input.ts` — `initInput`, `tickMovement`, `consumeFlag`, `consumeDebug`, `consumePause`, `consumeAnyKey`, `isHeld`, `Direction`
