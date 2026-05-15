import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createSaveProfile,
  writeSave,
  writeSaveThrottled,
  readSave,
  readSaveLatest,
  saveExists,
  deleteSave,
  listSaves,
} from './src/save.js'
import type { SaveProfileConfig } from './src/save.js'

// ── Mock localStorage ───────────────────────────────────────────────────────

class MockStorage implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
}

function installMockStorage(): MockStorage {
  const storage = new MockStorage()
  vi.stubGlobal('localStorage', storage)
  return storage
}

function uninstallStorage(): void {
  vi.unstubAllGlobals()
}

// ── Test fixtures ───────────────────────────────────────────────────────────

interface DemoSave {
  score: number
  level: number
  probed: string[]
}

function createDemoConfig(
  state: { score: number; level: number; probed: Set<string> },
  overrides: Partial<SaveProfileConfig<DemoSave>> = {},
): SaveProfileConfig<DemoSave> {
  return {
    key: 'demo',
    version: 1,
    serialize: () => ({
      score: state.score,
      level: state.level,
      probed: [...state.probed],
    }),
    deserialize: (data) => {
      state.score = data.score
      state.level = data.level
      state.probed = new Set(data.probed)
    },
    ...overrides,
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Save — happy path', () => {
  beforeEach(() => installMockStorage())
  afterEach(() => uninstallStorage())

  it('round-trips a save through writeSave → readSave', () => {
    const writer = { score: 1000, level: 3, probed: new Set(['1,2', '3,4']) }
    const profile = createSaveProfile(createDemoConfig(writer))

    expect(writeSave(profile, 'slot1')).toEqual({ ok: true })

    const reader = { score: 0, level: 0, probed: new Set<string>() }
    const readerProfile = createSaveProfile(createDemoConfig(reader))
    const result = readSave(readerProfile, 'slot1')

    expect(result).toEqual({ ok: true, slot: 'slot1' })
    expect(reader.score).toBe(1000)
    expect(reader.level).toBe(3)
    expect(reader.probed).toEqual(new Set(['1,2', '3,4']))
  })

  it('defaults to slot "default" when none is given', () => {
    const writer = { score: 50, level: 1, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(writer))

    writeSave(profile)
    expect(saveExists(profile)).toBe(true)
    expect(saveExists(profile, 'default')).toBe(true)
  })

  it('namespaces keys per game so two profiles do not collide', () => {
    const stateA = { score: 1, level: 1, probed: new Set<string>() }
    const stateB = { score: 2, level: 2, probed: new Set<string>() }
    const profileA = createSaveProfile({ ...createDemoConfig(stateA), key: 'gameA' })
    const profileB = createSaveProfile({ ...createDemoConfig(stateB), key: 'gameB' })

    writeSave(profileA, 'shared')
    writeSave(profileB, 'shared')

    const readA = { score: 0, level: 0, probed: new Set<string>() }
    const readB = { score: 0, level: 0, probed: new Set<string>() }
    const readProfileA = createSaveProfile({ ...createDemoConfig(readA), key: 'gameA' })
    const readProfileB = createSaveProfile({ ...createDemoConfig(readB), key: 'gameB' })

    readSave(readProfileA, 'shared')
    readSave(readProfileB, 'shared')

    expect(readA.score).toBe(1)
    expect(readB.score).toBe(2)
  })

  it('overwrites the same slot on repeated writes', () => {
    const state = { score: 100, level: 1, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))

    writeSave(profile, 'auto')
    state.score = 200
    writeSave(profile, 'auto')

    const reader = { score: 0, level: 0, probed: new Set<string>() }
    const readerProfile = createSaveProfile(createDemoConfig(reader))
    readSave(readerProfile, 'auto')
    expect(reader.score).toBe(200)
  })
})

describe('Save — listSaves and readSaveLatest', () => {
  beforeEach(() => installMockStorage())
  afterEach(() => uninstallStorage())

  it('listSaves returns metadata for every slot of this profile only', () => {
    const state = { score: 10, level: 1, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))
    const otherProfile = createSaveProfile({ ...createDemoConfig(state), key: 'other' })

    writeSave(profile, 'a')
    writeSave(profile, 'b')
    writeSave(otherProfile, 'c')

    const slots = listSaves(profile)
    expect(slots.map((s) => s.name).sort()).toEqual(['a', 'b'])
    expect(slots.every((s) => s.version === 1)).toBe(true)
    expect(slots.every((s) => s.sizeBytes > 0)).toBe(true)
  })

  it('listSaves skips entries that are not valid envelopes', () => {
    const state = { score: 1, level: 1, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))
    writeSave(profile, 'good')

    // Inject garbage under our namespace
    localStorage.setItem('zxkit:demo:bad-json', '{not json')
    localStorage.setItem('zxkit:demo:wrong-shape', '{"foo":1}')

    const slots = listSaves(profile)
    expect(slots.map((s) => s.name)).toEqual(['good'])
  })

  it('readSaveLatest picks the slot with the newest timestamp', () => {
    const state = { score: 1, level: 1, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))

    vi.useFakeTimers()
    vi.setSystemTime(1000)
    writeSave(profile, 'old')
    state.score = 999
    vi.setSystemTime(5000)
    writeSave(profile, 'new')
    vi.useRealTimers()

    const reader = { score: 0, level: 0, probed: new Set<string>() }
    const readerProfile = createSaveProfile(createDemoConfig(reader))
    const result = readSaveLatest(readerProfile)

    expect(result).toEqual({ ok: true, slot: 'new' })
    expect(reader.score).toBe(999)
  })

  it('readSaveLatest returns not_found when no slots exist', () => {
    const state = { score: 0, level: 0, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))
    expect(readSaveLatest(profile)).toEqual({ ok: false, reason: 'not_found' })
  })
})

describe('Save — throttling', () => {
  beforeEach(() => {
    installMockStorage()
    vi.useFakeTimers()
    vi.setSystemTime(10000)
  })
  afterEach(() => {
    vi.useRealTimers()
    uninstallStorage()
  })

  it('first writeSaveThrottled call goes through', () => {
    const state = { score: 1, level: 1, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))

    expect(writeSaveThrottled(profile, 'auto', 5000)).toEqual({ ok: true })
  })

  it('skips subsequent calls within interval with reason "throttled"', () => {
    const state = { score: 1, level: 1, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))

    writeSaveThrottled(profile, 'auto', 5000)
    vi.setSystemTime(11000) // +1s
    const result = writeSaveThrottled(profile, 'auto', 5000)
    expect(result).toEqual({ ok: false, reason: 'throttled' })
  })

  it('allows write after interval has elapsed', () => {
    const state = { score: 1, level: 1, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))

    writeSaveThrottled(profile, 'auto', 5000)
    vi.setSystemTime(15001) // +5.001s
    expect(writeSaveThrottled(profile, 'auto', 5000)).toEqual({ ok: true })
  })

  it('throttle is per-slot, not global', () => {
    const state = { score: 1, level: 1, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))

    writeSaveThrottled(profile, 'slotA', 5000)
    // Different slot — should not be blocked
    expect(writeSaveThrottled(profile, 'slotB', 5000)).toEqual({ ok: true })
  })

  it('immediate writeSave bypasses throttle but updates last-write time', () => {
    const state = { score: 1, level: 1, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))

    writeSave(profile, 'auto')
    // Throttle window is active because writeSave also updated lastWrites
    expect(writeSaveThrottled(profile, 'auto', 5000)).toEqual({
      ok: false,
      reason: 'throttled',
    })
  })

  it('throttle state resets after creating a fresh profile (simulates reload)', () => {
    const state = { score: 1, level: 1, probed: new Set<string>() }
    const profile1 = createSaveProfile(createDemoConfig(state))
    writeSaveThrottled(profile1, 'auto', 5000)

    // Simulate page reload — fresh profile, in-memory map starts empty
    const profile2 = createSaveProfile(createDemoConfig(state))
    expect(writeSaveThrottled(profile2, 'auto', 5000)).toEqual({ ok: true })
  })
})

describe('Save — migration', () => {
  beforeEach(() => installMockStorage())
  afterEach(() => uninstallStorage())

  it('runs migrate when stored version is older than profile version', () => {
    // Write a v1 save with a legacy shape
    const v1State = { score: 100, level: 1, probed: new Set<string>() }
    const v1Profile = createSaveProfile(createDemoConfig(v1State))
    writeSave(v1Profile, 'slot1')

    // Now read with a v2 profile that knows how to migrate
    interface V2Save extends DemoSave {
      lives: number
    }
    const v2State = { score: 0, level: 0, lives: 0, probed: new Set<string>() }
    const v2Config: SaveProfileConfig<V2Save> = {
      key: 'demo',
      version: 2,
      serialize: () => ({ ...v2State, probed: [...v2State.probed] }),
      deserialize: (data) => {
        v2State.score = data.score
        v2State.level = data.level
        v2State.lives = data.lives
        v2State.probed = new Set(data.probed)
      },
      migrate: (data, fromVersion) => {
        expect(fromVersion).toBe(1)
        return { ...(data as DemoSave), lives: 3 }
      },
    }
    const v2Profile = createSaveProfile(v2Config)
    const result = readSave(v2Profile, 'slot1')

    expect(result.ok).toBe(true)
    expect(v2State.score).toBe(100)
    expect(v2State.lives).toBe(3)
  })

  it('fails with version_unsupported when older save has no migrate', () => {
    const state = { score: 1, level: 1, probed: new Set<string>() }
    const v1Profile = createSaveProfile(createDemoConfig(state))
    writeSave(v1Profile, 'slot1')

    const v3Profile = createSaveProfile({
      ...createDemoConfig(state),
      version: 3,
      // no migrate
    })
    expect(readSave(v3Profile, 'slot1')).toEqual({
      ok: false,
      reason: 'version_unsupported',
    })
  })

  it('fails with version_unsupported when stored version is newer than profile', () => {
    // Manually inject a future-version envelope
    localStorage.setItem(
      'zxkit:demo:slot1',
      JSON.stringify({ version: 99, timestamp: 100, data: {} }),
    )

    const state = { score: 0, level: 0, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))
    expect(readSave(profile, 'slot1')).toEqual({
      ok: false,
      reason: 'version_unsupported',
    })
  })

  it('returns corrupt when migrate throws', () => {
    const state = { score: 1, level: 1, probed: new Set<string>() }
    const v1Profile = createSaveProfile(createDemoConfig(state))
    writeSave(v1Profile, 'slot1')

    const v2Profile = createSaveProfile({
      ...createDemoConfig(state),
      version: 2,
      migrate: () => {
        throw new Error('migration blew up')
      },
    })
    const result = readSave(v2Profile, 'slot1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('corrupt')
      expect(result.error?.message).toBe('migration blew up')
    }
  })
})

describe('Save — failure modes', () => {
  beforeEach(() => installMockStorage())
  afterEach(() => uninstallStorage())

  it('write returns "quota" when setItem throws QuotaExceededError', () => {
    const state = { score: 1, level: 1, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))

    const storage = localStorage as MockStorage
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      const err = new Error('quota exceeded') as Error & { code?: number }
      err.name = 'QuotaExceededError'
      err.code = 22
      throw err
    })

    const result = writeSave(profile, 'slot1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('quota')
  })

  it('write returns "disabled" when localStorage is absent', () => {
    vi.stubGlobal('localStorage', undefined)
    const state = { score: 1, level: 1, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))

    const result = writeSave(profile, 'slot1')
    expect(result).toEqual({ ok: false, reason: 'disabled' })
  })

  it('write returns "serialize_error" when serialize throws', () => {
    const profile = createSaveProfile<DemoSave>({
      key: 'demo',
      version: 1,
      serialize: () => {
        throw new Error('boom')
      },
      deserialize: () => {},
    })

    const result = writeSave(profile, 'slot1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('serialize_error')
      expect(result.error?.message).toBe('boom')
    }
  })

  it('write returns "serialize_error" when payload has circular references', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular

    const profile = createSaveProfile<unknown>({
      key: 'demo',
      version: 1,
      serialize: () => circular,
      deserialize: () => {},
    })

    const result = writeSave(profile, 'slot1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('serialize_error')
  })

  it('read returns "not_found" when slot does not exist', () => {
    const state = { score: 0, level: 0, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))
    expect(readSave(profile, 'missing')).toEqual({ ok: false, reason: 'not_found' })
  })

  it('read returns "parse_error" when stored value is not valid JSON', () => {
    localStorage.setItem('zxkit:demo:slot1', '{not valid json')
    const state = { score: 0, level: 0, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))

    const result = readSave(profile, 'slot1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('parse_error')
  })

  it('read returns "corrupt" when envelope is missing required fields', () => {
    localStorage.setItem('zxkit:demo:slot1', JSON.stringify({ data: {} }))
    const state = { score: 0, level: 0, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))

    expect(readSave(profile, 'slot1')).toEqual({ ok: false, reason: 'corrupt' })
  })

  it('read returns "corrupt" when deserialize throws', () => {
    // Write a valid save with one profile
    const state = { score: 1, level: 1, probed: new Set<string>() }
    const writerProfile = createSaveProfile(createDemoConfig(state))
    writeSave(writerProfile, 'slot1')

    // Read with a profile whose deserialize throws
    const brokenProfile = createSaveProfile<DemoSave>({
      key: 'demo',
      version: 1,
      serialize: () => ({ score: 0, level: 0, probed: [] }),
      deserialize: () => {
        throw new Error('deserialize blew up')
      },
    })

    const result = readSave(brokenProfile, 'slot1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('corrupt')
  })

  it('read returns "disabled" when localStorage is absent', () => {
    vi.stubGlobal('localStorage', undefined)
    const state = { score: 0, level: 0, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))
    expect(readSave(profile, 'slot1')).toEqual({ ok: false, reason: 'disabled' })
  })
})

describe('Save — saveExists / deleteSave', () => {
  beforeEach(() => installMockStorage())
  afterEach(() => uninstallStorage())

  it('saveExists reflects storage state', () => {
    const state = { score: 1, level: 1, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))

    expect(saveExists(profile, 'slot1')).toBe(false)
    writeSave(profile, 'slot1')
    expect(saveExists(profile, 'slot1')).toBe(true)
  })

  it('deleteSave removes the slot and resets its throttle entry', () => {
    const state = { score: 1, level: 1, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))

    vi.useFakeTimers()
    vi.setSystemTime(1000)
    writeSaveThrottled(profile, 'auto', 5000)
    expect(profile.lastWrites.has('auto')).toBe(true)

    expect(deleteSave(profile, 'auto')).toBe(true)
    expect(saveExists(profile, 'auto')).toBe(false)
    expect(profile.lastWrites.has('auto')).toBe(false)

    // Next throttled write should now proceed even within the original window
    vi.setSystemTime(2000)
    expect(writeSaveThrottled(profile, 'auto', 5000)).toEqual({ ok: true })
    vi.useRealTimers()
  })

  it('deleteSave returns false when slot does not exist', () => {
    const state = { score: 1, level: 1, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))
    expect(deleteSave(profile, 'nonexistent')).toBe(false)
  })

  it('saveExists returns false when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined)
    const state = { score: 1, level: 1, probed: new Set<string>() }
    const profile = createSaveProfile(createDemoConfig(state))
    expect(saveExists(profile, 'slot1')).toBe(false)
  })
})
