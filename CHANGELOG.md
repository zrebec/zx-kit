# [0.24.0](https://github.com/zrebec/zx-kit/compare/v0.23.0...v0.24.0) (2026-05-29)


### Features

* **particles:** allocation-free particle pool for pixel effects ([e6f2793](https://github.com/zrebec/zx-kit/commit/e6f27939ecf1dc9a32d4de5938269d30571722f8))
* **rng:** seeded deterministic PRNG (mulberry32) ([09a41b8](https://github.com/zrebec/zx-kit/commit/09a41b88061f912d42ab5b1278a08cc442eaa04a))
* **tilescroll:** pixel-smooth tile-map scrolling ([fdf1b09](https://github.com/zrebec/zx-kit/commit/fdf1b099812e61e35a11fcd0b1962cdfcb962157))

# [0.23.0](https://github.com/zrebec/zx-kit/compare/v0.22.0...v0.23.0) (2026-05-28)


### Features

* m" added createBitmapFromRows method" -M "This can hellp as easy wrepper to crateBitmap rifht from sirpts" ([9c1ee0f](https://github.com/zrebec/zx-kit/commit/9c1ee0fa446df95ce53b022af57477be9bd153e7))

# [0.23.0](https://github.com/zrebec/zx-kit/compare/v0.22.0...v0.23.0) (unreleased)


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

## [0.6.7](https://github.com/zrebec/zx-kit/compare/v0.6.6...v0.6.7) (2026-05-02)


### Bug Fixes

* test automatic release after master cleanup ([a3c68b2](https://github.com/zrebec/zx-kit/commit/a3c68b296af5687a64806f760cb3ab68819e9082))

## [0.6.6](https://github.com/zrebec/zx-kit/compare/v0.6.5...v0.6.6) (2026-05-02)


### Bug Fixes

* test automatic release after sync ([f36d2ca](https://github.com/zrebec/zx-kit/commit/f36d2ca239e06930348971738f82497515fec9fd))

## [0.6.5](https://github.com/zrebec/zx-kit/compare/v0.6.4...v0.6.5) (2026-05-02)


### Bug Fixes

* force npm to publish under 'latest' tag ([5e31f03](https://github.com/zrebec/zx-kit/commit/5e31f03dfebc41cae3775f622b3916a490005e9f))

## [0.6.4](https://github.com/zrebec/zx-kit/compare/v0.6.3...v0.6.4) (2026-05-02)


### Bug Fixes

* test automatic release after sync ([6bcaa16](https://github.com/zrebec/zx-kit/commit/6bcaa164d752b09ff0b30cb3e997c5e95299ac36))

## [0.6.3](https://github.com/zrebec/zx-kit/compare/v0.6.2...v0.6.3) (2026-05-02)


### Bug Fixes

* add repository field to package.json for npm provenance ([2b0b421](https://github.com/zrebec/zx-kit/commit/2b0b421b74ea2580dd80d17b6a1d8274cdcf605f))

## [0.6.2](https://github.com/zrebec/zx-kit/compare/v0.6.1...v0.6.2) (2026-05-02)


### Bug Fixes

* enable trusted publishing OIDC ([266c5a4](https://github.com/zrebec/zx-kit/commit/266c5a4c52c45fc887be14776c1de5fc195bc35a))

## [0.6.1](https://github.com/zrebec/zx-kit/compare/v0.6.0...v0.6.1) (2026-05-02)


### Bug Fixes

* automated versioning fixed for npm ([bc153e0](https://github.com/zrebec/zx-kit/commit/bc153e0fdd1f057ffa11107abc088df66e25dd1b))
* enable trusted publishing OIDC ([7bca4ff](https://github.com/zrebec/zx-kit/commit/7bca4ff3f024b88ec9a02587ecf2bccec47a85f5))
* test token ([e09f5ea](https://github.com/zrebec/zx-kit/commit/e09f5ea8e6c990a6bbfa321f9c28552b56090a09))

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
