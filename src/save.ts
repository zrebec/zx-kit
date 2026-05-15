// ── Save: typed save/load with versioning, throttling, slot enumeration ─────

/**
 * Configuration for a game's save profile.
 *
 * @typeParam T - The JSON-safe shape of the saved payload. The game converts
 *   non-JSON values (Sets, Maps, class instances) inside `serialize` /
 *   `deserialize`.
 */
export interface SaveProfileConfig<T> {
  /** Game key — used as namespace in storage. Must be unique per game. */
  key: string
  /** Current schema version. Increment when the shape of T changes. */
  version: number
  /** Returns the current game state as a JSON-safe value. */
  serialize: () => T
  /** Applies a loaded snapshot back to the game (side effect). */
  deserialize: (data: T) => void
  /**
   * Optional migration. Called when the loaded envelope's version is older
   * than `version`. Receives the raw data and the version it was saved at,
   * returns data shaped for the current version. If absent and an older
   * version is encountered, the load fails with `version_unsupported`.
   */
  migrate?: (data: unknown, fromVersion: number) => T
}

/**
 * Returned by {@link createSaveProfile}. Carries config plus in-memory
 * throttle state. Pass to all save/load operations.
 *
 * Throttle state lives only in memory — a page reload resets it, so the
 * first {@link writeSaveThrottled} after reload always proceeds.
 */
export interface SaveProfile<T> {
  readonly key: string
  readonly version: number
  readonly config: SaveProfileConfig<T>
  /** Per-slot last successful write timestamp (ms). Internal. */
  lastWrites: Map<string, number>
}

/** Metadata for a single stored slot. */
export interface SlotInfo {
  name: string
  timestamp: number
  version: number
  sizeBytes: number
}

/**
 * Result of a write operation.
 *
 * `throttled` indicates the write was intentionally skipped because the
 * throttle interval had not elapsed — not a true failure. Callers that
 * only care whether data hit storage can branch on `ok`; callers that
 * want to distinguish "skipped" from "failed" can check `reason`.
 */
export type SaveResult =
  | { ok: true }
  | {
      ok: false
      reason: 'quota' | 'disabled' | 'serialize_error' | 'throttled'
      error?: Error
    }

/** Result of a read operation. On `ok: true`, `deserialize` has already been called. */
export type LoadResult =
  | { ok: true; slot: string }
  | {
      ok: false
      reason:
        | 'not_found'
        | 'corrupt'
        | 'version_unsupported'
        | 'parse_error'
        | 'disabled'
      error?: Error
    }

interface Envelope {
  version: number
  timestamp: number
  data: unknown
}

const NAMESPACE = 'zxkit'
const DEFAULT_SLOT = 'default'

function storageKey(profileKey: string, slot: string): string {
  return `${NAMESPACE}:${profileKey}:${slot}`
}

/**
 * Resolves the localStorage reference, returning null if unavailable
 * (Node, SSR, private browsing where access itself throws, etc.).
 */
function getStorage(): Storage | null {
  try {
    if (typeof globalThis === 'undefined') return null
    return (globalThis as { localStorage?: Storage }).localStorage ?? null
  } catch {
    return null
  }
}

function isValidEnvelope(value: unknown): value is Envelope {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.version === 'number' &&
    Number.isFinite(v.version) &&
    typeof v.timestamp === 'number' &&
    Number.isFinite(v.timestamp) &&
    'data' in v
  )
}

/**
 * Registers a save profile for a game. Call once at startup and reuse the
 * returned handle for all save/load operations.
 *
 * @example
 * const save = createSaveProfile<MinefieldSave>({
 *   key: 'minefield',
 *   version: 1,
 *   serialize: () => ({ score, lives, probed: [...probedCells] }),
 *   deserialize: (data) => { score = data.score; probedCells = new Set(data.probed) },
 * })
 */
export function createSaveProfile<T>(config: SaveProfileConfig<T>): SaveProfile<T> {
  return {
    key: config.key,
    version: config.version,
    config,
    lastWrites: new Map(),
  }
}

/**
 * Writes the current game state to a slot immediately. Calls `serialize`
 * to obtain the payload, then stores `{ version, timestamp, data }` as JSON.
 *
 * @param slot - Slot name; defaults to `'default'`. Games typically use
 *   convention-based names like `'auto'` or `'manual'`.
 */
export function writeSave<T>(
  profile: SaveProfile<T>,
  slot: string = DEFAULT_SLOT,
): SaveResult {
  const storage = getStorage()
  if (!storage) return { ok: false, reason: 'disabled' }

  let payload: T
  try {
    payload = profile.config.serialize()
  } catch (error) {
    return { ok: false, reason: 'serialize_error', error: error as Error }
  }

  const envelope: Envelope = {
    version: profile.version,
    timestamp: Date.now(),
    data: payload,
  }

  let serialized: string
  try {
    serialized = JSON.stringify(envelope)
  } catch (error) {
    return { ok: false, reason: 'serialize_error', error: error as Error }
  }

  try {
    storage.setItem(storageKey(profile.key, slot), serialized)
  } catch (error) {
    const err = error as Error & { code?: number }
    if (err.name === 'QuotaExceededError' || err.code === 22) {
      return { ok: false, reason: 'quota', error: err }
    }
    return { ok: false, reason: 'disabled', error: err }
  }

  profile.lastWrites.set(slot, envelope.timestamp)
  return { ok: true }
}

/**
 * Writes to `slot` only if at least `minIntervalMs` has elapsed since the
 * last successful write to the same slot in this session. Otherwise returns
 * `{ ok: false, reason: 'throttled' }`.
 *
 * Throttle state is in-memory; a page reload resets it.
 */
export function writeSaveThrottled<T>(
  profile: SaveProfile<T>,
  slot: string,
  minIntervalMs: number,
): SaveResult {
  const last = profile.lastWrites.get(slot)
  if (last !== undefined && Date.now() - last < minIntervalMs) {
    return { ok: false, reason: 'throttled' }
  }
  return writeSave(profile, slot)
}

/**
 * Reads a slot, runs migration if needed, then calls `deserialize` with
 * the resulting payload. On success the game state has been restored.
 */
export function readSave<T>(
  profile: SaveProfile<T>,
  slot: string = DEFAULT_SLOT,
): LoadResult {
  const storage = getStorage()
  if (!storage) return { ok: false, reason: 'disabled' }

  const raw = storage.getItem(storageKey(profile.key, slot))
  if (raw === null) return { ok: false, reason: 'not_found' }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    return { ok: false, reason: 'parse_error', error: error as Error }
  }

  if (!isValidEnvelope(parsed)) {
    return { ok: false, reason: 'corrupt' }
  }

  let data: unknown = parsed.data

  if (parsed.version !== profile.version) {
    if (parsed.version > profile.version) {
      return { ok: false, reason: 'version_unsupported' }
    }
    if (!profile.config.migrate) {
      return { ok: false, reason: 'version_unsupported' }
    }
    try {
      data = profile.config.migrate(data, parsed.version)
    } catch (error) {
      return { ok: false, reason: 'corrupt', error: error as Error }
    }
  }

  try {
    profile.config.deserialize(data as T)
  } catch (error) {
    return { ok: false, reason: 'corrupt', error: error as Error }
  }

  return { ok: true, slot }
}

/**
 * Reads whichever slot has the newest timestamp. Returns `not_found` if
 * no slots exist for this profile's key.
 */
export function readSaveLatest<T>(profile: SaveProfile<T>): LoadResult {
  const slots = listSaves(profile)
  if (slots.length === 0) return { ok: false, reason: 'not_found' }

  let newest = slots[0]
  for (let i = 1; i < slots.length; i++) {
    if (slots[i].timestamp > newest.timestamp) newest = slots[i]
  }
  return readSave(profile, newest.name)
}

/** True iff the slot exists in storage. Does not validate envelope shape. */
export function saveExists<T>(
  profile: SaveProfile<T>,
  slot: string = DEFAULT_SLOT,
): boolean {
  const storage = getStorage()
  if (!storage) return false
  try {
    return storage.getItem(storageKey(profile.key, slot)) !== null
  } catch {
    return false
  }
}

/**
 * Removes a slot. Returns `true` if a slot was removed, `false` if it
 * didn't exist or storage is unavailable.
 */
export function deleteSave<T>(
  profile: SaveProfile<T>,
  slot: string = DEFAULT_SLOT,
): boolean {
  const storage = getStorage()
  if (!storage) return false

  const key = storageKey(profile.key, slot)
  try {
    if (storage.getItem(key) === null) return false
    storage.removeItem(key)
  } catch {
    return false
  }
  profile.lastWrites.delete(slot)
  return true
}

/**
 * Enumerates all slots that belong to this profile's key. Corrupt or
 * mis-shaped entries are silently skipped — they will surface as `corrupt`
 * if loaded explicitly via {@link readSave}.
 */
export function listSaves<T>(profile: SaveProfile<T>): SlotInfo[] {
  const storage = getStorage()
  if (!storage) return []

  const prefix = `${NAMESPACE}:${profile.key}:`
  const slots: SlotInfo[] = []

  let length = 0
  try {
    length = storage.length
  } catch {
    return []
  }

  for (let i = 0; i < length; i++) {
    let key: string | null = null
    try {
      key = storage.key(i)
    } catch {
      continue
    }
    if (!key || !key.startsWith(prefix)) continue

    let raw: string | null = null
    try {
      raw = storage.getItem(key)
    } catch {
      continue
    }
    if (raw === null) continue

    try {
      const parsed = JSON.parse(raw)
      if (isValidEnvelope(parsed)) {
        slots.push({
          name: key.slice(prefix.length),
          timestamp: parsed.timestamp,
          version: parsed.version,
          sizeBytes: raw.length,
        })
      }
    } catch {
      // skip corrupt entries
    }
  }

  return slots
}
