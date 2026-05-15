# zx-kit Save System

> Status: implemented. Code in `src/save.ts`, tests in `save.tests.ts`. README will be updated as the final documentation step.

## Goal

Provide robust, simple save/load infrastructure for ZX Spectrum-style games using `localStorage`.

zx-kit owns the infrastructure: storage, namespacing, versioning envelope, error handling, throttling, slot enumeration. The game owns the state shape: what to save, how to serialize non-JSON values (Sets, Maps, class instances), how to apply a loaded snapshot back to the game.

## Why not a "full memory snapshot" approach

Emulators can save the entire RAM as a flat byte array and restore it verbatim. JavaScript game state is an object graph, not a byte array:

- `JSON.stringify(gameState)` silently corrupts `Set`, `Map`, class instances, circular references.
- A full snapshot would also persist transient runtime state (audio nodes, `requestAnimationFrame` IDs, timers) that has no business being saved.
- When the state shape changes between versions, an opaque blob cannot be migrated.

The chosen design forces the game to declare what's in a save explicitly via `serialize`, and to know how to restore it via `deserialize`. The kit stays state-agnostic.

## API

### Registration

A game creates a save profile once at startup. The returned `SaveProfile` handle is passed to every save/load function — matching zx-kit's standalone-function convention (no methods on objects).

```ts
import {
  createSaveProfile,
  writeSave, writeSaveThrottled,
  readSave, readSaveLatest,
  saveExists, deleteSave, listSaves,
} from 'zx-kit'

type MinefieldSave = {
  grid: Cell[][]
  lives: number
  score: number
  level: number
  playerPos: { col: number, row: number }
  probed: string[]   // Set serialized as array
}

const save = createSaveProfile<MinefieldSave>({
  key: 'minefield',
  version: 1,
  serialize: () => ({
    grid: game.grid,
    lives: game.lives,
    score: game.score,
    level: game.level,
    playerPos: { col: player.col, row: player.row },
    probed: [...game.probedCells],
  }),
  deserialize: (data) => {
    game.grid = data.grid
    game.lives = data.lives
    game.score = data.score
    game.level = data.level
    player.col = data.playerPos.col
    player.row = data.playerPos.row
    game.probedCells = new Set(data.probed)
  },
  migrate: (data, fromVersion) => data,  // optional
})
```

`serialize` returns a JSON-safe shape. `deserialize` consumes that shape and applies it back to the game (side effect — the game owns the mutation). The kit never tries to be clever about Sets, Maps, or class identity.

### Result types

Operations return discriminated Result types, not booleans. `QuotaExceededError` and a corrupt save are different failure modes; the game can react differently when it cares.

```ts
type SaveResult =
  | { ok: true }
  | { ok: false, reason: 'quota' | 'disabled' | 'serialize_error' | 'throttled', error?: Error }

type LoadResult =
  | { ok: true, slot: string }
  | { ok: false, reason: 'not_found' | 'corrupt' | 'version_unsupported' | 'parse_error' | 'disabled', error?: Error }
```

A game that doesn't care can branch on `ok` alone. A game that does care (e.g., "your save is too old, starting fresh") has the information it needs.

`throttled` is not really a failure — it indicates the write was intentionally skipped because the throttle interval had not elapsed. Surfaced as `ok: false` so the caller can distinguish it from a real success, but typically ignored.

### Operations

```ts
writeSave(profile, slot?: string): SaveResult
writeSaveThrottled(profile, slot: string, minIntervalMs: number): SaveResult
readSave(profile, slot?: string): LoadResult
readSaveLatest(profile): LoadResult
saveExists(profile, slot?: string): boolean
deleteSave(profile, slot?: string): boolean
listSaves(profile): SlotInfo[]   // { name, timestamp, version, sizeBytes }[]
```

- Default slot name is `'default'`. Games can use any string.
- `readSave` and `readSaveLatest` call `deserialize` internally on success.
- `readSaveLatest` enumerates all slots for this profile's key and loads the one with the most recent timestamp. If no slots exist, returns `{ ok: false, reason: 'not_found' }`.
- `deleteSave` also clears the slot's throttle entry, so the next `writeSaveThrottled` to that slot proceeds immediately.

### Throttling, not interval autosave

There is no interval-based autosave (`setInterval` writing every N seconds). Instead, the game calls `writeSaveThrottled` at meaningful save-points; the kit refuses writes that occur sooner than `minIntervalMs` after the last successful write to that slot.

The very first call to a given slot in a session always proceeds — the throttle only applies once there's a prior write to compare against.

Rationale: interval autosave routinely overwrites a "just achieved something great" moment with stale state moments before the player dies. Explicit save-points avoid this — the game saves when it has reason to, the throttle just protects against accidental floods.

### Migration

A single function transforms older payloads up to the current schema. Receives the raw `data` (typed `unknown`) and the version it was saved at; returns the current shape.

```ts
createSaveProfile({
  key: 'minefield',
  version: 3,
  migrate: (data, fromVersion) => {
    let d = data as Record<string, unknown>
    if (fromVersion < 2) d = { ...d, lives: 3 }
    if (fromVersion < 3) d = { ...d, probed: [] }
    return d as MinefieldSave
  },
  deserialize: (data) => { /* receives v3 shape */ },
})
```

If `migrate` is absent and `fromVersion < version`, `readSave` fails with `version_unsupported`. Future versions are also rejected (a downgrade cannot read newer saves). If `migrate` throws, the read fails with `corrupt`.

## Under the hood

- **Namespacing**: localStorage keys are `zxkit:<game-key>:<slot>`. No cross-game collisions; easy to enumerate slots per game.
- **Envelope**: every payload is stored as `{ version, timestamp, data }`. Version detection and `readLatest()` comparison happen without parsing `data`.
- **Error mapping**: `QuotaExceededError`, `SecurityError` (private browsing), and `JSON.parse` errors are caught and mapped to `Result.reason`. The kit does not throw to the game.
- **No deep schema validation**: the kit only validates the envelope shape. Deeper checks are the game's responsibility inside `deserialize`. A garbage but well-shaped payload reaches `deserialize` as-is.
- **Throttle state is in-memory**: last-write timestamps per slot live in the `SaveHandle`, not in localStorage. A page reload resets the throttle, which is the desired behavior — the player has clearly had a break.

## Minefield integration

Minefield uses two slots, both named by convention (not enforced by the kit):

- `'auto'` — written on airplane flyover via `writeSaveThrottled(profile, 'auto', 5000)`; written on level complete via `writeSave(profile, 'auto')` (immediate, no throttle).
- `'manual'` — written on `SHIFT+S` keypress via `writeSave(profile, 'manual')`.

On game start, `readSaveLatest(profile)` loads whichever slot is newer. Minefield does not surface a load/save UI; the player either continues their last meaningful checkpoint or starts fresh.

This composition is a game-level decision. The kit only provides the primitives; another game might use 5 named slots with a load menu, or a single autosave slot with no manual save.

## Out of scope

- **High score table** — stays in the existing `highscore` module. Different semantics (append-only, sorted, view-all). May share a low-level storage wrapper later, but the API stays separate.
- **Compression** — payloads for a 32×22 Minefield grid are tiny; LZ-string or similar can be added later if a game exceeds the ~5 MB localStorage budget.
- **Cloud sync / cross-device** — localStorage only.
- **Save slot UI** — a game that wants slot management builds it itself.
- **Save scumming policy** — the kit does not enforce "one save per level". Games decide their own policy by choosing how many slots to write and when.

## Implementation status

- [x] Design (this document).
- [x] Implementation in `src/save.ts`, exported from `src/index.ts`.
- [x] Tests in `save.tests.ts` — 31 tests covering: happy path round-trip, slot namespacing, `readSaveLatest` newest-by-timestamp, throttle within/outside interval, throttle is per-slot, throttle resets on fresh profile (simulates reload), migration with older versions, missing migrate, future version, migrate throws, `quota` / `disabled` / `serialize_error` / `parse_error` / `corrupt` / `not_found`, `saveExists`, `deleteSave` clears throttle entry.
- [ ] Minefield integration — wire `'auto'` and `'manual'` slots, `readSaveLatest` on game start, SHIFT+S binding.
- [ ] README update — final documentation step.
