import { describe, it, expect } from 'vitest'
import {
  createCamera, setCameraTarget, tickCamera, worldToScreen, isInView,
} from '../src/camera.js'

// ── createCamera ──────────────────────────────────────────────────────────────

describe('createCamera', () => {
  it('starts at origin (0,0)', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 1024, worldH: 768 })
    expect(c.x).toBe(0)
    expect(c.y).toBe(0)
  })

  it('stores viewport and world dimensions', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 1024, worldH: 768 })
    expect(c.viewW).toBe(256)
    expect(c.viewH).toBe(192)
    expect(c.worldW).toBe(1024)
    expect(c.worldH).toBe(768)
  })

  it('defaults lerp to 1 (instant snap)', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 1024, worldH: 768 })
    expect(c.lerp).toBe(1)
  })

  it('defaults deadzone to 0', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 1024, worldH: 768 })
    expect(c.deadzoneW).toBe(0)
    expect(c.deadzoneH).toBe(0)
  })

  it('accepts custom lerp and deadzone', () => {
    const c = createCamera({
      viewW: 256, viewH: 192, worldW: 1024, worldH: 768,
      lerp: 0.1, deadzoneW: 64, deadzoneH: 48,
    })
    expect(c.lerp).toBe(0.1)
    expect(c.deadzoneW).toBe(64)
    expect(c.deadzoneH).toBe(48)
  })
})

// ── tickCamera: snap (lerp = 1) ───────────────────────────────────────────────

describe('tickCamera — snap (lerp=1)', () => {
  it('centers on target after one tick with no deadzone', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 1024, worldH: 768, lerp: 1 })
    setCameraTarget(c, 500, 400)
    tickCamera(c, 16.67)
    expect(c.x).toBeCloseTo(500 - 128) // target.x - viewW/2 = 372
    expect(c.y).toBeCloseTo(400 - 96)  // target.y - viewH/2 = 304
  })

  it('clamps to left edge when target near origin', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 1024, worldH: 768, lerp: 1 })
    setCameraTarget(c, 50, 400)
    tickCamera(c, 16.67)
    expect(c.x).toBe(0)
  })

  it('clamps to top edge when target near top', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 1024, worldH: 768, lerp: 1 })
    setCameraTarget(c, 500, 50)
    tickCamera(c, 16.67)
    expect(c.y).toBe(0)
  })

  it('clamps to right edge when target near world right', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 1024, worldH: 768, lerp: 1 })
    setCameraTarget(c, 1000, 400)
    tickCamera(c, 16.67)
    expect(c.x).toBe(1024 - 256) // 768
  })

  it('clamps to bottom edge when target near world bottom', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 1024, worldH: 768, lerp: 1 })
    setCameraTarget(c, 500, 700)
    tickCamera(c, 16.67)
    expect(c.y).toBe(768 - 192) // 576
  })

  it('clamps to 0 when world smaller than viewport', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 100, worldH: 50, lerp: 1 })
    setCameraTarget(c, 50, 25)
    tickCamera(c, 16.67)
    expect(c.x).toBe(0)
    expect(c.y).toBe(0)
  })
})

// ── tickCamera: lerp smoothing ────────────────────────────────────────────────

describe('tickCamera — lerp smoothing', () => {
  it('covers ~lerp fraction of distance per 16.67ms with lerp=0.5', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 2000, worldH: 1000, lerp: 0.5 })
    c.x = 500
    // Desired x = 600 → target.x = 600 + viewW/2 = 728
    setCameraTarget(c, 728, 96)
    tickCamera(c, 16.67)
    // From 500 toward 600 by half = 550
    expect(c.x).toBeCloseTo(550, 1)
  })

  it('approaches target asymptotically across many ticks', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 2000, worldH: 1000, lerp: 0.5 })
    c.x = 0
    setCameraTarget(c, 1000, 100) // desired = 1000 - 128 = 872
    for (let i = 0; i < 50; i++) tickCamera(c, 16.67)
    expect(c.x).toBeCloseTo(872, 0)
  })

  it('produces same result for one 33.34ms tick as two 16.67ms ticks (dt-independent)', () => {
    const a = createCamera({ viewW: 256, viewH: 192, worldW: 2000, worldH: 1000, lerp: 0.5 })
    a.x = 0
    setCameraTarget(a, 1000, 100)
    tickCamera(a, 16.67)
    tickCamera(a, 16.67)

    const b = createCamera({ viewW: 256, viewH: 192, worldW: 2000, worldH: 1000, lerp: 0.5 })
    b.x = 0
    setCameraTarget(b, 1000, 100)
    tickCamera(b, 33.34)

    expect(b.x).toBeCloseTo(a.x, 1)
  })

  it('does nothing on dt=0', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 2000, worldH: 1000, lerp: 0.5 })
    c.x = 100
    setCameraTarget(c, 1000, 100)
    tickCamera(c, 0)
    expect(c.x).toBe(100)
  })
})

// ── tickCamera: deadzone ──────────────────────────────────────────────────────

describe('tickCamera — deadzone', () => {
  it('stays still while target is at viewport center', () => {
    const c = createCamera({
      viewW: 256, viewH: 192, worldW: 2000, worldH: 1000,
      lerp: 1, deadzoneW: 64, deadzoneH: 64,
    })
    c.x = 372
    c.y = 304
    setCameraTarget(c, 500, 400) // exact center
    tickCamera(c, 16.67)
    expect(c.x).toBeCloseTo(372)
    expect(c.y).toBeCloseTo(304)
  })

  it('shifts horizontally by the amount target exits right edge of deadzone', () => {
    const c = createCamera({
      viewW: 256, viewH: 192, worldW: 2000, worldH: 1000,
      lerp: 1, deadzoneW: 64, deadzoneH: 0,
    })
    c.x = 372
    c.y = 0
    // Viewport center = 500. Right deadzone edge = 500 + 32 = 532.
    // Target at 542 = 10 past edge → camera shifts right by 10.
    setCameraTarget(c, 542, 96)
    tickCamera(c, 16.67)
    expect(c.x).toBeCloseTo(382)
  })

  it('shifts horizontally by the amount target exits left edge of deadzone', () => {
    const c = createCamera({
      viewW: 256, viewH: 192, worldW: 2000, worldH: 1000,
      lerp: 1, deadzoneW: 64, deadzoneH: 0,
    })
    c.x = 372
    // Viewport center = 500. Left deadzone edge = 500 - 32 = 468.
    // Target at 458 = 10 before edge → camera shifts left by 10.
    setCameraTarget(c, 458, 96)
    tickCamera(c, 16.67)
    expect(c.x).toBeCloseTo(362)
  })

  it('does not move when small target movement stays within deadzone', () => {
    const c = createCamera({
      viewW: 256, viewH: 192, worldW: 2000, worldH: 1000,
      lerp: 1, deadzoneW: 64, deadzoneH: 0,
    })
    c.x = 372
    setCameraTarget(c, 500, 96)
    tickCamera(c, 16.67)
    const startX = c.x
    setCameraTarget(c, 510, 96) // 10px right, within deadzone (32px allowance)
    tickCamera(c, 16.67)
    expect(c.x).toBeCloseTo(startX)
  })
})

// ── worldToScreen ─────────────────────────────────────────────────────────────

describe('worldToScreen', () => {
  it('returns identity when camera at origin', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 1024, worldH: 768 })
    expect(worldToScreen(c, 100, 50)).toEqual({ x: 100, y: 50 })
  })

  it('subtracts camera position from world coords', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 1024, worldH: 768 })
    c.x = 200
    c.y = 100
    expect(worldToScreen(c, 300, 150)).toEqual({ x: 100, y: 50 })
  })

  it('returns negative coords for points off-screen to the left', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 1024, worldH: 768 })
    c.x = 200
    expect(worldToScreen(c, 150, 0).x).toBe(-50)
  })
})

// ── isInView ──────────────────────────────────────────────────────────────────

describe('isInView', () => {
  it('returns true for point inside viewport', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 1024, worldH: 768 })
    c.x = 100
    c.y = 50
    expect(isInView(c, 200, 100)).toBe(true)
  })

  it('returns false for point left of viewport', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 1024, worldH: 768 })
    c.x = 100
    expect(isInView(c, 50, 60)).toBe(false)
  })

  it('returns false for point right of viewport', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 1024, worldH: 768 })
    c.x = 100
    expect(isInView(c, 400, 60)).toBe(false)
  })

  it('returns true when rectangle partially overlaps viewport right edge', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 1024, worldH: 768 })
    c.x = 100
    c.y = 0
    // Viewport spans x=100..356; rect (350,50,16,16) overlaps right edge
    expect(isInView(c, 350, 50, 16, 16)).toBe(true)
  })

  it('returns false when rectangle fully outside viewport', () => {
    const c = createCamera({ viewW: 256, viewH: 192, worldW: 1024, worldH: 768 })
    c.x = 100
    c.y = 0
    expect(isInView(c, 400, 50, 16, 16)).toBe(false)
  })
})
