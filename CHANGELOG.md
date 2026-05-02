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

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Fog of War module (reusable `fog.ts`)
- Pathfinding helpers in TileMap (planned for 0.6.0)

## [0.5.1] - 2026-05-02
### Fixed
- TileMap tests
- Color handling in tests and renderer comments
- SpectrumColor type refactor for full palette safety

### Changed
- Build now emits `dist/` folder for better npm support

## [0.5.0] - 2026-04-30
### Added
- **TileMap** – full tile-based engine (`createTileMap`, `render`, `setTile`, `getTile`, `isSolid`, metadata support)
- `ui.ts` module for status bars and overlays
- `SpectrumColor` strict type for all colors (replaces raw strings)
- Idempotency guard for `initInput`
- Full `files` manifest, LICENSE, and improved documentation with TileMap examples

## [0.1.1] - 2026-04
### Added
- Initial release: palette, font, renderer, audio, input primitives extracted from Minefield
