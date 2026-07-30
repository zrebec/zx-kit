import { describe, it, expect } from 'vitest'
import { createRng, hashSeed } from '../src/rng.js'

// ── hashSeed ────────────────────────────────────────────────────────────────

describe('hashSeed', () => {
  it('is deterministic for the same string', () => {
    expect(hashSeed('cave-7')).toBe(hashSeed('cave-7'))
  })

  it('produces an unsigned 32-bit integer', () => {
    const h = hashSeed('anything')
    expect(Number.isInteger(h)).toBe(true)
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThanOrEqual(0xffffffff)
  })

  it('different strings hash differently', () => {
    expect(hashSeed('alpha')).not.toBe(hashSeed('beta'))
  })

  it('empty string returns the FNV offset basis', () => {
    expect(hashSeed('')).toBe(2166136261)
  })
})

// ── createRng — seeding ───────────────────────────────────────────────────────

describe('createRng — seeding & determinism', () => {
  it('same string seed → identical sequence', () => {
    const a = createRng('seed')
    const b = createRng('seed')
    const seqA = [a.next(), a.next(), a.next()]
    const seqB = [b.next(), b.next(), b.next()]
    expect(seqA).toEqual(seqB)
  })

  it('same numeric seed → identical sequence', () => {
    const a = createRng(12345)
    const b = createRng(12345)
    expect(a.next()).toBe(b.next())
  })

  it('different seeds → different sequences', () => {
    const a = createRng('a')
    const b = createRng('b')
    expect(a.next()).not.toBe(b.next())
  })

  it('numeric and string seeds are both accepted', () => {
    expect(() => createRng(0)).not.toThrow()
    expect(() => createRng('x')).not.toThrow()
  })

  it('coerces a numeric seed to uint32 (negative seed works)', () => {
    expect(() => createRng(-1)).not.toThrow()
    const a = createRng(-1)
    const b = createRng(0xffffffff)        // -1 >>> 0
    expect(a.next()).toBe(b.next())
  })

  it('throws on a non-finite numeric seed (Infinity)', () => {
    expect(() => createRng(Infinity)).toThrow(/seed must be finite/)
  })

  it('throws on NaN seed', () => {
    expect(() => createRng(NaN)).toThrow(/seed must be finite/)
  })
})

// ── next ──────────────────────────────────────────────────────────────────────

describe('Rng.next', () => {
  it('returns floats within [0, 1)', () => {
    const rng = createRng('range')
    for (let i = 0; i < 1000; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('advances state (consecutive calls differ)', () => {
    const rng = createRng('advance')
    expect(rng.next()).not.toBe(rng.next())
  })
})

// ── int ─────────────────────────────────────────────────────────────────────

describe('Rng.int', () => {
  it('returns integers within [0, maxExclusive)', () => {
    const rng = createRng('int')
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(8)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(8)
    }
  })

  it('int(1) is always 0', () => {
    const rng = createRng('one')
    for (let i = 0; i < 50; i++) expect(rng.int(1)).toBe(0)
  })

  it('throws on zero', () => {
    expect(() => createRng('z').int(0)).toThrow(/positive integer/)
  })

  it('throws on negative max', () => {
    expect(() => createRng('z').int(-3)).toThrow(/positive integer/)
  })

  it('throws on non-integer max', () => {
    expect(() => createRng('z').int(2.5)).toThrow(/positive integer/)
  })
})

// ── range ─────────────────────────────────────────────────────────────────────

describe('Rng.range', () => {
  it('returns integers within [min, max)', () => {
    const rng = createRng('rng-range')
    for (let i = 0; i < 1000; i++) {
      const v = rng.range(2, 6)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(2)
      expect(v).toBeLessThan(6)
    }
  })

  it('supports negative ranges', () => {
    const rng = createRng('neg')
    for (let i = 0; i < 200; i++) {
      const v = rng.range(-5, -1)
      expect(v).toBeGreaterThanOrEqual(-5)
      expect(v).toBeLessThan(-1)
    }
  })

  it('throws when max <= min', () => {
    expect(() => createRng('z').range(5, 5)).toThrow(/greater than minInclusive/)
    expect(() => createRng('z').range(5, 3)).toThrow(/greater than minInclusive/)
  })

  it('throws on non-integer min', () => {
    expect(() => createRng('z').range(0.5, 4)).toThrow(/bounds must be integers/)
  })

  it('throws on non-integer max', () => {
    expect(() => createRng('z').range(0, 4.5)).toThrow(/bounds must be integers/)
  })
})

// ── float ─────────────────────────────────────────────────────────────────────

describe('Rng.float', () => {
  it('returns floats within [min, max)', () => {
    const rng = createRng('float')
    for (let i = 0; i < 1000; i++) {
      const v = rng.float(0.5, 1.5)
      expect(v).toBeGreaterThanOrEqual(0.5)
      expect(v).toBeLessThan(1.5)
    }
  })

  it('min === max collapses to that value', () => {
    const rng = createRng('collapse')
    expect(rng.float(2, 2)).toBe(2)
  })

  it('throws when max < min', () => {
    expect(() => createRng('z').float(2, 1)).toThrow(/max must be >= min/)
  })
})

// ── chance ────────────────────────────────────────────────────────────────────

describe('Rng.chance', () => {
  it('p = 0 is always false', () => {
    const rng = createRng('p0')
    for (let i = 0; i < 100; i++) expect(rng.chance(0)).toBe(false)
  })

  it('p = 1 is always true', () => {
    const rng = createRng('p1')
    for (let i = 0; i < 100; i++) expect(rng.chance(1)).toBe(true)
  })

  it('roughly matches the requested probability', () => {
    const rng = createRng('dist')
    let hits = 0
    const N = 5000
    for (let i = 0; i < N; i++) if (rng.chance(0.25)) hits++
    expect(hits / N).toBeGreaterThan(0.20)
    expect(hits / N).toBeLessThan(0.30)
  })

  it('throws when p < 0', () => {
    expect(() => createRng('z').chance(-0.1)).toThrow(/in \[0, 1\]/)
  })

  it('throws when p > 1', () => {
    expect(() => createRng('z').chance(1.1)).toThrow(/in \[0, 1\]/)
  })
})

// ── pick ──────────────────────────────────────────────────────────────────────

describe('Rng.pick', () => {
  it('returns an element of the array', () => {
    const rng = createRng('pick')
    const arr = ['a', 'b', 'c', 'd']
    for (let i = 0; i < 200; i++) expect(arr).toContain(rng.pick(arr))
  })

  it('single-element array always returns that element', () => {
    const rng = createRng('solo')
    expect(rng.pick([42])).toBe(42)
  })

  it('throws on empty array', () => {
    expect(() => createRng('z').pick([])).toThrow(/empty array/)
  })
})

// ── shuffle ───────────────────────────────────────────────────────────────────

describe('Rng.shuffle', () => {
  it('returns the same array reference (in place)', () => {
    const rng = createRng('shuf')
    const arr = [1, 2, 3, 4, 5]
    expect(rng.shuffle(arr)).toBe(arr)
  })

  it('preserves the multiset of elements', () => {
    const rng = createRng('multiset')
    const arr = [1, 2, 3, 4, 5, 6, 7, 8]
    const sorted = [...rng.shuffle(arr)].sort((a, b) => a - b)
    expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('is deterministic for the same seed', () => {
    const a = createRng('det').shuffle([1, 2, 3, 4, 5])
    const b = createRng('det').shuffle([1, 2, 3, 4, 5])
    expect(a).toEqual(b)
  })

  it('empty array stays empty (loop body never runs)', () => {
    const rng = createRng('empty')
    expect(rng.shuffle([])).toEqual([])
  })

  it('single-element array is unchanged (loop body never runs)', () => {
    const rng = createRng('one')
    expect(rng.shuffle([9])).toEqual([9])
  })
})

// ── shuffleCopy ───────────────────────────────────────────────────────────────

describe('Rng.shuffleCopy', () => {
  it('leaves the source untouched and returns a different array', () => {
    const rng = createRng('copy')
    const src = [1, 2, 3, 4, 5, 6, 7, 8]
    const out = rng.shuffleCopy(src)
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(out).not.toBe(src)
  })

  it('preserves the multiset of elements', () => {
    const rng = createRng('copy-multiset')
    const out = rng.shuffleCopy([1, 2, 3, 4, 5, 6, 7, 8])
    expect([...out].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('draws from the same stream as shuffle (same seed ⇒ same permutation)', () => {
    const viaCopy = createRng('same').shuffleCopy([1, 2, 3, 4, 5, 6])
    const viaInPlace = createRng('same').shuffle([1, 2, 3, 4, 5, 6])
    expect(viaCopy).toEqual(viaInPlace)
  })

  it('accepts a readonly array — the reason this exists', () => {
    const rng = createRng('ro')
    // `as const` and `readonly T[]` are what content tables look like; shuffle()
    // cannot take one, so this must compile as well as run.
    const DECK: readonly string[] = ['a', 'b', 'c', 'd']
    const out = rng.shuffleCopy(DECK)
    expect([...out].sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(DECK).toEqual(['a', 'b', 'c', 'd'])
  })

  it('empty and single-element arrays copy cleanly', () => {
    const rng = createRng('edge')
    const empty: readonly number[] = []
    const one: readonly number[] = [9]
    expect(rng.shuffleCopy(empty)).toEqual([])
    expect(rng.shuffleCopy(empty)).not.toBe(empty)
    expect(rng.shuffleCopy(one)).toEqual([9])
  })

  it('is deterministic for the same seed', () => {
    expect(createRng('det2').shuffleCopy([1, 2, 3, 4, 5]))
      .toEqual(createRng('det2').shuffleCopy([1, 2, 3, 4, 5]))
  })
})

// ── fork ──────────────────────────────────────────────────────────────────────

describe('Rng.fork', () => {
  it('returns an independent generator', () => {
    const parent = createRng('parent')
    const child = parent.fork()
    // Child has its own stream; both produce valid floats.
    expect(child.next()).toBeGreaterThanOrEqual(0)
    expect(child.next()).toBeLessThan(1)
  })

  it('fork is deterministic given the same parent history', () => {
    const a = createRng('p')
    const b = createRng('p')
    const fa = a.fork()
    const fb = b.fork()
    expect(fa.next()).toBe(fb.next())
  })

  it('advancing the parent before forking changes the child stream', () => {
    const a = createRng('p')
    const b = createRng('p')
    b.next()                         // advance parent b once before forking
    const fa = a.fork()
    const fb = b.fork()
    expect(fa.next()).not.toBe(fb.next())
  })
})
