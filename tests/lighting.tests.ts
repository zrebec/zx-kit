import { describe, it, expect, vi } from 'vitest'
import {
  ditherBlack,
  brightnessAt,
  createDarknessLayer,
  renderDarkness,
  type Light,
} from '../src/lighting.js'

// ── ditherBlack — the ordered-dither rule ──────────────────────────────────────

describe('ditherBlack', () => {
  it('amount 0 is never black (fully lit)', () => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      expect(ditherBlack(x, y, 0)).toBe(false)
    }
  })

  it('amount 1 is always black (pitch dark)', () => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      expect(ditherBlack(x, y, 1)).toBe(true)
    }
  })

  it('tiles on an 8×8 grid (pattern repeats every 4px)', () => {
    expect(ditherBlack(0, 0, 0.5)).toBe(ditherBlack(4, 4, 0.5))
    expect(ditherBlack(1, 2, 0.5)).toBe(ditherBlack(5, 6, 0.5))
  })

  it('denser at higher amounts (monotonic per pixel)', () => {
    // The darkest Bayer slot (value 0) goes black first; the brightest (15) last.
    expect(ditherBlack(0, 0, 0.1)).toBe(true)   // slot 0 → (0+0.5)/16 ≈ 0.03 < 0.1
    expect(ditherBlack(2, 0, 0.1)).toBe(false)  // slot 2 → 0.156, not yet
    expect(ditherBlack(2, 0, 0.2)).toBe(true)
  })
})

// ── brightnessAt — light attenuation ───────────────────────────────────────────

describe('brightnessAt', () => {
  const lights: Light[] = [{ x: 100, y: 100, radius: 50, intensity: 1 }]

  it('is full intensity at the light centre', () => {
    expect(brightnessAt(100, 100, lights)).toBe(1)
  })

  it('falls off linearly to 0 at the radius edge', () => {
    expect(brightnessAt(125, 100, lights)).toBeCloseTo(0.5, 5) // halfway
    expect(brightnessAt(160, 100, lights)).toBe(0)             // beyond radius
  })

  it('scales with intensity', () => {
    expect(brightnessAt(100, 100, [{ x: 100, y: 100, radius: 50, intensity: 0.4 }])).toBeCloseTo(0.4, 5)
  })

  it('takes the brightest of several lights', () => {
    const two: Light[] = [
      { x: 0, y: 0, radius: 40, intensity: 0.3 },
      { x: 0, y: 0, radius: 40, intensity: 0.9 },
    ]
    expect(brightnessAt(0, 0, two)).toBeCloseTo(0.9, 5)
  })

  it('ignores zero/negative-radius lights and returns 0 with none', () => {
    expect(brightnessAt(0, 0, [{ x: 0, y: 0, radius: 0, intensity: 1 }])).toBe(0)
    expect(brightnessAt(0, 0, [])).toBe(0)
  })
})

// ── createDarknessLayer ─────────────────────────────────────────────────────────

describe('createDarknessLayer', () => {
  it('derives cols/rows from the view size (8px cells)', () => {
    const layer = createDarknessLayer(256, 192)
    expect(layer.cols).toBe(32)
    expect(layer.rows).toBe(24)
    expect(layer.cellLevel).toHaveLength(32 * 24)
  })

  it('starts every cell at -1 (forces the first repaint)', () => {
    const layer = createDarknessLayer(16, 16, 4)
    expect([...layer.cellLevel].every((v) => v === -1)).toBe(true)
    expect(layer.tiles).toHaveLength(4)
  })

  it('throws on fewer than 2 levels', () => {
    expect(() => createDarknessLayer(16, 16, 1)).toThrow(/levels/)
  })
})

// ── renderDarkness — quantisation + dirty-cell tracking ─────────────────────────

describe('renderDarkness', () => {
  function mockCtx() {
    return { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D
  }

  it('quantises darkness to the nearest level and caches it per cell', () => {
    const layer = createDarknessLayer(16, 16, 5) // 2×2 cells, levels 0..4
    renderDarkness(layer, mockCtx(), () => 1)
    expect([...layer.cellLevel]).toEqual([4, 4, 4, 4]) // 1 → round(1*4)=4

    renderDarkness(layer, mockCtx(), () => 0)
    expect([...layer.cellLevel]).toEqual([0, 0, 0, 0]) // 0 → lit

    renderDarkness(layer, mockCtx(), () => 0.5)
    expect([...layer.cellLevel]).toEqual([2, 2, 2, 2]) // 0.5 → round(2)=2
  })

  it('clamps out-of-range darkness', () => {
    const layer = createDarknessLayer(8, 8, 5) // 1×1 cell
    renderDarkness(layer, mockCtx(), () => 5)
    expect(layer.cellLevel[0]).toBe(4)
    renderDarkness(layer, mockCtx(), () => -2)
    expect(layer.cellLevel[0]).toBe(0)
  })

  it('blits the buffer once per frame (when a canvas buffer exists)', () => {
    const layer = createDarknessLayer(16, 16, 4)
    const ctx = mockCtx()
    expect(() => renderDarkness(layer, ctx, () => 1)).not.toThrow()
    // Browser: one blit of the buffer. Headless (no document): nothing to blit.
    const expected = layer.buffer ? 1 : 0
    expect((ctx.drawImage as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(expected)
  })
})
