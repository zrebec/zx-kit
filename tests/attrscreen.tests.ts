import { describe, it, expect, vi } from 'vitest'
import {
  createAttrScreen, clearAttrScreen, stampMono, flushAttrScreen,
} from '../src/attrscreen.js'
import { C } from '../src/palette.js'
import { createBitmapFromRows } from '../src/renderer.js'

// flushAttrScreen resolves into scr.rgba even headless (no canvas/ImageData in the
// Node test env), so the clash logic is fully testable by reading the buffer.
const mockCtx = () => ({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)

function hexRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}
function pixelRgb(scr: ReturnType<typeof createAttrScreen>, x: number, y: number): [number, number, number] {
  const i = (y * scr.width + x) * 4
  return [scr.rgba[i]!, scr.rgba[i + 1]!, scr.rgba[i + 2]!]
}
// An 8×8 bitmap with a single lit pixel at (col,row).
function dot(col: number, row: number) {
  const rows: string[] = []
  for (let r = 0; r < 8; r++) {
    let line = ''
    for (let c = 0; c < 8; c++) line += (r === row && c === col) ? 'X' : '.'
    rows.push(line)
  }
  return createBitmapFromRows(rows)
}

// ── createAttrScreen ────────────────────────────────────────────────────────────

describe('createAttrScreen', () => {
  it('derives pixel size and sizes both planes', () => {
    const scr = createAttrScreen()
    expect([scr.cols, scr.rows]).toEqual([32, 24])
    expect([scr.width, scr.height]).toEqual([256, 192])
    expect(scr.pixels).toHaveLength(256 * 192)
    expect(scr.cellInk).toHaveLength(32 * 24)
    expect(scr.cellPaper).toHaveLength(32 * 24)
    expect(scr.rgba).toHaveLength(256 * 192 * 4)
  })

  it('throws on a non-positive size', () => {
    expect(() => createAttrScreen(0, 24)).toThrow(/positive/)
    expect(() => createAttrScreen(32, -1)).toThrow(/positive/)
  })

  it('is headless-safe: canvas is null without a document', () => {
    expect(createAttrScreen(1, 1).canvas).toBeNull()
  })
})

// ── clear + stamp basics ──────────────────────────────────────────────────────────

describe('clearAttrScreen / stampMono', () => {
  it('clears every pixel to the paper colour', () => {
    const scr = createAttrScreen(1, 1) // 8×8
    clearAttrScreen(scr, C.BLUE)
    flushAttrScreen(mockCtx(), scr)
    expect([...scr.pixels].every((v) => v === 0)).toBe(true)
    expect(pixelRgb(scr, 0, 0)).toEqual(hexRgb(C.BLUE))
    expect(pixelRgb(scr, 7, 7)).toEqual(hexRgb(C.BLUE))
  })

  it('sets only the bitmap lit pixels', () => {
    const scr = createAttrScreen(1, 1)
    clearAttrScreen(scr, C.BLACK)
    stampMono(scr, dot(0, 0), 0, 0, C.B_WHITE, C.BLACK)
    expect(scr.pixels[0]).toBe(1)
    expect(scr.pixels[1]).toBe(0)
  })

  it('clips off-screen stamps without throwing', () => {
    const scr = createAttrScreen(1, 1)
    expect(() => stampMono(scr, dot(0, 0), -4, -4, C.B_WHITE, C.BLACK)).not.toThrow()
    expect(() => stampMono(scr, dot(7, 7), 100, 100, C.B_WHITE, C.BLACK)).not.toThrow()
  })
})

// ── the clash (the whole point) ────────────────────────────────────────────────────

describe('attribute clash', () => {
  it('"both" (default) recolours the whole cell — paper bleeds too', () => {
    const scr = createAttrScreen(1, 1)
    clearAttrScreen(scr, C.B_BLUE)                          // blue paper
    stampMono(scr, dot(0, 0), 0, 0, C.B_WHITE, C.BLACK)     // white ink / black paper, both
    flushAttrScreen(mockCtx(), scr)
    expect(pixelRgb(scr, 0, 0)).toEqual(hexRgb(C.B_WHITE))  // lit pixel → ink
    expect(pixelRgb(scr, 1, 0)).toEqual(hexRgb(C.BLACK))    // clear pixel → paper OVERWRITTEN to black
  })

  it('"ink-only" keeps the existing paper', () => {
    const scr = createAttrScreen(1, 1)
    clearAttrScreen(scr, C.B_BLUE)
    stampMono(scr, dot(0, 0), 0, 0, C.B_WHITE, C.BLACK, 'ink-only')
    flushAttrScreen(mockCtx(), scr)
    expect(pixelRgb(scr, 0, 0)).toEqual(hexRgb(C.B_WHITE)) // ink
    expect(pixelRgb(scr, 1, 0)).toEqual(hexRgb(C.B_BLUE))  // paper kept blue
  })

  it('bleeds: an earlier pixel takes a later sprite\'s colour in the same cell', () => {
    const scr = createAttrScreen(1, 1)
    clearAttrScreen(scr, C.BLACK)
    stampMono(scr, dot(0, 0), 0, 0, C.B_GREEN, C.BLACK)    // a green "leaf" pixel at (0,0)
    stampMono(scr, dot(2, 0), 0, 0, C.B_WHITE, C.BLACK)    // a white sprite pixel at (2,0), same cell
    flushAttrScreen(mockCtx(), scr)
    expect(pixelRgb(scr, 0, 0)).toEqual(hexRgb(C.B_WHITE)) // the green leaf now renders WHITE — the clash
    expect(pixelRgb(scr, 2, 0)).toEqual(hexRgb(C.B_WHITE))
  })

  it('leaves neighbouring cells untouched', () => {
    const scr = createAttrScreen(2, 1) // 16×8, two cells
    clearAttrScreen(scr, C.B_BLUE)
    stampMono(scr, dot(0, 0), 0, 0, C.B_WHITE, C.BLACK)    // touches cell 0 only
    flushAttrScreen(mockCtx(), scr)
    expect(pixelRgb(scr, 1, 0)).toEqual(hexRgb(C.BLACK))   // cell 0 paper bled to black
    expect(pixelRgb(scr, 8, 0)).toEqual(hexRgb(C.B_BLUE))  // cell 1 still blue
  })
})

// ── flush headless safety ──────────────────────────────────────────────────────────

describe('flushAttrScreen', () => {
  it('fills rgba, does not throw, and skips the blit when headless', () => {
    const scr = createAttrScreen(1, 1)
    clearAttrScreen(scr, C.BLUE)
    const ctx = mockCtx()
    expect(() => flushAttrScreen(ctx, scr)).not.toThrow()
    expect(scr.rgba).toHaveLength(8 * 8 * 4)
    expect((ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0)
  })
})

// ── colour packing is memoised but per-colour correct (no cross-contamination) ──────

describe('hexToU32 memoisation', () => {
  it('reuses the cache yet packs each colour to its own RGB', () => {
    const scr = createAttrScreen(2, 1) // two cells, 16×8
    clearAttrScreen(scr, C.BLACK)
    stampMono(scr, dot(0, 0), 0, 0, C.B_CYAN, C.BLACK)   // cell 0 ← cyan
    stampMono(scr, dot(0, 0), 8, 0, C.B_YELLOW, C.BLACK) // cell 1 ← yellow
    stampMono(scr, dot(1, 0), 0, 0, C.B_CYAN, C.BLACK)   // cell 0 ← cyan again (cache hit)
    flushAttrScreen(mockCtx(), scr)
    expect(pixelRgb(scr, 0, 0)).toEqual(hexRgb(C.B_CYAN))   // cyan stayed cyan
    expect(pixelRgb(scr, 8, 0)).toEqual(hexRgb(C.B_YELLOW)) // yellow stayed yellow
  })
})
