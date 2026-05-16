import { describe, it, expect, beforeEach } from 'vitest'
import { C, CELL } from '../src/palette.js'
import {
  drawBox, drawFrame, drawPanelTitle,
  drawProgressBar, tickUI, renderUI, resetUI,
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
