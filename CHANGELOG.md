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