import { describe, it, expect, vi, afterEach } from 'vitest'
import { C, CELL } from './src/palette.js'
import {
  mirrorSprite,
  setupCanvas,
  curveDisplay,
  drawSprite,
  drawChar,
  drawText,
  drawTextCentered,
  drawScanlines,
  flashBorder,
} from './src/renderer.js'

// ── Mock helpers ──────────────────────────────────────────────────────────────

type FillCall = { style: string; x: number; y: number; w: number; h: number }

function makeMockCtx(canvasWidth = 32, canvasHeight = 16) {
  let _fillStyle = ''
  const rects: FillCall[] = []
  const ctx = {
    get fillStyle() { return _fillStyle },
    set fillStyle(v: string) { _fillStyle = v },
    imageSmoothingEnabled: true as boolean,
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ style: _fillStyle, x, y, w, h })
    },
    save:         vi.fn(),
    restore:      vi.fn(),
    setTransform: vi.fn(),
    scale:        vi.fn(),
    canvas: { width: canvasWidth, height: canvasHeight },
    _rects: rects,
  } as unknown as CanvasRenderingContext2D & { _rects: FillCall[] }
  return ctx
}

function makeMockCanvas() {
  const style = { width: '', height: '', borderRadius: '', boxShadow: '' }
  const ctx = makeMockCtx()
  const canvas = {
    width:  0 as number,
    height: 0 as number,
    style,
    getContext: vi.fn().mockReturnValue(ctx),
    _ctx: ctx,
  }
  return canvas as unknown as HTMLCanvasElement & { style: typeof style; _ctx: typeof ctx }
}

// Predictable test bitmaps
const ALL_ON  = new Uint8Array(8).fill(0xFF)  // 64 set pixels
const ALL_OFF = new Uint8Array(8)             // 0 set pixels

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// ── mirrorSprite ──────────────────────────────────────────────────────────────
// Full coverage is in sprite.tests.ts — smoke tests only here since it lives in renderer.ts

describe('mirrorSprite', () => {
  it('returns a new Uint8Array (not the same reference)', () => {
    const src = new Uint8Array(8)
    const out = mirrorSprite(src)
    expect(out).toBeInstanceOf(Uint8Array)
    expect(out).not.toBe(src)
  })

  it('flips leftmost bit to rightmost position', () => {
    const src = new Uint8Array([0b10000000, 0, 0, 0, 0, 0, 0, 0])
    expect(mirrorSprite(src)[0]).toBe(0b00000001)
  })

  it('all-zero bitmap stays all-zero after mirror', () => {
    const out = mirrorSprite(new Uint8Array(8))
    expect([...out]).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('all-FF bitmap stays all-FF after mirror', () => {
    const out = mirrorSprite(new Uint8Array(8).fill(0xFF))
    expect([...out]).toEqual([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF])
  })
})

// ── setupCanvas ───────────────────────────────────────────────────────────────

describe('setupCanvas', () => {
  it('sets canvas.width and canvas.height using scale', () => {
    const canvas = makeMockCanvas()
    setupCanvas(canvas, 4)
    expect((canvas as unknown as { width: number }).width).toBe(256 * 4)
    expect((canvas as unknown as { height: number }).height).toBe(192 * 4)
  })

  it('respects custom width and height params', () => {
    const canvas = makeMockCanvas()
    setupCanvas(canvas, 2, 128, 96)
    expect((canvas as unknown as { width: number }).width).toBe(128 * 2)
    expect((canvas as unknown as { height: number }).height).toBe(96 * 2)
  })

  it('sets style.width and style.height as CSS pixel strings', () => {
    const canvas = makeMockCanvas()
    setupCanvas(canvas, 4)
    expect(canvas.style.width).toBe('1024px')
    expect(canvas.style.height).toBe('768px')
  })

  it('disables imageSmoothingEnabled on the context', () => {
    const canvas = makeMockCanvas()
    setupCanvas(canvas, 4)
    expect(canvas._ctx.imageSmoothingEnabled).toBe(false)
  })

  it('calls ctx.scale with the given scale factor', () => {
    const canvas = makeMockCanvas()
    setupCanvas(canvas, 4)
    expect(canvas._ctx.scale).toHaveBeenCalledWith(4, 4)
  })

  it('returns the 2D context from getContext', () => {
    const canvas = makeMockCanvas()
    const result = setupCanvas(canvas, 4)
    expect(result).toBe(canvas._ctx)
  })
})

// ── curveDisplay ──────────────────────────────────────────────────────────────

describe('curveDisplay', () => {
  it('intensity=1 sets borderRadius to 18px', () => {
    const canvas = makeMockCanvas()
    curveDisplay(canvas, 1)
    expect(canvas.style.borderRadius).toBe('18px')
  })

  it('intensity=1 sets boxShadow with full values', () => {
    const canvas = makeMockCanvas()
    curveDisplay(canvas, 1)
    expect(canvas.style.boxShadow).toBe('inset 0 0 60px rgba(0,0,0,0.45)')
  })

  it('intensity=0 clears borderRadius', () => {
    const canvas = makeMockCanvas()
    curveDisplay(canvas, 1)        // set first
    curveDisplay(canvas, 0)        // then clear
    expect(canvas.style.borderRadius).toBe('')
  })

  it('intensity=0 clears boxShadow', () => {
    const canvas = makeMockCanvas()
    curveDisplay(canvas, 1)
    curveDisplay(canvas, 0)
    expect(canvas.style.boxShadow).toBe('')
  })

  it('default intensity is 1 (full effect)', () => {
    const canvas = makeMockCanvas()
    curveDisplay(canvas)
    expect(canvas.style.borderRadius).toBe('18px')
  })

  it('intensity is clamped to [0, 1] — negative becomes 0', () => {
    const canvas = makeMockCanvas()
    curveDisplay(canvas, 1)
    curveDisplay(canvas, -1)       // should clamp to 0 → clear effect
    expect(canvas.style.borderRadius).toBe('')
  })

  it('intensity is clamped to [0, 1] — value > 1 becomes 1', () => {
    const canvas = makeMockCanvas()
    curveDisplay(canvas, 10)       // same as intensity=1
    expect(canvas.style.borderRadius).toBe('18px')
  })

  it('intermediate intensity produces smaller borderRadius than full', () => {
    const canvasFull = makeMockCanvas()
    const canvasHalf = makeMockCanvas()
    curveDisplay(canvasFull, 1)
    curveDisplay(canvasHalf, 0.5)
    const fullPx  = parseInt(canvasFull.style.borderRadius)
    const halfPx  = parseInt(canvasHalf.style.borderRadius)
    expect(halfPx).toBeLessThan(fullPx)
    expect(halfPx).toBeGreaterThan(0)
  })
})

// ── drawSprite ────────────────────────────────────────────────────────────────

describe('drawSprite', () => {
  it('all-zero bitmap — exactly 1 fillRect (paper background only)', () => {
    const ctx = makeMockCtx()
    drawSprite(ctx, ALL_OFF, 0, 0, C.B_CYAN, C.BLACK)
    expect(ctx._rects).toHaveLength(1)
  })

  it('paper fillRect covers the full CELL×CELL area', () => {
    const ctx = makeMockCtx()
    drawSprite(ctx, ALL_OFF, 8, 16, C.B_CYAN, C.BLACK)
    expect(ctx._rects[0]).toMatchObject({ style: C.BLACK, x: 8, y: 16, w: CELL, h: CELL })
  })

  it('all-on bitmap — 1 paper + 64 ink = 65 fillRects', () => {
    const ctx = makeMockCtx()
    drawSprite(ctx, ALL_ON, 0, 0, C.B_WHITE, C.BLACK)
    expect(ctx._rects).toHaveLength(65)
  })

  it('ink pixels are 1×1 each', () => {
    const ctx = makeMockCtx()
    drawSprite(ctx, ALL_ON, 0, 0, C.B_CYAN, C.BLACK)
    const inkRects = ctx._rects.slice(1)  // skip paper
    for (const r of inkRects) {
      expect(r).toMatchObject({ w: 1, h: 1 })
    }
  })

  it('ink pixels use the provided ink color', () => {
    const ctx = makeMockCtx()
    drawSprite(ctx, ALL_ON, 0, 0, C.B_RED, C.BLACK)
    const inkRects = ctx._rects.slice(1)
    for (const r of inkRects) {
      expect(r.style).toBe(C.B_RED)
    }
  })

  it('respects x/y offset — paper fillRect starts at given coords', () => {
    const ctx = makeMockCtx()
    drawSprite(ctx, ALL_OFF, 24, 40, C.B_CYAN, C.BLACK)
    expect(ctx._rects[0]).toMatchObject({ x: 24, y: 40 })
  })
})

// ── drawChar ──────────────────────────────────────────────────────────────────

describe('drawChar', () => {
  // Char 127 = solid block (all rows 0xFF → all 64 pixels set)
  const SOLID_BLOCK = 127

  it('with paper — fills background first (1 paper + ink pixels)', () => {
    const ctx = makeMockCtx()
    drawChar(ctx, SOLID_BLOCK, 0, 0, C.B_WHITE, C.BLACK)
    expect(ctx._rects).toHaveLength(65)
    expect(ctx._rects[0]).toMatchObject({ style: C.BLACK, w: CELL, h: CELL })
  })

  it('without paper — no background fillRect, only ink pixels', () => {
    const ctx = makeMockCtx()
    drawChar(ctx, SOLID_BLOCK, 0, 0, C.B_WHITE)
    expect(ctx._rects).toHaveLength(64)
  })

  it('space char (32, all zeros) without paper — zero fillRects', () => {
    const ctx = makeMockCtx()
    drawChar(ctx, 32, 0, 0, C.B_WHITE)
    expect(ctx._rects).toHaveLength(0)
  })

  it('space char (32) with paper — exactly 1 fillRect (background only)', () => {
    const ctx = makeMockCtx()
    drawChar(ctx, 32, 0, 0, C.B_WHITE, C.BLACK)
    expect(ctx._rects).toHaveLength(1)
  })

  it('respects x/y position', () => {
    const ctx = makeMockCtx()
    drawChar(ctx, 32, 16, 24, C.B_WHITE, C.BLACK)
    expect(ctx._rects[0]).toMatchObject({ x: 16, y: 24 })
  })
})

// ── drawText ──────────────────────────────────────────────────────────────────

describe('drawText', () => {
  // Use space chars (code 32) — all-zero bitmaps — for predictable fillRect counts.
  // With paper: 1 fillRect per character. Without paper: 0.

  it('empty string — no fillRect calls', () => {
    const ctx = makeMockCtx()
    drawText(ctx, '', 0, 0, C.B_WHITE, C.BLACK)
    expect(ctx._rects).toHaveLength(0)
  })

  it('N space chars with paper → exactly N paper fillRects', () => {
    const ctx = makeMockCtx()
    drawText(ctx, '   ', 0, 0, C.B_WHITE, C.BLACK)  // 3 spaces
    expect(ctx._rects).toHaveLength(3)
  })

  it('characters are spaced CELL px apart horizontally', () => {
    const ctx = makeMockCtx()
    drawText(ctx, '   ', 0, 0, C.B_WHITE, C.BLACK)  // 3 spaces → 3 paper rects
    expect(ctx._rects[0].x).toBe(0)
    expect(ctx._rects[1].x).toBe(CELL)
    expect(ctx._rects[2].x).toBe(CELL * 2)
  })

  it('respects the x offset parameter', () => {
    const ctx = makeMockCtx()
    drawText(ctx, ' ', 32, 0, C.B_WHITE, C.BLACK)
    expect(ctx._rects[0].x).toBe(32)
  })

  it('respects the y parameter for all characters', () => {
    const ctx = makeMockCtx()
    drawText(ctx, '  ', 0, 16, C.B_WHITE, C.BLACK)
    expect(ctx._rects[0].y).toBe(16)
    expect(ctx._rects[1].y).toBe(16)
  })

  it('without paper — space chars produce no fillRects', () => {
    const ctx = makeMockCtx()
    drawText(ctx, '   ', 0, 0, C.B_WHITE)
    expect(ctx._rects).toHaveLength(0)
  })
})

// ── drawTextCentered ──────────────────────────────────────────────────────────

describe('drawTextCentered', () => {
  // x = Math.floor((cols - text.length) / 2) * CELL

  it('centers 2-char text in 10-col canvas → x = 32', () => {
    // floor((10-2)/2) * 8 = 4 * 8 = 32
    const ctx = makeMockCtx()
    drawTextCentered(ctx, '  ', 0, 10, C.B_WHITE, C.BLACK)
    expect(ctx._rects[0].x).toBe(32)
  })

  it('centers 1-char text in 5-col canvas → x = 16', () => {
    // floor((5-1)/2) * 8 = 2 * 8 = 16
    const ctx = makeMockCtx()
    drawTextCentered(ctx, ' ', 0, 5, C.B_WHITE, C.BLACK)
    expect(ctx._rects[0].x).toBe(16)
  })

  it('text same width as canvas → x = 0', () => {
    // floor((4-4)/2) * 8 = 0
    const ctx = makeMockCtx()
    drawTextCentered(ctx, '    ', 0, 4, C.B_WHITE, C.BLACK)
    expect(ctx._rects[0].x).toBe(0)
  })

  it('respects y parameter', () => {
    const ctx = makeMockCtx()
    drawTextCentered(ctx, ' ', 24, 5, C.B_WHITE, C.BLACK)
    expect(ctx._rects[0].y).toBe(24)
  })

  it('forwards paper to drawText — 1 paper fillRect per space char', () => {
    const ctx = makeMockCtx()
    drawTextCentered(ctx, '  ', 0, 10, C.B_WHITE, C.BLACK)
    expect(ctx._rects).toHaveLength(2)
  })

  it('without paper — space chars produce no fillRects', () => {
    const ctx = makeMockCtx()
    drawTextCentered(ctx, '  ', 0, 10, C.B_WHITE)
    expect(ctx._rects).toHaveLength(0)
  })
})

// ── drawScanlines ─────────────────────────────────────────────────────────────

describe('drawScanlines', () => {
  it('calls ctx.save() and ctx.restore()', () => {
    const ctx = makeMockCtx(32, 10)
    drawScanlines(ctx)
    expect(ctx.save).toHaveBeenCalledOnce()
    expect(ctx.restore).toHaveBeenCalledOnce()
  })

  it('resets transform to identity matrix', () => {
    const ctx = makeMockCtx(32, 10)
    drawScanlines(ctx)
    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0)
  })

  it('draws one horizontal line per every-other physical row starting at y=1', () => {
    // canvas height=10 → rows y=1,3,5,7,9 → 5 fillRects
    const ctx = makeMockCtx(32, 10)
    drawScanlines(ctx)
    expect(ctx._rects).toHaveLength(5)
    const ys = ctx._rects.map(r => r.y)
    expect(ys).toEqual([1, 3, 5, 7, 9])
  })

  it('each scanline spans the full canvas width', () => {
    const ctx = makeMockCtx(64, 4)
    drawScanlines(ctx)
    for (const r of ctx._rects) expect(r.w).toBe(64)
  })

  it('each scanline is 1 pixel tall', () => {
    const ctx = makeMockCtx(32, 6)
    drawScanlines(ctx)
    for (const r of ctx._rects) expect(r.h).toBe(1)
  })

  it('default alpha is 0.25', () => {
    const ctx = makeMockCtx(32, 4)
    drawScanlines(ctx)
    expect(ctx._rects[0].style).toBe('rgba(0,0,0,0.25)')
  })

  it('custom alpha is used in fillStyle', () => {
    const ctx = makeMockCtx(32, 4)
    drawScanlines(ctx, 0.5)
    expect(ctx._rects[0].style).toBe('rgba(0,0,0,0.5)')
  })

  it('even-height canvas — correct line count (height/2)', () => {
    // height=8 → y=1,3,5,7 → 4 lines
    const ctx = makeMockCtx(32, 8)
    drawScanlines(ctx)
    expect(ctx._rects).toHaveLength(4)
  })
})

// ── flashBorder ───────────────────────────────────────────────────────────────

function stubBody() {
  const style = { backgroundColor: '' }
  vi.stubGlobal('document', { body: { style } })
  return style
}

describe('flashBorder', () => {
  it('sets body color on the first interval tick', () => {
    vi.useFakeTimers()
    const style = stubBody()
    flashBorder(C.B_RED, 2, 100)
    vi.advanceTimersByTime(100)
    expect(style.backgroundColor).toBe(C.B_RED)
  })

  it('alternates to resetColor on the second tick', () => {
    vi.useFakeTimers()
    const style = stubBody()
    flashBorder(C.B_RED, 2, 100)
    vi.advanceTimersByTime(200)
    expect(style.backgroundColor).toBe(C.BLACK)  // default resetColor
  })

  it('ends with resetColor after all steps complete', () => {
    vi.useFakeTimers()
    const style = stubBody()
    flashBorder(C.B_RED, 2, 100)          // 2 flashes = 4 steps
    vi.advanceTimersByTime(400)
    expect(style.backgroundColor).toBe(C.BLACK)
  })

  it('default resetColor is C.BLACK', () => {
    vi.useFakeTimers()
    const style = stubBody()
    flashBorder(C.B_WHITE, 1, 100)
    vi.advanceTimersByTime(200)
    expect(style.backgroundColor).toBe(C.BLACK)
  })

  it('respects a custom resetColor', () => {
    vi.useFakeTimers()
    const style = stubBody()
    flashBorder(C.B_WHITE, 1, 100, C.B_BLUE)
    vi.advanceTimersByTime(200)
    expect(style.backgroundColor).toBe(C.B_BLUE)
  })

  it('cancels a running flash when called again — only the new flash runs', () => {
    vi.useFakeTimers()
    const style = stubBody()
    flashBorder(C.B_RED, 10, 100)    // long flash — should be cancelled
    vi.advanceTimersByTime(100)       // 1 tick of RED flash fires
    flashBorder(C.B_GREEN, 1, 50)    // cancel RED, start GREEN
    vi.advanceTimersByTime(100)       // GREEN completes (2 ticks × 50ms)
    expect(style.backgroundColor).toBe(C.BLACK)  // GREEN finished with default resetColor
  })

  it('no interval fires before first intervalMs', () => {
    vi.useFakeTimers()
    const style = stubBody()
    flashBorder(C.B_RED, 2, 100)
    vi.advanceTimersByTime(99)        // just before first tick
    expect(style.backgroundColor).toBe('')  // still untouched
  })
})
