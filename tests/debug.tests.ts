import { describe, it, expect, vi } from 'vitest'
import {
  createDebugMonitor,
  beginFrame,
  endFrame,
  sampleDebug,
  drawDebugOverlay,
  type DebugInfo,
} from '../src/debug.js'

// ── Mock ctx (mirrors tests/renderer.tests.ts) ─────────────────────────────────

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
    save:    vi.fn(),
    restore: vi.fn(),
    canvas:  { width: 256, height: 192 },
    _rects:  rects,
  } as unknown as CanvasRenderingContext2D & { _rects: FillCall[] }
  return ctx
}

describe('createDebugMonitor', () => {
  it('uses sensible defaults', () => {
    const m = createDebugMonitor()
    expect(m.targetFps).toBe(60)
    expect(m.smoothing).toBe(0.1)
    expect(m.fps).toBe(0)
    expect(m.frameMs).toBe(0)
    expect(m.workMs).toBe(0)
    expect(m.lastTime).toBeNull()
  })

  it('accepts overrides', () => {
    const m = createDebugMonitor({ targetFps: 50, smoothing: 0.25 })
    expect(m.targetFps).toBe(50)
    expect(m.smoothing).toBe(0.25)
  })
})

describe('beginFrame', () => {
  it('first call records time but leaves fps at 0', () => {
    const m = createDebugMonitor()
    beginFrame(m, 0)
    expect(m.lastTime).toBe(0)
    expect(m.fps).toBe(0)
    expect(m.frameMs).toBe(0)
  })

  it('second call computes frameMs and primes fps directly', () => {
    const m = createDebugMonitor()
    beginFrame(m, 0)
    beginFrame(m, 16)
    expect(m.frameMs).toBe(16)
    expect(m.fps).toBeCloseTo(62.5, 5) // 1000 / 16
  })

  it('applies EMA smoothing on later frames', () => {
    const m = createDebugMonitor({ smoothing: 0.1 })
    beginFrame(m, 0)
    beginFrame(m, 16) // fps primed to 62.5
    beginFrame(m, 36) // dt 20 -> inst 50 -> 62.5 + 0.1*(50-62.5) = 61.25
    expect(m.fps).toBeCloseTo(61.25, 5)
  })

  it('guards against a zero delta (no NaN / Infinity)', () => {
    const m = createDebugMonitor()
    beginFrame(m, 5)
    beginFrame(m, 5)
    expect(m.frameMs).toBe(0)
    expect(Number.isFinite(m.fps)).toBe(true)
  })

  it('falls back to performance.now() when no timestamp is given', () => {
    const m = createDebugMonitor()
    beginFrame(m)
    expect(m.lastTime).not.toBeNull()
    expect(Number.isFinite(m.lastTime as number)).toBe(true)
  })
})

describe('endFrame', () => {
  it('measures work time from beginFrame', () => {
    const m = createDebugMonitor()
    beginFrame(m, 100)
    endFrame(m, 104)
    expect(m.workMs).toBe(4)
  })

  it('clamps a negative delta to 0', () => {
    const m = createDebugMonitor()
    beginFrame(m, 100)
    endFrame(m, 98)
    expect(m.workMs).toBe(0)
  })
})

describe('sampleDebug', () => {
  it('reports budget, cpu load, and custom fields', () => {
    const m = createDebugMonitor({ targetFps: 50 })
    beginFrame(m, 0)
    beginFrame(m, 20) // frameMs 20, fps 50
    endFrame(m, 30)   // workMs 10
    const info = sampleDebug(m, { mines: 9 })
    expect(info.budgetMs).toBeCloseTo(20, 5) // 1000 / 50
    expect(info.cpuLoad).toBeCloseTo(0.5, 5) // 10 / 20
    expect(info.frameMs).toBe(20)
    expect(info.custom).toEqual({ mines: 9 })
  })

  it('reports workMs and cpuLoad of 0 when endFrame is not called', () => {
    const m = createDebugMonitor()
    beginFrame(m, 0)
    beginFrame(m, 16)
    const info = sampleDebug(m)
    expect(info.workMs).toBe(0)
    expect(info.cpuLoad).toBe(0)
    expect(info.custom).toEqual({})
  })
})

describe('drawDebugOverlay', () => {
  const base: DebugInfo = { fps: 60, frameMs: 16, workMs: 0, budgetMs: 16.67, cpuLoad: 0, custom: {} }

  it('draws the fps line', () => {
    const ctx = makeMockCtx()
    drawDebugOverlay(ctx, base)
    expect(ctx._rects.length).toBeGreaterThan(0)
  })

  it('adds a CPU line only when work time was measured', () => {
    const a = makeMockCtx()
    const b = makeMockCtx()
    drawDebugOverlay(a, base) // workMs 0 -> no CPU line
    drawDebugOverlay(b, { ...base, workMs: 8, cpuLoad: 0.48 })
    expect(b._rects.length).toBeGreaterThan(a._rects.length)
  })

  it('renders custom fields as extra lines', () => {
    const a = makeMockCtx()
    const b = makeMockCtx()
    drawDebugOverlay(a, base)
    drawDebugOverlay(b, { ...base, custom: { mines: 12 } })
    expect(b._rects.length).toBeGreaterThan(a._rects.length)
  })
})
