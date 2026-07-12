// ── Hiscore: a typed, versioned high-score table over the save envelope ─────
//
// The kit owns the DATA: validation, top-N insertion, persistence (through the
// same envelope + optional integrity signature as `save.ts`). The GAME owns the
// POLICY and the look: what extra fields an entry carries (a daily date, a
// level, a vehicle…), how the table is rendered, and how names are entered.
//
// Every entry has `name` + `score`; anything else is the game's `Extra` shape,
// validated by the game's own `validateExtra` guard so a hand-edited table
// can't smuggle malformed rows back in.

import {
  createSaveProfile,
  readSave,
  writeSave,
  deleteSave,
  type SaveProfile,
  type SaveResult,
} from './save.js'

/** A single table row: the two fields every game shares, plus the game's own. */
export type HighScoreEntry<Extra = object> = { name: string; score: number } & Extra

/**
 * Configuration for a game's high-score table. The entry's game-specific
 * shape is the `Extra` type parameter of {@link createHighScores} — all
 * JSON-safe; use the default for plain name+score tables.
 */
export interface HighScoreConfig {
  /** Game key — storage namespace, conventionally the same as the save profile's. */
  key: string
  /** Rows kept, best first. Default 5. */
  maxEntries?: number
  /** Longest accepted name. Default 10. Longer names are rejected, not cut. */
  maxNameLength?: number
  /**
   * Optional integrity secret — same scheme and same caveat as
   * `SaveProfileConfig.secret` (deterrence, not security). A tampered table
   * loads as empty rather than failing the game.
   */
  secret?: string
  /**
   * Validates the game-specific fields of one entry when loading. Rows that
   * fail are dropped silently (legacy tolerance: make optional fields optional
   * here). Omit for plain name+score tables.
   */
  validateExtra?: (entry: Record<string, unknown>) => boolean
}

/** Returned by {@link createHighScores}; pass to all table operations. */
export interface HighScores<Extra = object> {
  readonly config: HighScoreConfig & { maxEntries: number; maxNameLength: number }
  /** Internal save profile — the table is one slot inside the game's namespace. */
  readonly profile: SaveProfile<HighScoreEntry<Extra>[]>
  /** In-memory buffer the profile serializes from / deserializes into. Internal. */
  buffer: HighScoreEntry<Extra>[]
}

/** Result of {@link insertScore}: where the entry landed, if it did. */
export interface InsertResult<Extra = object> {
  /** True iff the entry made the table. */
  placed: boolean
  /** 1-based rank when placed, null otherwise. */
  rank: number | null
  /** The table after the insert attempt (what the game should render). */
  scores: HighScoreEntry<Extra>[]
  /** Persistence outcome of the write (only meaningful when placed). */
  saved: SaveResult | null
}

const SLOT = 'hiscore'
const TABLE_VERSION = 1

/**
 * Registers a high-score table. Call once at startup and reuse the handle.
 *
 * @example
 * interface MinefieldExtra { level: number; date?: string }
 * const hs = createHighScores<MinefieldExtra>({
 *   key: 'minefield',
 *   validateExtra: (e) => typeof e.level === 'number' &&
 *     (e.date === undefined || typeof e.date === 'string'),
 * })
 * if (isHighScore(hs, run.score)) insertScore(hs, { name, score: run.score, level, date })
 */
export function createHighScores<Extra = object>(
  config: HighScoreConfig,
): HighScores<Extra> {
  const full = { maxEntries: 5, maxNameLength: 10, ...config }
  const table: HighScores<Extra> = {
    config: full,
    buffer: [],
    profile: createSaveProfile<HighScoreEntry<Extra>[]>({
      key: config.key,
      version: TABLE_VERSION,
      secret: config.secret,
      serialize: () => table.buffer,
      deserialize: (data) => {
        // A hand-edited envelope can carry any JSON here — only an array counts.
        table.buffer = Array.isArray(data) ? data : []
      },
    }),
  }
  return table
}

function isValidEntry<Extra>(
  table: HighScores<Extra>,
  value: unknown,
): value is HighScoreEntry<Extra> {
  if (typeof value !== 'object' || value === null) return false
  const e = value as Record<string, unknown>
  return (
    typeof e.name === 'string' &&
    e.name.trim().length > 0 &&
    e.name.length <= table.config.maxNameLength &&
    typeof e.score === 'number' &&
    Number.isFinite(e.score) &&
    (table.config.validateExtra === undefined || table.config.validateExtra(e))
  )
}

/**
 * Loads the table, best score first. Invalid rows are dropped; a missing,
 * corrupt or tampered table is simply empty — a broken leaderboard must never
 * break the game.
 */
export function loadHighScores<Extra>(table: HighScores<Extra>): HighScoreEntry<Extra>[] {
  table.buffer = []
  readSave(table.profile, SLOT) // failure reasons all collapse to "empty table"
  return table.buffer
    .filter((e): e is HighScoreEntry<Extra> => isValidEntry(table, e))
    .sort((a, b) => b.score - a.score)
    .slice(0, table.config.maxEntries)
}

/**
 * True iff `score` would make the table — the cheap pre-check before asking
 * the player for a name. Zero and negative scores never qualify.
 */
export function isHighScore<Extra>(table: HighScores<Extra>, score: number): boolean {
  if (!Number.isFinite(score) || score <= 0) return false
  const scores = loadHighScores(table)
  if (scores.length < table.config.maxEntries) return true
  return score > scores[scores.length - 1].score
}

/**
 * Inserts an entry (top-N, best first; on a tie the earlier entry keeps the
 * higher rank) and persists the table. Entries that fail validation or fall
 * off the end are not written.
 */
export function insertScore<Extra>(
  table: HighScores<Extra>,
  entry: HighScoreEntry<Extra>,
): InsertResult<Extra> {
  const current = loadHighScores(table)
  if (!isValidEntry(table, entry)) {
    return { placed: false, rank: null, scores: current, saved: null }
  }

  // Stable insert after the last entry with score >= entry.score = tie keeps rank.
  let at = current.length
  while (at > 0 && current[at - 1].score < entry.score) at--
  current.splice(at, 0, entry)
  const next = current.slice(0, table.config.maxEntries)

  const rank = at < table.config.maxEntries ? at + 1 : null
  if (rank === null) {
    return { placed: false, rank: null, scores: next, saved: null }
  }

  table.buffer = next
  const saved = writeSave(table.profile, SLOT)
  return { placed: true, rank, scores: next, saved }
}

/** Wipes the table. Returns true if there was one. */
export function clearHighScores<Extra>(table: HighScores<Extra>): boolean {
  table.buffer = []
  return deleteSave(table.profile, SLOT)
}
