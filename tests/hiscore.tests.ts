import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createHighScores,
  loadHighScores,
  insertScore,
  isHighScore,
  clearHighScores,
  type HighScoreEntry,
} from '../src/hiscore.js'

// ── Mock localStorage (same shape as save.tests.ts) ─────────────────────────

class MockStorage implements Storage {
  private store = new Map<string, string>()
  get length(): number { return this.store.size }
  clear(): void { this.store.clear() }
  getItem(key: string): string | null { return this.store.get(key) ?? null }
  setItem(key: string, value: string): void { this.store.set(key, value) }
  removeItem(key: string): void { this.store.delete(key) }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null }
}

let storage: MockStorage
beforeEach(() => {
  storage = new MockStorage()
  vi.stubGlobal('localStorage', storage)
})
afterEach(() => vi.unstubAllGlobals())

const plain = () => createHighScores({ key: 'demo' })

function fill(table = plain(), scores = [500, 400, 300, 200, 100]): void {
  for (const score of scores) insertScore(table, { name: 'AAA', score })
}

// ── Basics ──────────────────────────────────────────────────────────────────

describe('createHighScores + loadHighScores', () => {
  it('a fresh table is empty', () => {
    expect(loadHighScores(plain())).toEqual([])
  })

  it('stores under the game namespace: zxkit:<key>:hiscore', () => {
    insertScore(plain(), { name: 'ZAP', score: 100 })
    expect(storage.getItem('zxkit:demo:hiscore')).not.toBeNull()
  })

  it('a missing, corrupt or foreign table loads as empty, never throws', () => {
    storage.setItem('zxkit:demo:hiscore', 'not json {')
    expect(loadHighScores(plain())).toEqual([])
    storage.setItem('zxkit:demo:hiscore', JSON.stringify({ version: 1, timestamp: 1, data: 'nope' }))
    expect(loadHighScores(plain())).toEqual([])
  })
})

describe('insertScore', () => {
  it('places, persists and reports a 1-based rank', () => {
    const table = plain()
    const r = insertScore(table, { name: 'ZAP', score: 300 })
    expect(r).toMatchObject({ placed: true, rank: 1, saved: { ok: true } })
    expect(loadHighScores(plain())).toEqual([{ name: 'ZAP', score: 300 }])
  })

  it('keeps best-first order and evicts below maxEntries', () => {
    const table = plain()
    fill(table)
    const r = insertScore(table, { name: 'NEW', score: 450 })
    expect(r.rank).toBe(2)
    const scores = loadHighScores(table)
    expect(scores.map((e) => e.score)).toEqual([500, 450, 400, 300, 200])
    expect(scores.some((e) => e.score === 100)).toBe(false)
  })

  it('rejects a score below a full table without writing', () => {
    const table = plain()
    fill(table)
    const before = storage.getItem('zxkit:demo:hiscore')
    const r = insertScore(table, { name: 'LOW', score: 50 })
    expect(r).toMatchObject({ placed: false, rank: null, saved: null })
    expect(storage.getItem('zxkit:demo:hiscore')).toBe(before)
  })

  it('on a tie the earlier entry keeps the higher rank', () => {
    const table = plain()
    insertScore(table, { name: 'OLD', score: 300 })
    const r = insertScore(table, { name: 'NEW', score: 300 })
    expect(r.rank).toBe(2)
    expect(loadHighScores(table).map((e) => e.name)).toEqual(['OLD', 'NEW'])
  })

  it('rejects invalid entries: blank or overlong names, non-finite scores', () => {
    const table = plain()
    expect(insertScore(table, { name: '   ', score: 100 }).placed).toBe(false)
    expect(insertScore(table, { name: 'TOOLONGNAME', score: 100 }).placed).toBe(false)
    expect(insertScore(table, { name: 'NAN', score: Number.NaN }).placed).toBe(false)
    expect(loadHighScores(table)).toEqual([])
  })

  it('honours a custom maxEntries', () => {
    const table = createHighScores({ key: 'demo', maxEntries: 3 })
    fill(table, [500, 400, 300])
    expect(insertScore(table, { name: 'LOW', score: 100 }).placed).toBe(false)
    expect(loadHighScores(table)).toHaveLength(3)
  })
})

describe('isHighScore', () => {
  it('zero and negative never qualify', () => {
    expect(isHighScore(plain(), 0)).toBe(false)
    expect(isHighScore(plain(), -5)).toBe(false)
  })

  it('any positive score qualifies while the table is not full', () => {
    expect(isHighScore(plain(), 1)).toBe(true)
  })

  it('on a full table only beating the last entry qualifies', () => {
    const table = plain()
    fill(table)
    expect(isHighScore(table, 100)).toBe(false)   // equal to last — not better
    expect(isHighScore(table, 101)).toBe(true)
  })
})

describe('clearHighScores', () => {
  it('wipes the table and reports whether one existed', () => {
    const table = plain()
    insertScore(table, { name: 'ZAP', score: 100 })
    expect(clearHighScores(table)).toBe(true)
    expect(loadHighScores(table)).toEqual([])
    expect(clearHighScores(table)).toBe(false)
  })
})

// ── Game-specific Extra fields ──────────────────────────────────────────────

interface DailyExtra { level: number; date?: string }

const daily = () =>
  createHighScores<DailyExtra>({
    key: 'demo',
    validateExtra: (e) =>
      typeof e.level === 'number' && Number.isFinite(e.level) &&
      (e.date === undefined || typeof e.date === 'string'),
  })

describe('Extra fields (the minefield shape: level + optional daily date)', () => {
  it('round-trips extra fields', () => {
    const table = daily()
    insertScore(table, { name: 'ZAP', score: 100, level: 3, date: '2026-07-11' })
    insertScore(table, { name: 'POK', score: 200, level: 1 })   // legacy: no date
    const scores = loadHighScores(table)
    expect(scores[0]).toEqual({ name: 'POK', score: 200, level: 1 })
    expect(scores[1]).toEqual({ name: 'ZAP', score: 100, level: 3, date: '2026-07-11' })
  })

  it('drops hand-forged rows that fail validateExtra', () => {
    const table = daily()
    insertScore(table, { name: 'ZAP', score: 100, level: 3 })
    const env = JSON.parse(storage.getItem('zxkit:demo:hiscore')!)
    env.data.push({ name: 'BAD', score: 900, level: 'nine' })
    storage.setItem('zxkit:demo:hiscore', JSON.stringify(env))
    expect(loadHighScores(table)).toEqual([{ name: 'ZAP', score: 100, level: 3 }])
  })
})

// ── Integrity (secret) ──────────────────────────────────────────────────────

describe('tamper deterrence', () => {
  const signed = () => createHighScores({ key: 'demo', secret: 's3cret' })

  it('a signed table round-trips', () => {
    const table = signed()
    insertScore(table, { name: 'ZAP', score: 100 })
    expect(loadHighScores(signed())).toEqual([{ name: 'ZAP', score: 100 }])
  })

  it('bumping a score by hand empties the table instead of leaking onto it', () => {
    const table = signed()
    insertScore(table, { name: 'ZAP', score: 100 })
    const env = JSON.parse(storage.getItem('zxkit:demo:hiscore')!)
    env.data[0].score = 999999
    storage.setItem('zxkit:demo:hiscore', JSON.stringify(env))
    expect(loadHighScores(signed())).toEqual([])
  })

  it('a broken table heals on the next legitimate insert', () => {
    const table = signed()
    insertScore(table, { name: 'ZAP', score: 100 })
    storage.setItem('zxkit:demo:hiscore', 'garbage')
    const r = insertScore(table, { name: 'NEW', score: 50 })
    expect(r).toMatchObject({ placed: true, rank: 1 })
    expect(loadHighScores(signed())).toEqual([{ name: 'NEW', score: 50 }] as HighScoreEntry[])
  })
})
