/**
 * @module rng
 *
 * **Seeded deterministic pseudo-random number generator.** Same seed → same
 * sequence, on every machine and every run — exactly what procedural world
 * generation needs ("the same seed must create the same world").
 *
 * Built on **mulberry32**: a fast, allocation-free 32-bit generator with good
 * statistical quality for games. It is *not* cryptographically secure — never
 * use it for security tokens.
 *
 * @example
 * ```ts
 * const rng = createRng('cave-level-7')   // string or number seed
 * rng.next()              // float in [0, 1)
 * rng.int(8)              // int in [0, 8)
 * rng.range(2, 6)         // int in [2, 6)
 * rng.float(0.5, 1.5)     // float in [0.5, 1.5)
 * rng.chance(0.25)        // true ~25% of the time
 * rng.pick(['a','b','c']) // one element
 * rng.shuffle([1,2,3,4])  // in-place Fisher–Yates
 * rng.shuffleCopy(DECK)    // shuffled copy; DECK untouched (accepts readonly)
 *
 * const branch = rng.fork()  // independent deterministic sub-stream
 * ```
 */

/**
 * A seeded random source. All methods advance the same internal stream, so the
 * order of calls is part of the determinism contract — call them in the same
 * order to reproduce a world.
 */
export interface Rng {
  /** Next float in `[0, 1)`. */
  next(): number
  /** Next integer in `[0, maxExclusive)`. Throws when `maxExclusive` is not a positive integer. */
  int(maxExclusive: number): number
  /** Next integer in `[minInclusive, maxExclusive)`. Throws when `maxExclusive <= minInclusive` or bounds are non-integer. */
  range(minInclusive: number, maxExclusive: number): number
  /** Next float in `[min, max)`. Throws when `max < min`. */
  float(min: number, max: number): number
  /** `true` with probability `p` (0–1). Throws when `p` is outside `[0, 1]`. */
  chance(p: number): boolean
  /** Returns a random element of `items`. Throws when `items` is empty. */
  pick<T>(items: readonly T[]): T
  /** Shuffles `items` in place (Fisher–Yates) and returns the same array. */
  shuffle<T>(items: T[]): T[]
  /**
   * Returns a shuffled **copy**; `items` is left untouched. Accepts `readonly`
   * arrays, so a `const` content table (playlist, level list, loot table) can be
   * shuffled directly — `shuffle` cannot take one, and copying by hand is easy to
   * forget. Forgetting is the dangerous case: shuffling a shared table in place
   * silently reorders it for every later reader, and under a seeded stream that
   * corruption is deterministic, so it reproduces instead of looking like a bug.
   */
  shuffleCopy<T>(items: readonly T[]): T[]
  /** Derives an independent generator seeded from this stream (advances this stream by one step). */
  fork(): Rng
}

/**
 * Hashes a string to an unsigned 32-bit integer using FNV-1a.
 * Deterministic and dependency-free — used internally to turn string seeds
 * into numeric state, but exported because it is handy for keying sub-streams.
 *
 * @example
 * hashSeed('room:3')   // → stable uint32
 */
export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Creates a seeded {@link Rng}. The seed may be a string (hashed via
 * {@link hashSeed}) or a finite number (coerced to uint32).
 *
 * @param seed - String or finite number. Throws on a non-finite number.
 *
 * @example
 * const a = createRng('alpha')
 * const b = createRng('alpha')
 * a.next() === b.next()   // → true (deterministic)
 */
export function createRng(seed: number | string): Rng {
  let state: number
  if (typeof seed === 'string') {
    state = hashSeed(seed)
  } else {
    if (!Number.isFinite(seed)) {
      throw new Error(`createRng: numeric seed must be finite, got ${seed}`)
    }
    state = seed >>> 0
  }

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const rng: Rng = {
    next,

    int(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new Error(`Rng.int: maxExclusive must be a positive integer, got ${maxExclusive}`)
      }
      return Math.floor(next() * maxExclusive)
    },

    range(minInclusive: number, maxExclusive: number): number {
      if (!Number.isInteger(minInclusive) || !Number.isInteger(maxExclusive)) {
        throw new Error(`Rng.range: bounds must be integers, got [${minInclusive}, ${maxExclusive})`)
      }
      if (maxExclusive <= minInclusive) {
        throw new Error(`Rng.range: maxExclusive must be greater than minInclusive, got [${minInclusive}, ${maxExclusive})`)
      }
      return minInclusive + Math.floor(next() * (maxExclusive - minInclusive))
    },

    float(min: number, max: number): number {
      if (max < min) {
        throw new Error(`Rng.float: max must be >= min, got [${min}, ${max})`)
      }
      return min + next() * (max - min)
    },

    chance(p: number): boolean {
      if (p < 0 || p > 1) {
        throw new Error(`Rng.chance: probability must be in [0, 1], got ${p}`)
      }
      return next() < p
    },

    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error('Rng.pick: cannot pick from an empty array')
      }
      return items[Math.floor(next() * items.length)]!
    },

    shuffle<T>(items: T[]): T[] {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        const tmp = items[i]!
        items[i] = items[j]!
        items[j] = tmp
      }
      return items
    },

    shuffleCopy<T>(items: readonly T[]): T[] {
      return rng.shuffle([...items])
    },

    fork(): Rng {
      return createRng((next() * 4294967296) >>> 0)
    },
  }

  return rng
}
