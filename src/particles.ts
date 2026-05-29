/**
 * @module particles
 *
 * **Allocation-free particle pool** for ZX-style pixel effects: carrot-shot
 * sparks, landing dust, an enemy curling into a puff, glowing motes around a
 * crystal. All particles live in a fixed-capacity pool created once at startup;
 * emitting and ticking never allocates, so it is safe to run every frame.
 *
 * Particles are plain coloured squares drawn in the {@link "palette" | Spectrum
 * palette}. For deterministic effects (replays, seeded worlds) pass an `rng`
 * function to {@link emitParticles}; otherwise it uses `Math.random`.
 *
 * @example
 * ```ts
 * const sparks = createParticleSystem(128)
 *
 * // On carrot impact:
 * emitParticles(sparks, {
 *   x: hit.x, y: hit.y, count: 12,
 *   color: [C.B_YELLOW, C.B_WHITE],
 *   speed: [0.02, 0.06], angle: -Math.PI / 2, spread: Math.PI,
 *   life: [200, 400], size: 1,
 * })
 *
 * // Each frame:
 * tickParticles(sparks, dt, 0.0004)            // gentle gravity
 * renderParticles(ctx, sparks, cam.x, cam.y)   // world → screen offset
 * ```
 */
import type { SpectrumColor } from './palette.js'

/** A single pooled particle. `active === false` slots are free for reuse. */
export interface Particle {
  /** World X in pixels. */
  x: number
  /** World Y in pixels. */
  y: number
  /** Horizontal velocity in pixels per millisecond. */
  vx: number
  /** Vertical velocity in pixels per millisecond. */
  vy: number
  /** Remaining lifetime in milliseconds. */
  life: number
  /** Lifetime the particle was spawned with (for fade math by the caller). */
  maxLife: number
  /** Particle colour (Spectrum palette value). */
  color: SpectrumColor
  /** Square side length in pixels (≥ 1). */
  size: number
  /** Whether this slot is alive and should be ticked/rendered. */
  active: boolean
}

/** A fixed-capacity particle pool. Create once with {@link createParticleSystem}. */
export interface ParticleSystem {
  /** Backing pool. Length always equals {@link ParticleSystem.capacity}. */
  readonly particles: Particle[]
  /** Maximum number of simultaneously-alive particles. */
  readonly capacity: number
  /** Number of currently-alive particles. */
  activeCount: number
}

/** A scalar value or an inclusive `[min, max]` range to sample uniformly. */
export type Ranged = number | readonly [number, number]

/** Options for a single {@link emitParticles} burst. */
export interface EmitOptions {
  /** Spawn X in world pixels. */
  x: number
  /** Spawn Y in world pixels. */
  y: number
  /** How many particles to emit (clamped to free pool slots). */
  count: number
  /** Colour, or a palette to pick from per particle. */
  color: SpectrumColor | readonly SpectrumColor[]
  /** Speed in px/ms — scalar or `[min, max]`. Default `0.03`. */
  speed?: Ranged
  /** Base emission direction in radians (0 = right, −π/2 = up). Default `0`. */
  angle?: number
  /** Angular jitter in radians, centred on `angle`. Default `0` (no spread). */
  spread?: number
  /** Lifetime in ms — scalar or `[min, max]`. Default `300`. */
  life?: Ranged
  /** Square size in pixels. Default `1`. */
  size?: number
  /** Random source for determinism. Default `Math.random`. */
  rng?: () => number
}

function makeParticle(): Particle {
  return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, color: '#000000' as SpectrumColor, size: 1, active: false }
}

/**
 * Creates a particle pool of fixed `capacity`. All slots start inactive.
 * Throws when `capacity` is not a positive integer.
 *
 * @example
 * const ps = createParticleSystem(256)
 */
export function createParticleSystem(capacity: number): ParticleSystem {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error(`createParticleSystem: capacity must be a positive integer, got ${capacity}`)
  }
  const particles: Particle[] = new Array(capacity)
  for (let i = 0; i < capacity; i++) particles[i] = makeParticle()
  return { particles, capacity, activeCount: 0 }
}

function sampleRanged(v: Ranged | undefined, fallback: number, rand: () => number): number {
  if (v === undefined) return fallback
  if (typeof v === 'number') return v
  return v[0] + rand() * (v[1] - v[0])
}

/**
 * Emits up to `opts.count` particles from the pool. Returns the number actually
 * emitted — fewer than requested when the pool has no free slots left.
 * Throws when `count` is negative or not an integer.
 *
 * @example
 * const n = emitParticles(ps, { x, y, count: 10, color: C.B_WHITE })
 */
export function emitParticles(ps: ParticleSystem, opts: EmitOptions): number {
  if (!Number.isInteger(opts.count) || opts.count < 0) {
    throw new Error(`emitParticles: count must be a non-negative integer, got ${opts.count}`)
  }
  const rand = opts.rng ?? Math.random
  const colors: readonly SpectrumColor[] = Array.isArray(opts.color)
    ? (opts.color as readonly SpectrumColor[])
    : [opts.color as SpectrumColor]
  const angle = opts.angle ?? 0
  const spread = opts.spread ?? 0
  const size = opts.size ?? 1

  const pool = ps.particles
  let emitted = 0
  let cursor = 0

  for (let n = 0; n < opts.count; n++) {
    // Find next free slot from where we left off.
    let slot = -1
    while (cursor < ps.capacity) {
      if (!pool[cursor]!.active) { slot = cursor; break }
      cursor++
    }
    if (slot === -1) break

    const speed = sampleRanged(opts.speed, 0.03, rand)
    const life = sampleRanged(opts.life, 300, rand)
    const dir = angle + (rand() - 0.5) * spread
    const p = pool[slot]!
    p.x = opts.x
    p.y = opts.y
    p.vx = Math.cos(dir) * speed
    p.vy = Math.sin(dir) * speed
    p.life = life
    p.maxLife = life
    p.color = colors[Math.floor(rand() * colors.length)]!
    p.size = size
    p.active = true

    emitted++
    cursor++
  }

  ps.activeCount += emitted
  return emitted
}

/**
 * Advances every active particle by `dtMs`, applying optional `gravity`
 * (px/ms²) to vertical velocity. Particles whose lifetime expires are
 * deactivated and returned to the pool.
 *
 * @param gravity - Downward acceleration in px/ms². Default `0` (no gravity).
 *
 * @example
 * tickParticles(ps, dt)            // floaty
 * tickParticles(ps, dt, 0.0006)   // falling sparks
 */
export function tickParticles(ps: ParticleSystem, dtMs: number, gravity = 0): void {
  const pool = ps.particles
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i]!
    if (!p.active) continue
    p.vy += gravity * dtMs
    p.x += p.vx * dtMs
    p.y += p.vy * dtMs
    p.life -= dtMs
    if (p.life <= 0) {
      p.active = false
      ps.activeCount--
    }
  }
}

/**
 * Draws every active particle as a filled square. Subtract camera world
 * position via `offsetX` / `offsetY` to convert world coords to screen coords.
 * Coordinates are rounded to whole pixels for a crisp ZX look.
 *
 * @example
 * renderParticles(ctx, ps)                 // world == screen
 * renderParticles(ctx, ps, cam.x, cam.y)   // scrolled world
 */
export function renderParticles(
  ctx: CanvasRenderingContext2D,
  ps: ParticleSystem,
  offsetX = 0,
  offsetY = 0,
): void {
  const pool = ps.particles
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i]!
    if (!p.active) continue
    ctx.fillStyle = p.color
    ctx.fillRect(Math.round(p.x - offsetX), Math.round(p.y - offsetY), p.size, p.size)
  }
}

/**
 * Deactivates all particles immediately (e.g. on room change).
 *
 * @example
 * clearParticles(ps)
 */
export function clearParticles(ps: ParticleSystem): void {
  const pool = ps.particles
  for (let i = 0; i < pool.length; i++) pool[i]!.active = false
  ps.activeCount = 0
}
