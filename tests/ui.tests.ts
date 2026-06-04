import { describe, it, expect, beforeEach } from 'vitest'
import { C, CELL } from '../src/palette.js'
import {
  drawBox, drawFrame, drawPanelTitle,
  drawProgressBar, tickUI, renderUI, resetUI,
  drawDottedGrid, drawSegmentedBar, drawTank, drawDial, drawCompassText,
} from '../src/ui.js'

// ── Mock canvas context ───────────────────────────────────────────────────────

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
    _clear() { rects.length = 0 },
  } as unknown as CanvasRenderingContext2D & { _rects: FillCall[]; _clear(): void }
}

// ── drawBox ───────────────────────────────────────────────────────────────────

describe('drawBox — no border', () => {
  it('fills background with paper color', () => {
    const ctx = makeMockCtx()
    drawBox(ctx, { x: 4, y: 8, width: 32, height: 16, paper: C.BLACK })
    expect(ctx._rects[0]).toMatchObject({ style: C.BLACK, x: 4, y: 8, w: 32, h: 16 })
  })

  it('exactly 1 fillRect when no border', () => {
    const ctx = makeMockCtx()
    drawBox(ctx, { x: 0, y: 0, width: 24, height: 8, paper: C.CYAN })
    expect(ctx._rects).toHaveLength(1)
  })
})

describe('drawBox — solid border', () => {
  it('paper + 4 border fillRects = 5 total', () => {
    const ctx = makeMockCtx()
    drawBox(ctx, { x: 0, y: 0, width: 16, height: 8, paper: C.BLACK, ink: C.B_WHITE, border: { style: 'solid' } })
    expect(ctx._rects).toHaveLength(5)
  })

  it('border fillRects use ink color', () => {
    const ctx = makeMockCtx()
    drawBox(ctx, { x: 0, y: 0, width: 16, height: 8, paper: C.BLACK, ink: C.B_CYAN, border: {} })
    const borderCalls = ctx._rects.slice(1)
    for (const r of borderCalls) expect(r.style).toBe(C.B_CYAN)
  })

  it('border.color overrides ink color', () => {
    const ctx = makeMockCtx()
    drawBox(ctx, { x: 0, y: 0, width: 16, height: 8, paper: C.BLACK, ink: C.B_CYAN, border: { color: C.B_RED } })
    const borderCalls = ctx._rects.slice(1)
    for (const r of borderCalls) expect(r.style).toBe(C.B_RED)
  })

  it('border.enabled=false suppresses border', () => {
    const ctx = makeMockCtx()
    drawBox(ctx, { x: 0, y: 0, width: 16, height: 8, paper: C.BLACK, border: { enabled: false } })
    expect(ctx._rects).toHaveLength(1)
  })
})

describe('drawBox — dashed border', () => {
  it('dashed border produces more fillRects than solid (dash segments)', () => {
    const ctxSolid  = makeMockCtx()
    const ctxDashed = makeMockCtx()
    const opts = { x: 0, y: 0, width: 32, height: 16, paper: C.BLACK, ink: C.B_WHITE }
    drawBox(ctxSolid,  { ...opts, border: { style: 'solid' } })
    drawBox(ctxDashed, { ...opts, border: { style: 'dashed' } })
    expect(ctxDashed._rects.length).toBeGreaterThan(ctxSolid._rects.length)
  })

  it('dashed border uses the correct color', () => {
    const ctx = makeMockCtx()
    drawBox(ctx, { x: 0, y: 0, width: 16, height: 8, paper: C.BLACK, ink: C.B_YELLOW, border: { style: 'dashed' } })
    const borderCalls = ctx._rects.slice(1)
    for (const r of borderCalls) expect(r.style).toBe(C.B_YELLOW)
  })
})

// ── drawFrame ─────────────────────────────────────────────────────────────────

describe('drawFrame — no background fill', () => {
  it('draws only border fillRects (solid: exactly 4)', () => {
    const ctx = makeMockCtx()
    drawFrame(ctx, { x: 0, y: 0, width: 32, height: 16, color: C.B_CYAN })
    expect(ctx._rects).toHaveLength(4)
  })

  it('border fillRects use the frame color', () => {
    const ctx = makeMockCtx()
    drawFrame(ctx, { x: 0, y: 0, width: 16, height: 8, color: C.B_GREEN })
    for (const r of ctx._rects) expect(r.style).toBe(C.B_GREEN)
  })

  it('dashed drawFrame produces more than 4 fillRects', () => {
    const ctx = makeMockCtx()
    drawFrame(ctx, { x: 0, y: 0, width: 32, height: 16, color: C.B_CYAN, border: { style: 'dashed' } })
    expect(ctx._rects.length).toBeGreaterThan(4)
  })
})

// ── drawPanelTitle ─────────────────────────────────────────────────────────────

describe('drawPanelTitle — with paper', () => {
  it('first fillRect is paper strip with correct dimensions (height = CELL + padding*2)', () => {
    const ctx = makeMockCtx()
    drawPanelTitle(ctx, { text: 'A', x: 0, y: 0, ink: C.B_WHITE, paper: C.BLACK })
    // padding=2 (default), stripW = 1*CELL + 2*2 = 12, height = CELL + 4 = 12
    expect(ctx._rects[0]).toMatchObject({ style: C.BLACK, x: 0, y: 0, h: CELL + 4 })
  })

  it('strip width = text.length * CELL + padding * 2 (default padding = 2)', () => {
    const ctx = makeMockCtx()
    drawPanelTitle(ctx, { text: 'HI', x: 0, y: 0, ink: C.B_WHITE, paper: C.BLACK })
    // 2 chars → 16px + 4 = 20
    expect(ctx._rects[0].w).toBe(2 * CELL + 4)
  })

  it('centered mode: strip width equals width option', () => {
    const ctx = makeMockCtx()
    drawPanelTitle(ctx, { text: 'A', x: 0, y: 0, ink: C.B_WHITE, paper: C.BLACK, centered: true, width: 64 })
    expect(ctx._rects[0].w).toBe(64)
  })
})

describe('drawPanelTitle — without paper', () => {
  it('no background fillRect when paper is omitted', () => {
    const ctx = makeMockCtx()
    drawPanelTitle(ctx, { text: ' ', x: 0, y: 0, ink: C.B_WHITE })
    // space has no ink pixels, and no paper → 0 fillRects
    expect(ctx._rects).toHaveLength(0)
  })
})

// ── drawProgressBar ───────────────────────────────────────────────────────────

describe('drawProgressBar — rendering', () => {
  beforeEach(() => resetUI())

  it('renders at least 1 fillRect (paper background)', () => {
    const ctx = makeMockCtx()
    drawProgressBar(ctx, { x: 0, y: 0, width: 16, value: 0 })
    expect(ctx._rects.length).toBeGreaterThanOrEqual(1)
  })

  it('value=min → only paper background, no filled chars', () => {
    const ctx = makeMockCtx()
    drawProgressBar(ctx, { x: 0, y: 0, width: 16, value: 0, min: 0, max: 1, ink: C.B_GREEN, paper: C.BLACK })
    // All rects should be paper-colored (no ink chars when filled=0)
    const inkRects = ctx._rects.filter(r => r.style === C.B_GREEN)
    expect(inkRects).toHaveLength(0)
  })

  it('value=max → filled chars are rendered with ink color', () => {
    const ctx = makeMockCtx()
    drawProgressBar(ctx, { x: 0, y: 0, width: 8, value: 1, min: 0, max: 1, ink: C.B_GREEN, paper: C.BLACK })
    // 1 char filled → ink pixels present
    const inkRects = ctx._rects.filter(r => r.style === C.B_GREEN)
    expect(inkRects.length).toBeGreaterThan(0)
  })

  it('auto-id uses "${x},${y}" when id is not provided', () => {
    const ctx = makeMockCtx()
    drawProgressBar(ctx, { x: 10, y: 20, width: 16, value: 0, visibilityLength: 0 })
    // Bar is registered and renderUI redraws it
    const ctx2 = makeMockCtx()
    renderUI(ctx2)
    expect(ctx2._rects.length).toBeGreaterThan(0)
  })

  it('border is rendered when border option is provided', () => {
    const ctx = makeMockCtx()
    const withBorder = makeMockCtx()
    drawProgressBar(ctx,        { x: 0, y: 0, width: 16, value: 0 })
    resetUI()
    drawProgressBar(withBorder, { x: 0, y: 0, width: 16, value: 0, border: { style: 'solid' }, ink: C.B_CYAN })
    expect(withBorder._rects.length).toBeGreaterThan(ctx._rects.length)
  })
})

// ── tickUI ────────────────────────────────────────────────────────────────────

describe('tickUI — timer management', () => {
  beforeEach(() => resetUI())

  it('bar is visible before timer expires', () => {
    const ctx = makeMockCtx()
    drawProgressBar(ctx, { x: 0, y: 0, width: 8, value: 0, visibilityLength: 200 })

    tickUI(100)  // 100ms — bar still alive (timer = 100)
    const ctx2 = makeMockCtx()
    renderUI(ctx2)
    expect(ctx2._rects.length).toBeGreaterThan(0)
  })

  it('bar is removed after timer expires', () => {
    const ctx = makeMockCtx()
    drawProgressBar(ctx, { x: 0, y: 0, width: 8, value: 0, visibilityLength: 100 })

    tickUI(110)  // 110ms > 100ms → removed
    const ctx2 = makeMockCtx()
    renderUI(ctx2)
    expect(ctx2._rects).toHaveLength(0)
  })

  it('permanent bar (visibilityLength=0) survives arbitrarily large dt', () => {
    const ctx = makeMockCtx()
    drawProgressBar(ctx, { x: 0, y: 0, width: 8, value: 0, visibilityLength: 0 })

    tickUI(999_999)
    const ctx2 = makeMockCtx()
    renderUI(ctx2)
    expect(ctx2._rects.length).toBeGreaterThan(0)
  })

  it('multiple bars: expired ones are removed, permanent ones remain', () => {
    const ctx = makeMockCtx()
    drawProgressBar(ctx, { id: 'temp',  x: 0, y: 0, width: 8, value: 0, visibilityLength: 100 })
    drawProgressBar(ctx, { id: 'perm',  x: 0, y: 8, width: 8, value: 0, visibilityLength: 0 })
    drawProgressBar(ctx, { id: 'alive', x: 0, y: 16, width: 8, value: 0, visibilityLength: 500 })

    tickUI(200)  // temp gone, perm + alive remain

    let redrawnRects = 0
    const ctx2 = {
      ...makeMockCtx(),
      fillRect(x: number, _y: number, _w: number, _h: number) {
        redrawnRects++
      },
    } as unknown as CanvasRenderingContext2D
    renderUI(ctx2)
    // At least perm and alive contributed fill calls (2 bars × ≥1 fillRect)
    expect(redrawnRects).toBeGreaterThanOrEqual(2)
  })
})

// ── renderUI ──────────────────────────────────────────────────────────────────

describe('renderUI — redraws registered bars', () => {
  beforeEach(() => resetUI())

  it('redraws a permanent bar every frame', () => {
    const ctx = makeMockCtx()
    drawProgressBar(ctx, { x: 0, y: 0, width: 8, value: 0.5, visibilityLength: 0 })
    ctx._clear()

    const ctx2 = makeMockCtx()
    renderUI(ctx2)
    expect(ctx2._rects.length).toBeGreaterThan(0)
  })

  it('draws nothing when no bars are registered', () => {
    const ctx = makeMockCtx()
    renderUI(ctx)
    expect(ctx._rects).toHaveLength(0)
  })
})

// ── resetUI ───────────────────────────────────────────────────────────────────

describe('resetUI', () => {
  it('clears all bars — renderUI draws nothing afterwards', () => {
    const ctx = makeMockCtx()
    drawProgressBar(ctx, { x: 0, y: 0, width: 8, value: 0, visibilityLength: 0 })
    drawProgressBar(ctx, { id: 'b', x: 0, y: 8, width: 8, value: 0, visibilityLength: 0 })

    resetUI()

    const ctx2 = makeMockCtx()
    renderUI(ctx2)
    expect(ctx2._rects).toHaveLength(0)
  })
})

// ── drawDottedGrid ────────────────────────────────────────────────────────────

describe('drawDottedGrid — dot count and placement', () => {
  it('16×8 area with spacing=4 produces 8 dots (4 cols × 2 rows)', () => {
    const ctx = makeMockCtx()
    drawDottedGrid(ctx, { x: 0, y: 0, width: 16, height: 8, spacing: 4, color: C.B_GREEN })
    expect(ctx._rects).toHaveLength(8)
  })

  it('every dot uses the given color', () => {
    const ctx = makeMockCtx()
    drawDottedGrid(ctx, { x: 0, y: 0, width: 16, height: 8, spacing: 4, color: C.B_RED })
    for (const r of ctx._rects) expect(r.style).toBe(C.B_RED)
  })

  it('dots are 1×1 by default', () => {
    const ctx = makeMockCtx()
    drawDottedGrid(ctx, { x: 0, y: 0, width: 8, height: 8, spacing: 4, color: C.B_GREEN })
    for (const r of ctx._rects) expect(r).toMatchObject({ w: 1, h: 1 })
  })

  it('respects dotSize option', () => {
    const ctx = makeMockCtx()
    drawDottedGrid(ctx, { x: 0, y: 0, width: 16, height: 16, spacing: 8, color: C.B_WHITE, dotSize: 2 })
    for (const r of ctx._rects) expect(r).toMatchObject({ w: 2, h: 2 })
  })

  it('paper fills background as a single rect before any dots', () => {
    const ctx = makeMockCtx()
    drawDottedGrid(ctx, { x: 4, y: 8, width: 16, height: 8, spacing: 4, color: C.B_GREEN, paper: C.BLACK })
    expect(ctx._rects[0]).toMatchObject({ style: C.BLACK, x: 4, y: 8, w: 16, h: 8 })
  })

  it('dot positions match spacing × index, offset by (x, y)', () => {
    const ctx = makeMockCtx()
    drawDottedGrid(ctx, { x: 10, y: 20, width: 16, height: 8, spacing: 4, color: C.B_GREEN })
    expect(ctx._rects[0]).toMatchObject({ x: 10, y: 20 })
    expect(ctx._rects[1]).toMatchObject({ x: 14, y: 20 })
    expect(ctx._rects[2]).toMatchObject({ x: 18, y: 20 })
    expect(ctx._rects[3]).toMatchObject({ x: 22, y: 20 })
    expect(ctx._rects[4]).toMatchObject({ x: 10, y: 24 })
  })

  it('no paper → no background fillRect, only dots', () => {
    const ctx = makeMockCtx()
    drawDottedGrid(ctx, { x: 0, y: 0, width: 8, height: 8, spacing: 4, color: C.B_GREEN })
    expect(ctx._rects).toHaveLength(4)
  })
})

// ── drawSegmentedBar ──────────────────────────────────────────────────────────

describe('drawSegmentedBar — single colour mode', () => {
  it('value=0 → no filled segments', () => {
    const ctx = makeMockCtx()
    drawSegmentedBar(ctx, { x: 0, y: 0, segments: 10, value: 0, max: 10, color: C.B_GREEN })
    expect(ctx._rects).toHaveLength(0)
  })

  it('value=max → all 10 segments filled', () => {
    const ctx = makeMockCtx()
    drawSegmentedBar(ctx, { x: 0, y: 0, segments: 10, value: 10, max: 10, color: C.B_GREEN })
    expect(ctx._rects).toHaveLength(10)
    for (const r of ctx._rects) expect(r.style).toBe(C.B_GREEN)
  })

  it('value=7/10 → 7 filled segments rendered', () => {
    const ctx = makeMockCtx()
    drawSegmentedBar(ctx, { x: 0, y: 0, segments: 10, value: 7, max: 10, color: C.B_GREEN })
    expect(ctx._rects).toHaveLength(7)
  })

  it('paper renders empty segments too', () => {
    const ctx = makeMockCtx()
    drawSegmentedBar(ctx, { x: 0, y: 0, segments: 10, value: 3, max: 10, color: C.B_GREEN, paper: C.BLACK })
    expect(ctx._rects).toHaveLength(10)
    expect(ctx._rects.filter(r => r.style === C.B_GREEN)).toHaveLength(3)
    expect(ctx._rects.filter(r => r.style === C.BLACK)).toHaveLength(7)
  })

  it('clamps value > max', () => {
    const ctx = makeMockCtx()
    drawSegmentedBar(ctx, { x: 0, y: 0, segments: 5, value: 99, max: 5, color: C.B_GREEN })
    expect(ctx._rects).toHaveLength(5)
  })

  it('clamps value < 0', () => {
    const ctx = makeMockCtx()
    drawSegmentedBar(ctx, { x: 0, y: 0, segments: 5, value: -10, max: 5, color: C.B_GREEN })
    expect(ctx._rects).toHaveLength(0)
  })

  it('segments are spaced by segmentWidth + gap horizontally', () => {
    const ctx = makeMockCtx()
    drawSegmentedBar(ctx, {
      x: 0, y: 0, segments: 3, value: 3, max: 3,
      segmentWidth: 4, segmentHeight: 8, gap: 2,
      color: C.B_GREEN,
    })
    expect(ctx._rects[0].x).toBe(0)
    expect(ctx._rects[1].x).toBe(6)   // 4 + 2
    expect(ctx._rects[2].x).toBe(12)  // 8 + 4
  })
})

describe('drawSegmentedBar — threshold gradient mode', () => {
  it('low ratio uses colors[0] (red)', () => {
    const ctx = makeMockCtx()
    drawSegmentedBar(ctx, {
      x: 0, y: 0, segments: 10, value: 2, max: 10,
      colors: [C.B_RED, C.B_YELLOW, C.B_GREEN],
    })
    for (const r of ctx._rects) expect(r.style).toBe(C.B_RED)
  })

  it('mid ratio uses colors[1] (yellow)', () => {
    const ctx = makeMockCtx()
    drawSegmentedBar(ctx, {
      x: 0, y: 0, segments: 10, value: 5, max: 10,
      colors: [C.B_RED, C.B_YELLOW, C.B_GREEN],
    })
    for (const r of ctx._rects) expect(r.style).toBe(C.B_YELLOW)
  })

  it('high ratio uses colors[2] (green)', () => {
    const ctx = makeMockCtx()
    drawSegmentedBar(ctx, {
      x: 0, y: 0, segments: 10, value: 8, max: 10,
      colors: [C.B_RED, C.B_YELLOW, C.B_GREEN],
    })
    for (const r of ctx._rects) expect(r.style).toBe(C.B_GREEN)
  })

  it('boundary at 1/3 uses mid colour (>= threshold)', () => {
    const ctx = makeMockCtx()
    drawSegmentedBar(ctx, {
      x: 0, y: 0, segments: 3, value: 1, max: 3,    // ratio = 0.333... → mid
      colors: [C.B_RED, C.B_YELLOW, C.B_GREEN],
    })
    for (const r of ctx._rects) expect(r.style).toBe(C.B_YELLOW)
  })

  it('boundary at 2/3 uses high colour', () => {
    const ctx = makeMockCtx()
    drawSegmentedBar(ctx, {
      x: 0, y: 0, segments: 3, value: 2, max: 3,    // ratio = 0.666... → high
      colors: [C.B_RED, C.B_YELLOW, C.B_GREEN],
    })
    for (const r of ctx._rects) expect(r.style).toBe(C.B_GREEN)
  })
})

describe('drawSegmentedBar — segmentColors mode', () => {
  it('each filled segment gets its own colour from the array', () => {
    const ctx = makeMockCtx()
    const segs = [C.B_RED, C.B_GREEN, C.B_GREEN, C.B_GREEN, C.B_GREEN, C.B_YELLOW, C.B_RED]
    drawSegmentedBar(ctx, {
      x: 0, y: 0, segments: 7, value: 7, max: 7,
      segmentWidth: 6, segmentHeight: 8, gap: 1,
      segmentColors: segs, paper: C.BLACK,
    })
    expect(ctx._rects.filter(r => r.style !== C.BLACK).length).toBe(7)
    expect(ctx._rects[0]!.style).toBe(C.B_RED)
    expect(ctx._rects[1]!.style).toBe(C.B_GREEN)
    expect(ctx._rects[5]!.style).toBe(C.B_YELLOW)
    expect(ctx._rects[6]!.style).toBe(C.B_RED)
  })

  it('unfilled segments beyond value use paper colour', () => {
    const ctx = makeMockCtx()
    const segs = [C.B_RED, C.B_GREEN, C.B_GREEN, C.B_GREEN, C.B_GREEN, C.B_YELLOW, C.B_RED]
    drawSegmentedBar(ctx, {
      x: 0, y: 0, segments: 7, value: 3, max: 7,
      segmentWidth: 6, segmentHeight: 8, gap: 1,
      segmentColors: segs, paper: C.BLACK,
    })
    const filled = ctx._rects.filter(r => r.style !== C.BLACK)
    const empty  = ctx._rects.filter(r => r.style === C.BLACK)
    expect(filled.length).toBe(3)
    expect(empty.length).toBe(4)
    expect(filled[0]!.style).toBe(C.B_RED)
    expect(filled[1]!.style).toBe(C.B_GREEN)
    expect(filled[2]!.style).toBe(C.B_GREEN)
  })

  it('throws when segmentColors is combined with color', () => {
    const ctx = makeMockCtx()
    expect(() => drawSegmentedBar(ctx, {
      x: 0, y: 0, segments: 3, value: 1, max: 3,
      color: C.B_GREEN,
      segmentColors: [C.B_RED, C.B_GREEN, C.B_YELLOW],
    })).toThrow(/exactly one of/)
  })
})

describe('drawSegmentedBar — vertical orientation', () => {
  it('stacks segments bottom-up (first segment is at the bottom of the column)', () => {
    const ctx = makeMockCtx()
    drawSegmentedBar(ctx, {
      x: 10, y: 20, segments: 3, value: 3, max: 3,
      segmentWidth: 8, segmentHeight: 4, gap: 1,
      orientation: 'vertical',
      color: C.B_GREEN,
    })
    // First-filled segment is index 0 → renders at the BOTTOM (y = top + (segments-1) * (h+gap))
    expect(ctx._rects[0]).toMatchObject({ x: 10, y: 20 + 2 * (4 + 1) })  // y = 30
    expect(ctx._rects[1]).toMatchObject({ x: 10, y: 20 + 1 * (4 + 1) })  // y = 25
    expect(ctx._rects[2]).toMatchObject({ x: 10, y: 20 })                 // y = 20 (top)
  })
})

describe('drawSegmentedBar — validation', () => {
  it('throws when both color and colors are omitted', () => {
    const ctx = makeMockCtx()
    expect(() => drawSegmentedBar(ctx, { x: 0, y: 0, segments: 1, value: 1, max: 1 } as never))
      .toThrow(/exactly one of/)
  })

  it('throws when both color and colors are provided', () => {
    const ctx = makeMockCtx()
    expect(() => drawSegmentedBar(ctx, {
      x: 0, y: 0, segments: 1, value: 1, max: 1,
      color: C.B_GREEN,
      colors: [C.B_RED, C.B_YELLOW, C.B_GREEN],
    })).toThrow(/exactly one of/)
  })
})

// ── drawTank ──────────────────────────────────────────────────────────────────

describe('drawTank — rect shape', () => {
  it('empty tank → 4 outline rects, no liquid', () => {
    const ctx = makeMockCtx()
    drawTank(ctx, {
      x: 0, y: 0, width: 16, height: 16,
      fillPct: 0, shape: 'rect',
      liquidColor: C.B_CYAN, containerColor: C.WHITE,
    })
    const liquid = ctx._rects.filter(r => r.style === C.B_CYAN)
    const outline = ctx._rects.filter(r => r.style === C.WHITE)
    expect(liquid).toHaveLength(0)
    expect(outline).toHaveLength(4)
  })

  it('full tank → liquid fills entire interior', () => {
    const ctx = makeMockCtx()
    drawTank(ctx, {
      x: 0, y: 0, width: 16, height: 16,
      fillPct: 1, shape: 'rect',
      liquidColor: C.B_CYAN, containerColor: C.WHITE,
    })
    const liquid = ctx._rects.filter(r => r.style === C.B_CYAN)
    expect(liquid).toHaveLength(1)
    expect(liquid[0]).toMatchObject({ w: 16, h: 16 })
  })

  it('half-full tank → liquid in bottom half', () => {
    const ctx = makeMockCtx()
    drawTank(ctx, {
      x: 0, y: 0, width: 16, height: 16,
      fillPct: 0.5, shape: 'rect',
      liquidColor: C.B_CYAN, containerColor: C.WHITE,
    })
    const liquid = ctx._rects.filter(r => r.style === C.B_CYAN)
    expect(liquid).toHaveLength(1)
    expect(liquid[0]).toMatchObject({ y: 8, h: 8 })
  })

  it('clamps fillPct > 1', () => {
    const ctx = makeMockCtx()
    drawTank(ctx, {
      x: 0, y: 0, width: 16, height: 16,
      fillPct: 2.5, shape: 'rect',
      liquidColor: C.B_CYAN, containerColor: C.WHITE,
    })
    const liquid = ctx._rects.filter(r => r.style === C.B_CYAN)
    expect(liquid[0]).toMatchObject({ h: 16 })
  })

  it('emptyColor fills the empty portion', () => {
    const ctx = makeMockCtx()
    drawTank(ctx, {
      x: 0, y: 0, width: 16, height: 16,
      fillPct: 0.5, shape: 'rect',
      liquidColor: C.B_CYAN, containerColor: C.WHITE, emptyColor: C.BLACK,
    })
    const empty = ctx._rects.filter(r => r.style === C.BLACK)
    expect(empty[0]).toMatchObject({ y: 0, h: 8 })
  })

  it('containerColor defaults to liquidColor', () => {
    const ctx = makeMockCtx()
    drawTank(ctx, {
      x: 0, y: 0, width: 16, height: 16,
      fillPct: 0, shape: 'rect',
      liquidColor: C.B_GREEN,
    })
    // Outline rects (4 for rect) inherit liquidColor as containerColor by default.
    const outline = ctx._rects.filter(r => r.style === C.B_GREEN)
    expect(outline).toHaveLength(4)
  })

  it('emptyColor defaults to C.BLACK when omitted', () => {
    const ctx = makeMockCtx()
    drawTank(ctx, {
      x: 0, y: 0, width: 16, height: 16,
      fillPct: 0, shape: 'rect',
      liquidColor: C.B_GREEN,
      // no emptyColor → default BLACK
    })
    const blackFill = ctx._rects.filter(r => r.style === C.BLACK)
    expect(blackFill.length).toBeGreaterThan(0)
  })

  it('emptyColor: "transparent" suppresses the empty fill entirely', () => {
    const ctx = makeMockCtx()
    drawTank(ctx, {
      x: 0, y: 0, width: 16, height: 16,
      fillPct: 0, shape: 'rect',
      liquidColor: C.B_GREEN,
      emptyColor: 'transparent',
    })
    // No fills at all in interior — only the 4 outline rects in liquidColor.
    expect(ctx._rects).toHaveLength(4)
    for (const r of ctx._rects) expect(r.style).toBe(C.B_GREEN)
  })
})

describe('drawTank — pill shape', () => {
  it('renders without throwing for various dimensions', () => {
    const ctx = makeMockCtx()
    expect(() => drawTank(ctx, {
      x: 0, y: 0, width: 16, height: 32,
      fillPct: 0.66, shape: 'pill',
      liquidColor: C.B_CYAN, containerColor: C.WHITE, emptyColor: C.BLACK,
    })).not.toThrow()
  })

  it('full pill tank produces some liquid fill rects', () => {
    const ctx = makeMockCtx()
    drawTank(ctx, {
      x: 0, y: 0, width: 16, height: 32,
      fillPct: 1, shape: 'pill',
      liquidColor: C.B_CYAN, containerColor: C.WHITE,
    })
    const liquid = ctx._rects.filter(r => r.style === C.B_CYAN)
    expect(liquid.length).toBeGreaterThan(0)
  })

  it('empty pill tank produces no liquid fill rects', () => {
    const ctx = makeMockCtx()
    drawTank(ctx, {
      x: 0, y: 0, width: 16, height: 32,
      fillPct: 0, shape: 'pill',
      liquidColor: C.B_CYAN, containerColor: C.WHITE,
    })
    const liquid = ctx._rects.filter(r => r.style === C.B_CYAN)
    expect(liquid).toHaveLength(0)
  })

  it('pill shape produces outline narrower at top and bottom (curved caps)', () => {
    const ctx = makeMockCtx()
    drawTank(ctx, {
      x: 0, y: 0, width: 16, height: 32,
      fillPct: 0, shape: 'pill',
      liquidColor: C.B_CYAN, containerColor: C.WHITE,
    })
    // Outline pixels at the top-edge row (y=0) should be inset from x=0
    const outlineAtTop = ctx._rects.filter(r => r.style === C.WHITE && r.y === 0)
    expect(outlineAtTop.length).toBeGreaterThan(0)
    // Left-most outline pixel at top is NOT at x=0 (curved cap insets it)
    const leftmost = Math.min(...outlineAtTop.map(r => r.x))
    expect(leftmost).toBeGreaterThan(0)
  })

  it('shape defaults to pill', () => {
    const ctx = makeMockCtx()
    drawTank(ctx, {
      x: 0, y: 0, width: 16, height: 32,
      fillPct: 0,
      liquidColor: C.B_CYAN, containerColor: C.WHITE,
    })
    // If pill (default), top row outline is inset → not at x=0
    const topOutline = ctx._rects.filter(r => r.style === C.WHITE && r.y === 0)
    const leftmost = Math.min(...topOutline.map(r => r.x))
    expect(leftmost).toBeGreaterThan(0)
  })
})

// ── drawDial ──────────────────────────────────────────────────────────────────

describe('drawDial — needle rendering', () => {
  it('renders at least one needle pixel (the centre)', () => {
    const ctx = makeMockCtx()
    drawDial(ctx, { cx: 20, cy: 20, radius: 10, value: 50, needleColor: C.B_RED })
    const red = ctx._rects.filter(r => r.style === C.B_RED)
    expect(red.length).toBeGreaterThan(0)
  })

  it('needle starts at centre pixel', () => {
    const ctx = makeMockCtx()
    drawDial(ctx, { cx: 20, cy: 20, radius: 10, value: 50, needleColor: C.B_RED })
    const red = ctx._rects.filter(r => r.style === C.B_RED)
    expect(red.some(r => r.x === 20 && r.y === 20)).toBe(true)
  })

  it('value=min places needle at startAngle (bottom-left default)', () => {
    const ctx = makeMockCtx()
    drawDial(ctx, { cx: 20, cy: 20, radius: 10, value: 0, min: 0, max: 100, needleColor: C.B_RED })
    const red = ctx._rects.filter(r => r.style === C.B_RED)
    // default startAngle = -3π/4 → tip is left-below-of-centre
    const tip = red[red.length - 1]
    expect(tip.x).toBeLessThan(20)
    expect(tip.y).toBeGreaterThan(20)
  })

  it('value=max places needle at endAngle (bottom-right default)', () => {
    const ctx = makeMockCtx()
    drawDial(ctx, { cx: 20, cy: 20, radius: 10, value: 100, min: 0, max: 100, needleColor: C.B_RED })
    const red = ctx._rects.filter(r => r.style === C.B_RED)
    const tip = red[red.length - 1]
    expect(tip.x).toBeGreaterThan(20)
    expect(tip.y).toBeGreaterThan(20)
  })

  it('faceColor produces filled disc when provided', () => {
    const ctx = makeMockCtx()
    drawDial(ctx, { cx: 20, cy: 20, radius: 10, value: 50, needleColor: C.B_RED, faceColor: C.BLACK })
    const blackFills = ctx._rects.filter(r => r.style === C.BLACK)
    expect(blackFills.length).toBeGreaterThan(0)
  })

  it('rimColor produces circle outline when provided', () => {
    const ctx = makeMockCtx()
    drawDial(ctx, { cx: 20, cy: 20, radius: 10, value: 50, needleColor: C.B_RED, rimColor: C.WHITE })
    const whiteFills = ctx._rects.filter(r => r.style === C.WHITE)
    expect(whiteFills.length).toBeGreaterThan(0)
  })

  it('ticks=0 (default) produces no tick marks', () => {
    const ctx = makeMockCtx()
    drawDial(ctx, { cx: 20, cy: 20, radius: 10, value: 50, needleColor: C.B_RED, tickColor: C.B_YELLOW })
    const yellow = ctx._rects.filter(r => r.style === C.B_YELLOW)
    expect(yellow).toHaveLength(0)
  })

  it('ticks > 0 produces tick mark pixels in tickColor', () => {
    const ctx = makeMockCtx()
    drawDial(ctx, { cx: 20, cy: 20, radius: 10, value: 50, needleColor: C.B_RED, tickColor: C.B_YELLOW, ticks: 5 })
    const yellow = ctx._rects.filter(r => r.style === C.B_YELLOW)
    expect(yellow.length).toBeGreaterThan(0)
  })

  it('clamps value above max', () => {
    const ctx = makeMockCtx()
    expect(() => drawDial(ctx, { cx: 20, cy: 20, radius: 10, value: 999, min: 0, max: 100, needleColor: C.B_RED })).not.toThrow()
  })

  it('clamps value below min', () => {
    const ctx = makeMockCtx()
    expect(() => drawDial(ctx, { cx: 20, cy: 20, radius: 10, value: -999, min: 0, max: 100, needleColor: C.B_RED })).not.toThrow()
  })

  it('handles min===max degenerate range without throwing', () => {
    const ctx = makeMockCtx()
    expect(() => drawDial(ctx, { cx: 20, cy: 20, radius: 10, value: 50, min: 50, max: 50, needleColor: C.B_RED })).not.toThrow()
  })
})

// ── drawCompassText ───────────────────────────────────────────────────────────

describe('drawCompassText — direction selection', () => {
  it('heading=0 (N) renders 5 labels with N in centre', () => {
    const ctx = makeMockCtx()
    drawCompassText(ctx, { x: 0, y: 0, heading: 0, color: C.WHITE, highlightColor: C.B_YELLOW })
    // Centre label uses highlightColor — should produce some B_YELLOW rects
    const yellow = ctx._rects.filter(r => r.style === C.B_YELLOW)
    expect(yellow.length).toBeGreaterThan(0)
  })

  it('non-centre labels use color (not highlightColor)', () => {
    const ctx = makeMockCtx()
    drawCompassText(ctx, { x: 0, y: 0, heading: 0, color: C.WHITE, highlightColor: C.B_YELLOW })
    const white = ctx._rects.filter(r => r.style === C.WHITE)
    expect(white.length).toBeGreaterThan(0)
  })

  it('heading wraps below 0 correctly', () => {
    const ctx = makeMockCtx()
    expect(() => drawCompassText(ctx, { x: 0, y: 0, heading: -45, color: C.WHITE })).not.toThrow()
  })

  it('heading wraps above 360 correctly', () => {
    const ctx = makeMockCtx()
    expect(() => drawCompassText(ctx, { x: 0, y: 0, heading: 720, color: C.WHITE })).not.toThrow()
  })

  it('heading=90 (E) different from heading=0 (N)', () => {
    const ctx1 = makeMockCtx()
    const ctx2 = makeMockCtx()
    drawCompassText(ctx1, { x: 0, y: 0, heading: 0,  color: C.WHITE, highlightColor: C.B_YELLOW })
    drawCompassText(ctx2, { x: 0, y: 0, heading: 90, color: C.WHITE, highlightColor: C.B_YELLOW })
    // Different headings → different rendered output (centre labels differ)
    expect(ctx1._rects.length).not.toBe(0)
    expect(ctx2._rects.length).not.toBe(0)
    // At least one rect should differ (centre label "N" vs "E" has different bitmap)
    const sig1 = JSON.stringify(ctx1._rects)
    const sig2 = JSON.stringify(ctx2._rects)
    expect(sig1).not.toBe(sig2)
  })

  it('default highlightColor falls back to color (no separate highlight)', () => {
    const ctx = makeMockCtx()
    drawCompassText(ctx, { x: 0, y: 0, heading: 0, color: C.WHITE })
    // Everything should be C.WHITE (no other ink colour used)
    const nonWhite = ctx._rects.filter(r => r.style !== C.WHITE && r.style !== '')
    expect(nonWhite).toHaveLength(0)
  })

  it('brackets=false omits the [] around the adjacent labels', () => {
    const ctxBracketed = makeMockCtx()
    const ctxPlain     = makeMockCtx()
    drawCompassText(ctxBracketed, { x: 0, y: 0, heading: 0, color: C.WHITE, brackets: true })
    drawCompassText(ctxPlain,     { x: 0, y: 0, heading: 0, color: C.WHITE, brackets: false })
    // Bracketed version draws more characters → more fillRects overall
    expect(ctxBracketed._rects.length).toBeGreaterThan(ctxPlain._rects.length)
  })

  it('only ±1 labels get brackets — outer ±2 stay plain', () => {
    // heading=0 → labels W, NW, N, NE, E.
    // With ONLY ±1 bracketed (correct): "W [NW] N [NE] E"
    //   widths in cells: 1 + 4 + 1 + 4 + 1 = 11 char cells + 4 spaces = 15 cells = 120 px
    // If ±2 were ALSO bracketed (wrong): "[W] [NW] N [NE] [E]"
    //   widths: 3 + 4 + 1 + 4 + 3 = 15 char cells + 4 spaces = 19 cells = 152 px
    const ctxA = makeMockCtx()
    drawCompassText(ctxA, { x: 0, y: 0, heading: 0, color: C.WHITE, brackets: true })
    const maxRightEdge = Math.max(...ctxA._rects.map(r => r.x + r.w))
    // Layout fits well below the 19-cell "bracketed-outer" threshold.
    expect(maxRightEdge).toBeLessThan(17 * CELL)   // 136 px — wrong layout would exceed this
    expect(maxRightEdge).toBeGreaterThan(10 * CELL) // sanity: actually rendered
  })

  it('paper paints behind each label when provided', () => {
    const ctx = makeMockCtx()
    drawCompassText(ctx, { x: 0, y: 0, heading: 0, color: C.WHITE, paper: C.BLACK })
    const black = ctx._rects.filter(r => r.style === C.BLACK)
    expect(black.length).toBeGreaterThan(0)
  })
})
