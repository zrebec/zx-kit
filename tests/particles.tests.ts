import { describe, it, expect, vi } from 'vitest'
import { C } from '../src/palette.js'
import {
  createParticleSystem,
  emitParticles,
  tickParticles,
  renderParticles,
  clearParticles,
} from '../src/particles.js'

// ── Mock canvas context (records fillRect calls) ──────────────────────────────

type FillCall = { style: string; x: number; y: number; w: number; h: number }

function makeMockCtx() {
  let _fillStyle = ''
  const rects: FillCall[] = []
  const ctx = {
    get fillStyle() { return _fillStyle },
    set fillStyle(v: string) { _fillStyle = v },
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ style: _fillStyle, x, y, w, h })
    },
    _rects: rects,
  } as unknown as CanvasRenderingContext2D & { _rects: FillCall[] }
  return ctx
}

/** Deterministic rng returning queued values, then repeating the last. */
function seq(...vals: number[]): () => number {
  let i = 0
  return () => (i < vals.length ? vals[i++]! : vals[vals.length - 1]!)
}

// ── createParticleSystem ──────────────────────────────────────────────────────

describe('createParticleSystem', () => {
  it('creates a pool of the requested capacity', () => {
    const ps = createParticleSystem(16)
    expect(ps.capacity).toBe(16)
    expect(ps.particles).toHaveLength(16)
  })

  it('all slots start inactive with activeCount 0', () => {
    const ps = createParticleSystem(8)
    expect(ps.activeCount).toBe(0)
    expect(ps.particles.every(p => !p.active)).toBe(true)
  })

  it('throws on zero capacity', () => {
    expect(() => createParticleSystem(0)).toThrow(/positive integer/)
  })

  it('throws on negative capacity', () => {
    expect(() => createParticleSystem(-4)).toThrow(/positive integer/)
  })

  it('throws on non-integer capacity', () => {
    expect(() => createParticleSystem(3.5)).toThrow(/positive integer/)
  })
})

// ── emitParticles — counts & pool limits ──────────────────────────────────────

describe('emitParticles — counts', () => {
  it('emits the requested count when the pool has room', () => {
    const ps = createParticleSystem(16)
    const n = emitParticles(ps, { x: 0, y: 0, count: 5, color: C.B_WHITE })
    expect(n).toBe(5)
    expect(ps.activeCount).toBe(5)
  })

  it('count 0 emits nothing and does not change activeCount', () => {
    const ps = createParticleSystem(16)
    expect(emitParticles(ps, { x: 0, y: 0, count: 0, color: C.B_WHITE })).toBe(0)
    expect(ps.activeCount).toBe(0)
  })

  it('clamps to free slots when the pool is full (returns fewer)', () => {
    const ps = createParticleSystem(2)
    const n = emitParticles(ps, { x: 0, y: 0, count: 5, color: C.B_WHITE })
    expect(n).toBe(2)
    expect(ps.activeCount).toBe(2)
  })

  it('reuses freed slots and scans past still-active ones', () => {
    const ps = createParticleSystem(3)
    emitParticles(ps, { x: 0, y: 0, count: 2, color: C.B_WHITE })  // slots 0,1
    const n = emitParticles(ps, { x: 0, y: 0, count: 2, color: C.B_WHITE }) // slot 2, then full
    expect(n).toBe(1)
    expect(ps.activeCount).toBe(3)
  })

  it('throws on negative count', () => {
    const ps = createParticleSystem(4)
    expect(() => emitParticles(ps, { x: 0, y: 0, count: -1, color: C.B_WHITE })).toThrow(/non-negative integer/)
  })

  it('throws on non-integer count', () => {
    const ps = createParticleSystem(4)
    expect(() => emitParticles(ps, { x: 0, y: 0, count: 1.5, color: C.B_WHITE })).toThrow(/non-negative integer/)
  })
})

// ── emitParticles — option resolution (branches) ──────────────────────────────

describe('emitParticles — option resolution', () => {
  it('default speed/life/size applied when omitted', () => {
    const ps = createParticleSystem(1)
    // rng=0 → dir jitter 0 (spread default 0), color index 0
    emitParticles(ps, { x: 10, y: 20, count: 1, color: C.B_RED, angle: 0, rng: () => 0 })
    const p = ps.particles[0]!
    expect(p.size).toBe(1)               // default size
    expect(p.maxLife).toBe(300)          // default life
    expect(p.x).toBe(10)
    expect(p.y).toBe(20)
    // default speed 0.03, angle 0 → vx = 0.03, vy = 0
    expect(p.vx).toBeCloseTo(0.03, 5)
    expect(p.vy).toBeCloseTo(0, 5)
  })

  it('scalar speed and scalar life are used verbatim', () => {
    const ps = createParticleSystem(1)
    emitParticles(ps, { x: 0, y: 0, count: 1, color: C.B_RED, speed: 0.1, life: 500, angle: 0, rng: () => 0 })
    const p = ps.particles[0]!
    expect(p.vx).toBeCloseTo(0.1, 5)
    expect(p.maxLife).toBe(500)
  })

  it('ranged speed and ranged life sample within bounds', () => {
    const ps = createParticleSystem(1)
    // rng sequence: speed sample (0.5), life sample (0.5), dir (0.5 → no jitter since spread 0), color (0)
    emitParticles(ps, {
      x: 0, y: 0, count: 1, color: C.B_RED,
      speed: [0.02, 0.06], life: [200, 400], angle: 0, rng: seq(0.5, 0.5, 0.5, 0),
    })
    const p = ps.particles[0]!
    expect(p.vx).toBeCloseTo(0.04, 5)    // midpoint speed
    expect(p.maxLife).toBeCloseTo(300, 5) // midpoint life
  })

  it('single colour is used for every particle', () => {
    const ps = createParticleSystem(3)
    emitParticles(ps, { x: 0, y: 0, count: 3, color: C.B_CYAN, rng: () => 0 })
    for (let i = 0; i < 3; i++) expect(ps.particles[i]!.color).toBe(C.B_CYAN)
  })

  it('colour array picks index 0 with rng→0', () => {
    const ps = createParticleSystem(1)
    emitParticles(ps, { x: 0, y: 0, count: 1, color: [C.B_RED, C.B_GREEN], spread: 0, rng: () => 0 })
    expect(ps.particles[0]!.color).toBe(C.B_RED)
  })

  it('colour array picks a later index with higher rng', () => {
    const ps = createParticleSystem(1)
    // spread 0 → dir rand value irrelevant; rng 0.9 → color index floor(0.9*2)=1
    emitParticles(ps, { x: 0, y: 0, count: 1, color: [C.B_RED, C.B_GREEN], spread: 0, rng: () => 0.9 })
    expect(ps.particles[0]!.color).toBe(C.B_GREEN)
  })

  it('spread jitters the direction (rng=0 → angle - spread/2)', () => {
    const ps = createParticleSystem(1)
    // angle 0, spread π, rng 0 → dir = -π/2 → vx≈0, vy≈-speed
    emitParticles(ps, { x: 0, y: 0, count: 1, color: C.B_RED, speed: 0.05, angle: 0, spread: Math.PI, rng: () => 0 })
    const p = ps.particles[0]!
    expect(p.vx).toBeCloseTo(0, 5)
    expect(p.vy).toBeCloseTo(-0.05, 5)
  })

  it('custom size is stored', () => {
    const ps = createParticleSystem(1)
    emitParticles(ps, { x: 0, y: 0, count: 1, color: C.B_RED, size: 2, rng: () => 0 })
    expect(ps.particles[0]!.size).toBe(2)
  })

  it('uses Math.random when no rng is supplied (smoke)', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const ps = createParticleSystem(1)
    emitParticles(ps, { x: 0, y: 0, count: 1, color: C.B_RED })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── tickParticles ─────────────────────────────────────────────────────────────

describe('tickParticles', () => {
  it('integrates position by velocity * dt', () => {
    const ps = createParticleSystem(1)
    emitParticles(ps, { x: 0, y: 0, count: 1, color: C.B_RED, speed: 0.1, life: 1000, angle: 0, rng: () => 0 })
    tickParticles(ps, 10)               // vx=0.1 → x += 1
    expect(ps.particles[0]!.x).toBeCloseTo(1, 5)
  })

  it('applies gravity to vertical velocity', () => {
    const ps = createParticleSystem(1)
    emitParticles(ps, { x: 0, y: 0, count: 1, color: C.B_RED, speed: 0, life: 1000, angle: 0, rng: () => 0 })
    tickParticles(ps, 10, 0.001)        // vy += 0.001*10 = 0.01
    expect(ps.particles[0]!.vy).toBeCloseTo(0.01, 5)
  })

  it('default gravity is 0 (vy unchanged when speed 0)', () => {
    const ps = createParticleSystem(1)
    emitParticles(ps, { x: 0, y: 0, count: 1, color: C.B_RED, speed: 0, life: 1000, angle: 0, rng: () => 0 })
    tickParticles(ps, 16)
    expect(ps.particles[0]!.vy).toBeCloseTo(0, 5)
  })

  it('decrements life and deactivates expired particles', () => {
    const ps = createParticleSystem(1)
    emitParticles(ps, { x: 0, y: 0, count: 1, color: C.B_RED, life: 100, rng: () => 0 })
    tickParticles(ps, 100)              // life 100 - 100 = 0 → expire
    expect(ps.particles[0]!.active).toBe(false)
    expect(ps.activeCount).toBe(0)
  })

  it('keeps particles alive while life remains', () => {
    const ps = createParticleSystem(1)
    emitParticles(ps, { x: 0, y: 0, count: 1, color: C.B_RED, life: 100, rng: () => 0 })
    tickParticles(ps, 50)
    expect(ps.particles[0]!.active).toBe(true)
    expect(ps.activeCount).toBe(1)
  })

  it('skips inactive slots (no movement)', () => {
    const ps = createParticleSystem(2)
    emitParticles(ps, { x: 5, y: 5, count: 1, color: C.B_RED, speed: 0, life: 1000, rng: () => 0 })
    // slot 1 inactive — its x should stay 0 after tick
    tickParticles(ps, 16, 0.01)
    expect(ps.particles[1]!.x).toBe(0)
    expect(ps.particles[1]!.vy).toBe(0)
  })
})

// ── renderParticles ───────────────────────────────────────────────────────────

describe('renderParticles', () => {
  it('draws one fillRect per active particle with its colour and size', () => {
    const ctx = makeMockCtx()
    const ps = createParticleSystem(4)
    emitParticles(ps, { x: 3, y: 4, count: 2, color: C.B_YELLOW, size: 2, rng: () => 0 })
    renderParticles(ctx, ps)
    expect(ctx._rects).toHaveLength(2)
    for (const r of ctx._rects) {
      expect(r.style).toBe(C.B_YELLOW)
      expect(r).toMatchObject({ x: 3, y: 4, w: 2, h: 2 })
    }
  })

  it('rounds world coordinates to whole pixels', () => {
    const ctx = makeMockCtx()
    const ps = createParticleSystem(1)
    emitParticles(ps, { x: 0, y: 0, count: 1, color: C.B_WHITE, speed: 0.1, life: 1000, angle: 0, rng: () => 0 })
    tickParticles(ps, 7)                // x = 0.7 → rounds to 1
    renderParticles(ctx, ps)
    expect(ctx._rects[0]!.x).toBe(1)
  })

  it('subtracts camera offsets (world → screen)', () => {
    const ctx = makeMockCtx()
    const ps = createParticleSystem(1)
    emitParticles(ps, { x: 100, y: 50, count: 1, color: C.B_WHITE, rng: () => 0 })
    renderParticles(ctx, ps, 40, 10)
    expect(ctx._rects[0]).toMatchObject({ x: 60, y: 40 })
  })

  it('default offsets are 0 (world == screen)', () => {
    const ctx = makeMockCtx()
    const ps = createParticleSystem(1)
    emitParticles(ps, { x: 12, y: 8, count: 1, color: C.B_WHITE, rng: () => 0 })
    renderParticles(ctx, ps)
    expect(ctx._rects[0]).toMatchObject({ x: 12, y: 8 })
  })

  it('does not draw inactive (expired) particles', () => {
    const ctx = makeMockCtx()
    const ps = createParticleSystem(2)
    emitParticles(ps, { x: 0, y: 0, count: 1, color: C.B_WHITE, life: 50, rng: () => 0 })
    tickParticles(ps, 60)               // expire
    renderParticles(ctx, ps)
    expect(ctx._rects).toHaveLength(0)
  })
})

// ── clearParticles ────────────────────────────────────────────────────────────

describe('clearParticles', () => {
  it('deactivates all particles and resets activeCount', () => {
    const ps = createParticleSystem(8)
    emitParticles(ps, { x: 0, y: 0, count: 5, color: C.B_WHITE, rng: () => 0 })
    clearParticles(ps)
    expect(ps.activeCount).toBe(0)
    expect(ps.particles.every(p => !p.active)).toBe(true)
  })
})
