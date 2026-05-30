import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { C, CELL } from '../src/palette.js'
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
  createBitmap,
  createBitmapFromRows,
  drawBitmap,
  mirrorBitmap,
  createAttrMap,
  drawBitmapAttrs,
  mirrorAttrMap,
} from '../src/renderer.js'

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

// ── createBitmapFromRows ─────────────────────────────────────────────────────

describe('createBitmapFromRows', () => {
  it('converts readable rows to bitmap data', () => {
    const bitmap = createBitmapFromRows([
      'X......X',
      '.X....X.',
      '..X..X..',
      '...XX...',
    ])

    expect(bitmap.width).toBe(8)
    expect(bitmap.height).toBe(4)
    expect([...bitmap.data]).toEqual([
      0b10000001,
      0b01000010,
      0b00100100,
      0b00011000,
    ])
  })

  it('supports # as solid pixels and spaces as transparent pixels', () => {
    const bitmap = createBitmapFromRows([
      '#      #',
      ' ###### ',
    ])

    expect([...bitmap.data]).toEqual([
      0b10000001,
      0b01111110,
    ])
  })

  it('supports widths wider than one byte', () => {
    const bitmap = createBitmapFromRows([
      'X.......X.......',
      '...............X',
    ])

    expect(bitmap.width).toBe(16)
    expect(bitmap.height).toBe(2)
    expect([...bitmap.data]).toEqual([
      0b10000000, 0b10000000,
      0b00000000, 0b00000001,
    ])
  })

  it('throws when rows are empty', () => {
    expect(() => createBitmapFromRows([])).toThrow(/rows must not be empty/)
  })

  it('throws when row width is not byte-aligned', () => {
    expect(() => createBitmapFromRows(['XXXX'])).toThrow(/multiple of 8/)
  })

  it('throws when row lengths differ', () => {
    expect(() => createBitmapFromRows([
      'XXXXXXXX',
      'XXXXXXX.',
      'XXXXXXX',
    ])).toThrow(/row 2 length mismatch/)
  })

  it('throws when a row contains an unsupported character', () => {
    expect(() => createBitmapFromRows(['XXX@XXXX'])).toThrow(/invalid pixel '@' at row 0, col 3/)
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

  it('throws with a clear message when getContext returns null', () => {
    const canvas = {
      width: 0, height: 0,
      style: { width: '', height: '' },
      getContext: vi.fn().mockReturnValue(null),
    } as unknown as HTMLCanvasElement
    expect(() => setupCanvas(canvas, 4))
      .toThrow(/setupCanvas: failed to obtain a 2D context/)
  })

  it('thrown error mentions WebGL as a possible cause', () => {
    const canvas = {
      width: 0, height: 0,
      style: { width: '', height: '' },
      getContext: vi.fn().mockReturnValue(null),
    } as unknown as HTMLCanvasElement
    expect(() => setupCanvas(canvas, 4)).toThrow(/WebGL/)
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
  // Node test env has no requestAnimationFrame — polyfill it via setTimeout(1ms),
  // which vi.useFakeTimers DOES fake. Each "frame" drives 1ms of fake-clock time,
  // giving us deterministic, fine-grained control inside vi.advanceTimersByTime.
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now()), 1) as unknown as number
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('sets body color once the first interval has elapsed', () => {
    const style = stubBody()
    flashBorder(C.B_RED, 2, 100)
    vi.advanceTimersByTime(100)
    expect(style.backgroundColor).toBe(C.B_RED)
  })

  it('alternates to resetColor after the second interval', () => {
    const style = stubBody()
    flashBorder(C.B_RED, 2, 100)
    vi.advanceTimersByTime(200)
    expect(style.backgroundColor).toBe(C.BLACK)  // default resetColor
  })

  it('ends with resetColor after all steps complete', () => {
    const style = stubBody()
    flashBorder(C.B_RED, 2, 100)          // 2 flashes = 4 steps
    vi.advanceTimersByTime(400)
    expect(style.backgroundColor).toBe(C.BLACK)
  })

  it('default resetColor is C.BLACK', () => {
    const style = stubBody()
    flashBorder(C.B_WHITE, 1, 100)
    vi.advanceTimersByTime(200)
    expect(style.backgroundColor).toBe(C.BLACK)
  })

  it('respects a custom resetColor', () => {
    const style = stubBody()
    flashBorder(C.B_WHITE, 1, 100, C.B_BLUE)
    vi.advanceTimersByTime(200)
    expect(style.backgroundColor).toBe(C.B_BLUE)
  })

  it('cancels a running flash when called again — only the new flash runs', () => {
    const style = stubBody()
    flashBorder(C.B_RED, 10, 100)    // long flash — should be cancelled
    vi.advanceTimersByTime(100)       // 1 tick of RED flash fires
    flashBorder(C.B_GREEN, 1, 50)    // cancel RED, start GREEN
    vi.advanceTimersByTime(100)       // GREEN completes (2 ticks × 50ms)
    expect(style.backgroundColor).toBe(C.BLACK)  // GREEN finished with default resetColor
  })

  it('does not touch body before the first intervalMs has elapsed', () => {
    const style = stubBody()
    flashBorder(C.B_RED, 2, 100)
    vi.advanceTimersByTime(99)        // just before first interval
    expect(style.backgroundColor).toBe('')  // still untouched
  })
})

// ── createBitmap ──────────────────────────────────────────────────────────────

describe('createBitmap — validation', () => {
  it('accepts 16×16 (32 bytes)', () => {
    const bm = createBitmap(new Uint8Array(32), 16, 16)
    expect(bm.width).toBe(16)
    expect(bm.height).toBe(16)
    expect(bm.data.length).toBe(32)
  })

  it('accepts 16×24 (48 bytes — Jetman size)', () => {
    const bm = createBitmap(new Uint8Array(48), 16, 24)
    expect(bm.width).toBe(16)
    expect(bm.height).toBe(24)
  })

  it('accepts 24×24 (72 bytes)', () => {
    expect(() => createBitmap(new Uint8Array(72), 24, 24)).not.toThrow()
  })

  it('accepts 32×32 (128 bytes)', () => {
    expect(() => createBitmap(new Uint8Array(128), 32, 32)).not.toThrow()
  })

  it('accepts 8×8 edge case (8 bytes)', () => {
    expect(() => createBitmap(new Uint8Array(8), 8, 8)).not.toThrow()
  })

  it('throws when width is not a multiple of 8', () => {
    expect(() => createBitmap(new Uint8Array(12), 12, 8)).toThrow(/multiple of 8/)
  })

  it('throws when width is 0', () => {
    expect(() => createBitmap(new Uint8Array(0), 0, 8)).toThrow(/positive/)
  })

  it('throws when width is negative', () => {
    expect(() => createBitmap(new Uint8Array(8), -8, 8)).toThrow(/positive/)
  })

  it('throws when width is non-integer', () => {
    expect(() => createBitmap(new Uint8Array(16), 16.5, 8)).toThrow(/multiple of 8/)
  })

  it('throws when height is 0', () => {
    expect(() => createBitmap(new Uint8Array(0), 8, 0)).toThrow(/positive integer/)
  })

  it('throws when height is negative', () => {
    expect(() => createBitmap(new Uint8Array(8), 8, -1)).toThrow(/positive integer/)
  })

  it('throws when height is non-integer', () => {
    expect(() => createBitmap(new Uint8Array(8), 8, 1.5)).toThrow(/positive integer/)
  })

  it('throws when data length is too short', () => {
    expect(() => createBitmap(new Uint8Array(10), 16, 16)).toThrow(/length mismatch.*expected 32.*got 10/)
  })

  it('throws when data length is too long', () => {
    expect(() => createBitmap(new Uint8Array(100), 16, 16)).toThrow(/length mismatch.*expected 32.*got 100/)
  })

  it('keeps the same underlying Uint8Array reference', () => {
    const data = new Uint8Array(32)
    const bm = createBitmap(data, 16, 16)
    expect(bm.data).toBe(data)
  })
})

// ── drawBitmap ────────────────────────────────────────────────────────────────

describe('drawBitmap — transparent background (no paper)', () => {
  it('all-zero 16×16 → 0 fillRects', () => {
    const ctx = makeMockCtx()
    const bm = createBitmap(new Uint8Array(32), 16, 16)
    drawBitmap(ctx, bm, 0, 0, C.B_WHITE)
    expect(ctx._rects).toHaveLength(0)
  })

  it('all-ones 16×16 → 256 ink fillRects (every pixel)', () => {
    const ctx = makeMockCtx()
    const bm = createBitmap(new Uint8Array(32).fill(0xFF), 16, 16)
    drawBitmap(ctx, bm, 0, 0, C.B_WHITE)
    expect(ctx._rects).toHaveLength(256)
    expect(ctx._rects[0].style).toBe(C.B_WHITE)
  })

  it('single pixel at top-left (byte 0, bit 7) → fillRect at (x, y)', () => {
    const ctx = makeMockCtx()
    const data = new Uint8Array(32); data[0] = 0x80
    const bm = createBitmap(data, 16, 16)
    drawBitmap(ctx, bm, 10, 20, C.B_RED)
    expect(ctx._rects).toHaveLength(1)
    expect(ctx._rects[0]).toMatchObject({ style: C.B_RED, x: 10, y: 20, w: 1, h: 1 })
  })

  it('single pixel at far right of 16-wide bitmap (byte 1, bit 0) → fillRect at (x+15, y)', () => {
    const ctx = makeMockCtx()
    const data = new Uint8Array(32); data[1] = 0x01
    const bm = createBitmap(data, 16, 16)
    drawBitmap(ctx, bm, 0, 0, C.B_CYAN)
    expect(ctx._rects[0]).toMatchObject({ x: 15, y: 0 })
  })

  it('single pixel at bottom row of 16×16 → fillRect at (x, y+15)', () => {
    const ctx = makeMockCtx()
    const data = new Uint8Array(32); data[30] = 0x80   // row 15, byte 0
    const bm = createBitmap(data, 16, 16)
    drawBitmap(ctx, bm, 0, 0, C.B_GREEN)
    expect(ctx._rects[0]).toMatchObject({ x: 0, y: 15 })
  })

  it('respects x/y offsets — all pixels shift uniformly', () => {
    const ctx = makeMockCtx()
    const data = new Uint8Array(32); data[0] = 0xFF    // row 0 entirely set in byte 0
    const bm = createBitmap(data, 16, 16)
    drawBitmap(ctx, bm, 100, 50, C.B_WHITE)
    for (let i = 0; i < 8; i++) {
      expect(ctx._rects[i]).toMatchObject({ x: 100 + i, y: 50 })
    }
  })
})

describe('drawBitmap — opaque background (paper)', () => {
  it('all-zero with paper → 1 paper fillRect covering full size', () => {
    const ctx = makeMockCtx()
    const bm = createBitmap(new Uint8Array(48), 16, 24)
    drawBitmap(ctx, bm, 4, 8, C.B_WHITE, C.BLACK)
    expect(ctx._rects).toHaveLength(1)
    expect(ctx._rects[0]).toMatchObject({ style: C.BLACK, x: 4, y: 8, w: 16, h: 24 })
  })

  it('all-ones 16×24 with paper → 1 paper + 384 ink = 385 fillRects', () => {
    const ctx = makeMockCtx()
    const bm = createBitmap(new Uint8Array(48).fill(0xFF), 16, 24)
    drawBitmap(ctx, bm, 0, 0, C.B_WHITE, C.BLACK)
    expect(ctx._rects).toHaveLength(1 + 16 * 24)
    expect(ctx._rects[0].style).toBe(C.BLACK)
    expect(ctx._rects[1].style).toBe(C.B_WHITE)
  })

  it('32×32 paper bounding box is correct', () => {
    const ctx = makeMockCtx(64, 64)
    const bm = createBitmap(new Uint8Array(128), 32, 32)
    drawBitmap(ctx, bm, 0, 0, C.B_WHITE, C.B_BLUE)
    expect(ctx._rects[0]).toMatchObject({ style: C.B_BLUE, w: 32, h: 32 })
  })
})

describe('drawBitmap — inkOnly (suppress paper box bleed)', () => {
  it('all-zero with paper + inkOnly → 0 fillRects (paper box suppressed)', () => {
    const ctx = makeMockCtx()
    const bm = createBitmap(new Uint8Array(48), 16, 24)
    drawBitmap(ctx, bm, 4, 8, C.B_WHITE, C.BLACK, true)
    expect(ctx._rects).toHaveLength(0)
  })

  it('all-ones with paper + inkOnly → 384 ink fillRects, no paper rect', () => {
    const ctx = makeMockCtx()
    const bm = createBitmap(new Uint8Array(48).fill(0xFF), 16, 24)
    drawBitmap(ctx, bm, 0, 0, C.B_WHITE, C.BLACK, true)
    expect(ctx._rects).toHaveLength(16 * 24)
    // No 16×24 paper bounding rect anywhere
    expect(ctx._rects.some(r => r.w === 16 && r.h === 24)).toBe(false)
    for (const r of ctx._rects) expect(r.style).toBe(C.B_WHITE)
  })

  it('single pixel with paper + inkOnly → 1 ink fillRect at the pixel, never paper', () => {
    const ctx = makeMockCtx()
    const data = new Uint8Array(32); data[0] = 0x80   // pixel at (0, 0)
    const bm = createBitmap(data, 16, 16)
    drawBitmap(ctx, bm, 10, 20, C.B_RED, C.BLACK, true)
    expect(ctx._rects).toHaveLength(1)
    expect(ctx._rects[0]).toMatchObject({ style: C.B_RED, x: 10, y: 20, w: 1, h: 1 })
  })

  it('inkOnly defaults to false — paper box still filled when omitted', () => {
    const ctx = makeMockCtx()
    const bm = createBitmap(new Uint8Array(48), 16, 24)
    drawBitmap(ctx, bm, 0, 0, C.B_WHITE, C.BLACK)
    expect(ctx._rects).toHaveLength(1)
    expect(ctx._rects[0]).toMatchObject({ style: C.BLACK, w: 16, h: 24 })
  })

  it('inkOnly without paper behaves identically to transparent', () => {
    const ctx1 = makeMockCtx()
    const ctx2 = makeMockCtx()
    const data = new Uint8Array(32); data[0] = 0x80
    const bm = createBitmap(data, 16, 16)
    drawBitmap(ctx1, bm, 5, 5, C.B_CYAN)              // transparent (no paper)
    drawBitmap(ctx2, bm, 5, 5, C.B_CYAN, undefined, true)  // inkOnly
    expect(ctx2._rects).toEqual(ctx1._rects)
  })
})

describe('drawBitmap — works for non-square sizes', () => {
  it('24×8 — 3 bytes per row, single row', () => {
    const ctx = makeMockCtx()
    const data = new Uint8Array(3); data[2] = 0x01   // last byte, bit 0 → x=23
    const bm = createBitmap(data, 24, 1)
    drawBitmap(ctx, bm, 0, 0, C.B_WHITE)
    expect(ctx._rects).toHaveLength(1)
    expect(ctx._rects[0]).toMatchObject({ x: 23, y: 0 })
  })

  it('8×32 — tall narrow bitmap', () => {
    const ctx = makeMockCtx()
    const data = new Uint8Array(32).fill(0x80)   // leftmost pixel of every row
    const bm = createBitmap(data, 8, 32)
    drawBitmap(ctx, bm, 0, 0, C.B_WHITE)
    expect(ctx._rects).toHaveLength(32)
    expect(ctx._rects[31]).toMatchObject({ x: 0, y: 31 })
  })
})

// ── mirrorBitmap ──────────────────────────────────────────────────────────────

describe('mirrorBitmap — basic flips', () => {
  it('single pixel at top-left moves to top-right (16-wide)', () => {
    const data = new Uint8Array(32); data[0] = 0x80   // (0, 0)
    const src = createBitmap(data, 16, 16)
    const mirrored = mirrorBitmap(src)
    // Should now be at byte 1, bit 0 → (15, 0)
    expect(mirrored.data[0]).toBe(0)
    expect(mirrored.data[1]).toBe(0x01)
  })

  it('single pixel at top-right moves to top-left', () => {
    const data = new Uint8Array(32); data[1] = 0x01   // (15, 0)
    const src = createBitmap(data, 16, 16)
    const mirrored = mirrorBitmap(src)
    expect(mirrored.data[0]).toBe(0x80)
    expect(mirrored.data[1]).toBe(0)
  })

  it('preserves width and height', () => {
    const src = createBitmap(new Uint8Array(48), 16, 24)
    const mirrored = mirrorBitmap(src)
    expect(mirrored.width).toBe(16)
    expect(mirrored.height).toBe(24)
  })

  it('double-mirror is a no-op (data equality)', () => {
    const data = new Uint8Array(32)
    // Some asymmetric pattern
    data[0] = 0b10110100
    data[1] = 0b01001011
    data[20] = 0b11110000
    data[21] = 0b00001111
    const src = createBitmap(data, 16, 16)
    const restored = mirrorBitmap(mirrorBitmap(src))
    for (let i = 0; i < 32; i++) {
      expect(restored.data[i]).toBe(data[i])
    }
  })

  it('does not mutate source bitmap', () => {
    const data = new Uint8Array(32); data[0] = 0x80
    const src = createBitmap(data, 16, 16)
    mirrorBitmap(src)
    expect(src.data[0]).toBe(0x80)
    expect(src.data[1]).toBe(0)
  })

  it('returns a new underlying Uint8Array (not aliased)', () => {
    const src = createBitmap(new Uint8Array(32), 16, 16)
    const mirrored = mirrorBitmap(src)
    expect(mirrored.data).not.toBe(src.data)
  })
})

describe('mirrorBitmap — multi-byte rows', () => {
  it('32-wide row with pattern across all 4 bytes reverses correctly', () => {
    // row 0: bytes [0xFF, 0x00, 0x00, 0x01]
    // mirrored row 0: bytes [0x80, 0x00, 0x00, 0xFF]
    const data = new Uint8Array(128)   // 32×32 = 128 bytes
    data[0] = 0xFF; data[1] = 0x00; data[2] = 0x00; data[3] = 0x01
    const src = createBitmap(data, 32, 32)
    const m = mirrorBitmap(src)
    expect(m.data[0]).toBe(0x80)
    expect(m.data[1]).toBe(0x00)
    expect(m.data[2]).toBe(0x00)
    expect(m.data[3]).toBe(0xFF)
  })

  it('16×24 — each row mirrored independently', () => {
    const data = new Uint8Array(48)
    // Row 0: pixel at (0, 0)   → byte 0, bit 7
    data[0] = 0x80
    // Row 23 (last): pixel at (15, 23)  → byte 47, bit 0
    data[47] = 0x01
    const src = createBitmap(data, 16, 24)
    const m = mirrorBitmap(src)
    // After mirror: row 0 pixel at (15, 0); row 23 pixel at (0, 23)
    expect(m.data[1]).toBe(0x01)
    expect(m.data[46]).toBe(0x80)
  })
})

describe('drawBitmap + mirrorBitmap — round-trip rendering', () => {
  it('mirrored bitmap renders mirrored pixel positions', () => {
    const ctx1 = makeMockCtx()
    const ctx2 = makeMockCtx()
    const data = new Uint8Array(32); data[0] = 0x80   // pixel at (0, 0)
    const original = createBitmap(data, 16, 16)
    const mirrored = mirrorBitmap(original)

    drawBitmap(ctx1, original, 0, 0, C.B_WHITE)
    drawBitmap(ctx2, mirrored, 0, 0, C.B_WHITE)

    expect(ctx1._rects[0]).toMatchObject({ x: 0, y: 0 })
    expect(ctx2._rects[0]).toMatchObject({ x: 15, y: 0 })
  })
})

// ── createAttrMap ─────────────────────────────────────────────────────────────

describe('createAttrMap — validation', () => {
  it('accepts 1×1 attribute map', () => {
    const a = createAttrMap(1, 1, [C.B_WHITE], C.BLACK)
    expect(a.cols).toBe(1)
    expect(a.rows).toBe(1)
    expect(a.inks.length).toBe(1)
    expect(a.papers!.length).toBe(1)
  })

  it('accepts 2×3 (16×24 hero map)', () => {
    const inks = [C.B_YELLOW, C.B_YELLOW, C.B_RED, C.B_RED, C.B_BLUE, C.B_BLUE]
    const a = createAttrMap(2, 3, inks, C.BLACK)
    expect(a.cols).toBe(2)
    expect(a.rows).toBe(3)
    expect(a.inks).toEqual(inks)
  })

  it('accepts 12×16 (96×128 boss map = 192 cells)', () => {
    const inks = new Array(192).fill(C.B_MAGENTA)
    const a = createAttrMap(12, 16, inks, C.BLACK)
    expect(a.inks.length).toBe(192)
  })

  it('expands single-colour paper shorthand into per-cell array', () => {
    const a = createAttrMap(2, 2, [C.B_WHITE, C.B_WHITE, C.B_WHITE, C.B_WHITE], C.BLACK)
    expect(a.papers).toEqual([C.BLACK, C.BLACK, C.BLACK, C.BLACK])
  })

  it('accepts explicit per-cell papers array', () => {
    const papers = [C.BLACK, C.RED, C.BLUE, C.GREEN]
    const a = createAttrMap(2, 2, [C.B_WHITE, C.B_WHITE, C.B_WHITE, C.B_WHITE], papers)
    expect(a.papers).toEqual(papers)
  })

  it('papers omitted → undefined (transparent attribute map)', () => {
    const a = createAttrMap(2, 2, [C.B_WHITE, C.B_WHITE, C.B_WHITE, C.B_WHITE])
    expect(a.papers).toBeUndefined()
  })

  it('throws on inks length mismatch', () => {
    expect(() => createAttrMap(2, 3, [C.B_WHITE], C.BLACK))
      .toThrow(/inks length mismatch.*expected 6.*got 1/)
  })

  it('throws on papers length mismatch', () => {
    expect(() => createAttrMap(2, 2, [C.B_WHITE, C.B_WHITE, C.B_WHITE, C.B_WHITE], [C.BLACK]))
      .toThrow(/papers length mismatch.*expected 4.*got 1/)
  })

  it('throws on non-integer cols', () => {
    expect(() => createAttrMap(1.5, 2, [], C.BLACK)).toThrow(/positive integer/)
  })

  it('throws on cols = 0', () => {
    expect(() => createAttrMap(0, 2, [], C.BLACK)).toThrow(/positive integer/)
  })

  it('throws on rows = 0', () => {
    expect(() => createAttrMap(2, 0, [], C.BLACK)).toThrow(/positive integer/)
  })

  it('throws on negative rows', () => {
    expect(() => createAttrMap(2, -1, [], C.BLACK)).toThrow(/positive integer/)
  })
})

// ── drawBitmapAttrs ───────────────────────────────────────────────────────────

describe('drawBitmapAttrs — dimension validation', () => {
  it('throws when attr dimensions do not match bitmap', () => {
    const ctx = makeMockCtx()
    const bm = createBitmap(new Uint8Array(32), 16, 16)       // 2×2 cells
    const attrs = createAttrMap(2, 3, new Array(6).fill(C.B_WHITE), C.BLACK)
    expect(() => drawBitmapAttrs(ctx, bm, attrs, 0, 0))
      .toThrow(/attr dimensions 2×3.*do not match bitmap 16×16/)
  })

  it('accepts matching 16×16 bitmap with 2×2 attrs', () => {
    const ctx = makeMockCtx()
    const bm = createBitmap(new Uint8Array(32), 16, 16)
    const attrs = createAttrMap(2, 2, new Array(4).fill(C.B_WHITE), C.BLACK)
    expect(() => drawBitmapAttrs(ctx, bm, attrs, 0, 0)).not.toThrow()
  })
})

describe('drawBitmapAttrs — opaque per-cell rendering', () => {
  it('16×16 all-zero → exactly 4 paper fillRects (one per cell)', () => {
    const ctx = makeMockCtx()
    const bm = createBitmap(new Uint8Array(32), 16, 16)
    const attrs = createAttrMap(2, 2, new Array(4).fill(C.B_WHITE), C.BLACK)
    drawBitmapAttrs(ctx, bm, attrs, 0, 0)
    expect(ctx._rects).toHaveLength(4)
    for (const r of ctx._rects) expect(r.style).toBe(C.BLACK)
  })

  it('16×16 all-ones → 4 paper + 256 ink = 260 fillRects', () => {
    const ctx = makeMockCtx()
    const bm = createBitmap(new Uint8Array(32).fill(0xFF), 16, 16)
    const attrs = createAttrMap(2, 2, new Array(4).fill(C.B_YELLOW), C.BLACK)
    drawBitmapAttrs(ctx, bm, attrs, 0, 0)
    expect(ctx._rects).toHaveLength(4 + 256)
  })

  it('per-cell paper rect size is exactly 8×8', () => {
    const ctx = makeMockCtx()
    const bm = createBitmap(new Uint8Array(32), 16, 16)
    const attrs = createAttrMap(2, 2, new Array(4).fill(C.B_WHITE), C.BLACK)
    drawBitmapAttrs(ctx, bm, attrs, 100, 50)
    expect(ctx._rects[0]).toMatchObject({ x: 100, y: 50, w: 8, h: 8 })
    expect(ctx._rects[1]).toMatchObject({ x: 108, y: 50, w: 8, h: 8 })
    expect(ctx._rects[2]).toMatchObject({ x: 100, y: 58, w: 8, h: 8 })
    expect(ctx._rects[3]).toMatchObject({ x: 108, y: 58, w: 8, h: 8 })
  })

  it('different ink per cell → ink colour matches cell index', () => {
    const ctx = makeMockCtx()
    // Each cell has 1 pixel set at its top-left position
    const data = new Uint8Array(32)
    data[0]  = 0x80   // cell (0,0) top-left pixel
    data[1]  = 0x80   // cell (1,0) top-left pixel
    data[16] = 0x80   // cell (0,1) top-left pixel (row 8, byte 0)
    data[17] = 0x80   // cell (1,1) top-left pixel (row 8, byte 1)
    const bm = createBitmap(data, 16, 16)
    const attrs = createAttrMap(2, 2, [C.B_WHITE, C.B_CYAN, C.B_GREEN, C.B_RED], C.BLACK)
    drawBitmapAttrs(ctx, bm, attrs, 0, 0)
    // Order: cell (0,0) paper + ink, (1,0) paper + ink, (0,1), (1,1)
    // Ink rects (1×1): after each cell's paper fill
    const inkRects = ctx._rects.filter(r => r.w === 1)
    expect(inkRects).toHaveLength(4)
    expect(inkRects[0].style).toBe(C.B_WHITE)
    expect(inkRects[1].style).toBe(C.B_CYAN)
    expect(inkRects[2].style).toBe(C.B_GREEN)
    expect(inkRects[3].style).toBe(C.B_RED)
  })

  it('different paper per cell → paper colour matches cell index', () => {
    const ctx = makeMockCtx()
    const bm = createBitmap(new Uint8Array(32), 16, 16)
    const papers = [C.BLACK, C.RED, C.BLUE, C.GREEN]
    const attrs = createAttrMap(2, 2, new Array(4).fill(C.B_WHITE), papers)
    drawBitmapAttrs(ctx, bm, attrs, 0, 0)
    expect(ctx._rects[0].style).toBe(C.BLACK)
    expect(ctx._rects[1].style).toBe(C.RED)
    expect(ctx._rects[2].style).toBe(C.BLUE)
    expect(ctx._rects[3].style).toBe(C.GREEN)
  })
})

describe('drawBitmapAttrs — transparent (no papers)', () => {
  it('all-zero bitmap with no papers → 0 fillRects', () => {
    const ctx = makeMockCtx()
    const bm = createBitmap(new Uint8Array(32), 16, 16)
    const attrs = createAttrMap(2, 2, new Array(4).fill(C.B_WHITE))
    drawBitmapAttrs(ctx, bm, attrs, 0, 0)
    expect(ctx._rects).toHaveLength(0)
  })

  it('all-ones with no papers → 256 ink fillRects (no paper fills)', () => {
    const ctx = makeMockCtx()
    const bm = createBitmap(new Uint8Array(32).fill(0xFF), 16, 16)
    const attrs = createAttrMap(2, 2, new Array(4).fill(C.B_WHITE))
    drawBitmapAttrs(ctx, bm, attrs, 0, 0)
    expect(ctx._rects).toHaveLength(256)
  })
})

describe('drawBitmapAttrs — inkOnly (keep per-cell ink, suppress paper blocks)', () => {
  it('all-zero with papers + inkOnly → 0 fillRects (no 8×8 paper blocks)', () => {
    const ctx = makeMockCtx()
    const bm = createBitmap(new Uint8Array(32), 16, 16)
    const attrs = createAttrMap(2, 2, new Array(4).fill(C.B_WHITE), C.BLACK)
    drawBitmapAttrs(ctx, bm, attrs, 0, 0, true)
    expect(ctx._rects).toHaveLength(0)
  })

  it('all-ones with papers + inkOnly → 256 ink fillRects, none 8×8', () => {
    const ctx = makeMockCtx()
    const bm = createBitmap(new Uint8Array(32).fill(0xFF), 16, 16)
    const attrs = createAttrMap(2, 2, new Array(4).fill(C.B_YELLOW), C.BLACK)
    drawBitmapAttrs(ctx, bm, attrs, 0, 0, true)
    expect(ctx._rects).toHaveLength(256)
    expect(ctx._rects.some(r => r.w === 8 && r.h === 8)).toBe(false)
    for (const r of ctx._rects) expect(r.style).toBe(C.B_YELLOW)
  })

  it('per-cell ink colours are preserved under inkOnly', () => {
    const ctx = makeMockCtx()
    const data = new Uint8Array(32)
    data[0]  = 0x80   // cell (0,0)
    data[1]  = 0x80   // cell (1,0)
    data[16] = 0x80   // cell (0,1)
    data[17] = 0x80   // cell (1,1)
    const bm = createBitmap(data, 16, 16)
    const attrs = createAttrMap(2, 2, [C.B_WHITE, C.B_CYAN, C.B_GREEN, C.B_RED], C.BLACK)
    drawBitmapAttrs(ctx, bm, attrs, 0, 0, true)
    // Only ink pixels remain — no paper fills to interleave
    expect(ctx._rects).toHaveLength(4)
    expect(ctx._rects.map(r => r.style)).toEqual([C.B_WHITE, C.B_CYAN, C.B_GREEN, C.B_RED])
  })

  it('inkOnly defaults to false — per-cell paper blocks still filled', () => {
    const ctx = makeMockCtx()
    const bm = createBitmap(new Uint8Array(32), 16, 16)
    const attrs = createAttrMap(2, 2, new Array(4).fill(C.B_WHITE), C.BLACK)
    drawBitmapAttrs(ctx, bm, attrs, 0, 0)
    expect(ctx._rects).toHaveLength(4)
    for (const r of ctx._rects) expect(r).toMatchObject({ w: 8, h: 8 })
  })

  it('inkOnly matches a paper-less AttrMap pixel-for-pixel', () => {
    const ctx1 = makeMockCtx()
    const ctx2 = makeMockCtx()
    const bm = createBitmap(new Uint8Array(32).fill(0xFF), 16, 16)
    const inks = [C.B_WHITE, C.B_CYAN, C.B_GREEN, C.B_RED]
    drawBitmapAttrs(ctx1, bm, createAttrMap(2, 2, inks), 0, 0)         // built paper-less
    drawBitmapAttrs(ctx2, bm, createAttrMap(2, 2, inks, C.BLACK), 0, 0, true)  // papers suppressed
    expect(ctx2._rects).toEqual(ctx1._rects)
  })

  it('still throws on dimension mismatch even with inkOnly set', () => {
    // inkOnly changes what is painted, never the validation contract.
    const ctx = makeMockCtx()
    const bm = createBitmap(new Uint8Array(32), 16, 16)               // 2×2 cells
    const attrs = createAttrMap(2, 3, new Array(6).fill(C.B_WHITE), C.BLACK)
    expect(() => drawBitmapAttrs(ctx, bm, attrs, 0, 0, true))
      .toThrow(/attr dimensions 2×3.*do not match bitmap 16×16/)
  })
})

describe('drawBitmapAttrs — 16×24 hero (canonical Spectrum sprite)', () => {
  // 16×24 hero with 3 colour bands: yellow head, red body, blue legs
  const HERO_BYTES = (() => {
    const d = new Uint8Array(48)
    // Just a vertical line of pixels through each row, byte 0 bit 7
    for (let row = 0; row < 24; row++) d[row * 2] = 0x80
    return d
  })()
  const HERO = createBitmap(HERO_BYTES, 16, 24)
  const ATTRS = createAttrMap(2, 3, [
    C.B_YELLOW, C.B_YELLOW,   // head row
    C.B_RED,    C.B_RED,      // body row
    C.B_BLUE,   C.B_BLUE,     // legs row
  ], C.BLACK)

  it('renders without throw', () => {
    const ctx = makeMockCtx()
    expect(() => drawBitmapAttrs(ctx, HERO, ATTRS, 0, 0)).not.toThrow()
  })

  it('produces 6 paper fillRects (one per cell)', () => {
    const ctx = makeMockCtx()
    drawBitmapAttrs(ctx, HERO, ATTRS, 0, 0)
    const paperRects = ctx._rects.filter(r => r.w === 8 && r.h === 8)
    expect(paperRects).toHaveLength(6)
  })

  it('head-row pixels use yellow ink', () => {
    const ctx = makeMockCtx()
    drawBitmapAttrs(ctx, HERO, ATTRS, 0, 0)
    const headInkRects = ctx._rects.filter(r => r.w === 1 && r.y < 8)
    for (const r of headInkRects) expect(r.style).toBe(C.B_YELLOW)
  })

  it('body-row pixels use red ink', () => {
    const ctx = makeMockCtx()
    drawBitmapAttrs(ctx, HERO, ATTRS, 0, 0)
    const bodyInkRects = ctx._rects.filter(r => r.w === 1 && r.y >= 8 && r.y < 16)
    for (const r of bodyInkRects) expect(r.style).toBe(C.B_RED)
  })

  it('legs-row pixels use blue ink', () => {
    const ctx = makeMockCtx()
    drawBitmapAttrs(ctx, HERO, ATTRS, 0, 0)
    const legsInkRects = ctx._rects.filter(r => r.w === 1 && r.y >= 16)
    for (const r of legsInkRects) expect(r.style).toBe(C.B_BLUE)
  })
})

// ── mirrorAttrMap ─────────────────────────────────────────────────────────────

describe('mirrorAttrMap', () => {
  it('1×1 map is unchanged (no cells to swap)', () => {
    const a = createAttrMap(1, 1, [C.B_WHITE], C.BLACK)
    const m = mirrorAttrMap(a)
    expect(m.inks[0]).toBe(C.B_WHITE)
    expect(m.papers![0]).toBe(C.BLACK)
  })

  it('2×1 swaps left/right within the single row', () => {
    const a = createAttrMap(2, 1, [C.B_RED, C.B_GREEN], C.BLACK)
    const m = mirrorAttrMap(a)
    expect(m.inks[0]).toBe(C.B_GREEN)
    expect(m.inks[1]).toBe(C.B_RED)
  })

  it('2×3 swaps each row independently, row order preserved', () => {
    const a = createAttrMap(2, 3, [
      C.B_RED,    C.B_GREEN,   // row 0
      C.B_YELLOW, C.B_BLUE,    // row 1
      C.B_CYAN,   C.B_MAGENTA, // row 2
    ], C.BLACK)
    const m = mirrorAttrMap(a)
    expect(m.inks).toEqual([
      C.B_GREEN,   C.B_RED,
      C.B_BLUE,    C.B_YELLOW,
      C.B_MAGENTA, C.B_CYAN,
    ])
  })

  it('mirrors papers too when present', () => {
    const a = createAttrMap(2, 1, [C.B_WHITE, C.B_WHITE], [C.RED, C.BLUE])
    const m = mirrorAttrMap(a)
    expect(m.papers).toEqual([C.BLUE, C.RED])
  })

  it('keeps papers undefined when source is transparent', () => {
    const a = createAttrMap(2, 1, [C.B_WHITE, C.B_WHITE])
    const m = mirrorAttrMap(a)
    expect(m.papers).toBeUndefined()
  })

  it('double-mirror is a no-op (inks)', () => {
    const original = createAttrMap(3, 2, [
      C.B_RED, C.B_GREEN, C.B_BLUE,
      C.B_YELLOW, C.B_CYAN, C.B_MAGENTA,
    ], C.BLACK)
    const restored = mirrorAttrMap(mirrorAttrMap(original))
    expect(restored.inks).toEqual(original.inks)
  })

  it('double-mirror is a no-op (papers)', () => {
    const original = createAttrMap(3, 1, [C.B_WHITE, C.B_WHITE, C.B_WHITE],
                                          [C.RED, C.GREEN, C.BLUE])
    const restored = mirrorAttrMap(mirrorAttrMap(original))
    expect(restored.papers).toEqual(original.papers)
  })

  it('preserves cols and rows', () => {
    const a = createAttrMap(4, 6, new Array(24).fill(C.B_WHITE), C.BLACK)
    const m = mirrorAttrMap(a)
    expect(m.cols).toBe(4)
    expect(m.rows).toBe(6)
  })

  it('does not mutate the source AttrMap', () => {
    const inks = [C.B_RED, C.B_GREEN]
    const a = createAttrMap(2, 1, inks, C.BLACK)
    mirrorAttrMap(a)
    expect(a.inks[0]).toBe(C.B_RED)
    expect(a.inks[1]).toBe(C.B_GREEN)
  })
})
