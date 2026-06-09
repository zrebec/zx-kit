import { describe, it, expect } from 'vitest'
import { C, CELL } from '../src/palette.js'
import {
  blinkVisible, drawBlinkingText, drawTapeStripes, drawMenuOptions,
} from '../src/presentation.js'

// ── Mock canvas context (records fillStyle + fillRect, like tests/ui.tests.ts) ──

type FillCall = { style: string; x: number; y: number; w: number; h: number }

function makeMockCtx() {
  let _fillStyle = ''
  const rects: FillCall[] = []
  return {
    get fillStyle() { return _fillStyle },
    set fillStyle(v: string) { _fillStyle = v },
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ style: _fillStyle, x, y, w, h })
    },
    _rects: rects,
  } as unknown as CanvasRenderingContext2D & { _rects: FillCall[] }
}

// ── blinkVisible (pure) ─────────────────────────────────────────────────────────

describe('blinkVisible', () => {
  it('is on for the first half-cycle, off for the second', () => {
    expect(blinkVisible(0, 500)).toBe(true)
    expect(blinkVisible(499, 500)).toBe(true)
    expect(blinkVisible(500, 500)).toBe(false)
    expect(blinkVisible(999, 500)).toBe(false)
    expect(blinkVisible(1000, 500)).toBe(true)
  })

  it('respects a custom interval and defaults to 500ms', () => {
    expect(blinkVisible(0, 200)).toBe(true)
    expect(blinkVisible(200, 200)).toBe(false)
    expect(blinkVisible(400, 200)).toBe(true)
    expect(blinkVisible(0)).toBe(true) // default interval
  })
})

// ── drawBlinkingText ─────────────────────────────────────────────────────────────

describe('drawBlinkingText', () => {
  it('draws on the visible half, nothing on the hidden half', () => {
    const on = makeMockCtx()
    drawBlinkingText(on, 'PRESS', 0, 0, 0) // now=0 → visible
    expect(on._rects.length).toBeGreaterThan(0)

    const off = makeMockCtx()
    drawBlinkingText(off, 'PRESS', 0, 0, 500) // now=500 → hidden
    expect(off._rects.length).toBe(0)
  })
})

// ── drawTapeStripes ──────────────────────────────────────────────────────────────

describe('drawTapeStripes', () => {
  it('full mode stripes the whole width, cycling colours', () => {
    const ctx = makeMockCtx()
    drawTapeStripes(ctx, 0, { width: 32, height: 16, stripeHeight: 2, side: 'full' })
    expect(ctx._rects).toHaveLength(8) // 16 / 2
    expect(ctx._rects.every((r) => r.x === 0 && r.w === 32)).toBe(true)
    expect(new Set(ctx._rects.map((r) => r.style)).size).toBeGreaterThanOrEqual(2) // red/cyan
  })

  it('border mode insets the middle rows to two band-wide strips', () => {
    const ctx = makeMockCtx()
    drawTapeStripes(ctx, 0, { width: 32, height: 32, stripeHeight: 2, side: 'border', band: 4 })
    const mid = ctx._rects.filter((r) => r.y === 16) // a clearly-middle row
    expect(mid).toHaveLength(2)
    expect(mid.every((r) => r.w === 4)).toBe(true)
    expect(mid.some((r) => r.x === 0) && mid.some((r) => r.x === 32 - 4)).toBe(true)
  })

  it('animates: a later time shifts which colour lands on a row', () => {
    // speed 1000 px/s → offset = now(ms)/1000 * 1000 = now px; now=2 → a 1-stripe shift.
    const a = makeMockCtx(); drawTapeStripes(a, 0, { width: 8, height: 8, stripeHeight: 2, speed: 1000 })
    const b = makeMockCtx(); drawTapeStripes(b, 2, { width: 8, height: 8, stripeHeight: 2, speed: 1000 })
    expect(a._rects.map((r) => r.style)).not.toEqual(b._rects.map((r) => r.style))
  })

  it('no colours (or zero stripe height) → no draw', () => {
    const ctx = makeMockCtx()
    drawTapeStripes(ctx, 0, { colors: [] })
    drawTapeStripes(ctx, 0, { stripeHeight: 0 })
    expect(ctx._rects).toHaveLength(0)
  })
})

// ── drawMenuOptions ──────────────────────────────────────────────────────────────

describe('drawMenuOptions', () => {
  it('draws every option; the selected one uses selectedInk, others use ink', () => {
    const ctx = makeMockCtx()
    drawMenuOptions(ctx, ['START', 'OPTIONS'], 0, CELL, CELL, { ink: C.WHITE, selectedInk: C.B_YELLOW })
    const styles = new Set(ctx._rects.map((r) => r.style))
    expect(styles.has(C.B_YELLOW)).toBe(true) // the selected option
    expect(styles.has(C.WHITE)).toBe(true)    // the unselected option
  })

  it('stacks options downward by the line height', () => {
    const ctx = makeMockCtx()
    drawMenuOptions(ctx, ['A', 'B'], 1, 0, 0, { gap: 2 })
    const ys = ctx._rects.map((r) => r.y)
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0)      // first row at/after y=0
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(CELL + 2) // second row pushed down a line
  })
})
