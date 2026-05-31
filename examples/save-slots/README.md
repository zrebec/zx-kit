# Save Slots

Interactive demo of zx-kit's `save` module — typed save/load infrastructure
for small browser games.

## What It Shows

- `createSaveProfile()` defines the game's save namespace, schema version,
  `serialize`, and `deserialize`.
- `writeSave(profile, 'manual')` writes an immediate manual slot.
- `writeSaveThrottled(profile, 'auto', minIntervalMs)` saves meaningful
  checkpoints without flooding `localStorage`.
- `readSaveLatest()` restores whichever slot has the newest timestamp.
- On startup, the demo automatically calls `readSaveLatest()` when an `auto` or
  `manual` slot exists, so a refresh restores the last saved ship position.
- `readSave(profile, 'auto')`, `listSaves()`, and `deleteSave()` cover explicit
  slot management.
- The game owns the state shape: score, lives, sector, language, and position
  are converted to a JSON-safe payload by `serialize`.

## Controls

| Key | Button | Effect |
|-----|--------|--------|
| arrows | — | Move the ship position in runtime state |
| `Space` | — | Increase score |
| `A` | Auto Save | Throttled save to the `auto` slot |
| `S` | Manual Save | Immediate save to the `manual` slot |
| `L` | Load Latest | Load the newest slot by timestamp |
| `O` | Load Auto | Load the `auto` slot explicitly |
| `D` | Delete Manual | Remove the `manual` slot |
| `R` | Reset | Reset runtime state without deleting saves |
| `G` | — | Cycle saved language value |
| `X` | — | Lose a life without autosaving |

## Run

Build zx-kit first so `dist/` exists:

```bash
npm run build
```

Then serve the repository root with any static server and open:

```text
examples/save-slots/index.html
```
