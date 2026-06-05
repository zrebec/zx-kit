import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  createMonoScreen, clearMonoScreen, drawMonoBitmap, fillMono, flushMonoScreen,
} from '../src/monoscreen.js'
import { C } from '../src/palette.js'
import { createBitmapFromRows } from '../src/renderer.js'

// zx-kit tests run in the Node env (no real canvas). Stub a minimal document so the
// browser path is exercised; tests that omit the stub hit the headless path.
function installMockDocument() {
  const ctx = {
    imageSmoothingEnabled: true,
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
  }
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => ctx) }
  vi.stubGlobal('document', { createElement: vi.fn(() => canvas) })
  return { canvas, ctx }
}
afterEach(() => vi.unstubAllGlobals())

const target = () => ({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)

function hexRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}
function pixelRgb(scr: ReturnType<typeof createMonoScreen>, x: number, y: number): [number, number, number] {
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

// ── createMonoScreen ──────────────────────────────────────────────────────────

describe('createMonoScreen', () => {
  it('stores its own size + colours and sizes the mask and rgba', () => {
    installMockDocument()
    const scr = createMonoScreen(256, 160, C.BLACK, C.B_CYAN)
    expect([scr.width, scr.height]).toEqual([256, 160])
    expect(scr.ink).toBe(C.BLACK)
    expect(scr.paper).toBe(C.B_CYAN)
    expect(scr.pixels).toHaveLength(256 * 160)
    expect(scr.rgba).toHaveLength(256 * 160 * 4)
  })

  it('throws on a non-positive size', () => {
    expect(() => createMonoScreen(0, 10, C.BLACK, C.WHITE)).toThrow(/positive/)
    expect(() => createMonoScreen(10, -1, C.BLACK, C.WHITE)).toThrow(/positive/)
  })

  it('is headless-safe: canvas is null without a document', () => {
    expect(createMonoScreen(8, 8, C.BLACK, C.WHITE).canvas).toBeNull()
  })
})

// ── draw / fill / clear ───────────────────────────────────────────────────────

describe('drawMonoBitmap / fillMono / clearMonoScreen', () => {
  it('draws only the lit pixels as foreground', () => {
    const scr = createMonoScreen(8, 8, C.BLACK, C.WHITE)
    drawMonoBitmap(scr, dot(0, 0), 0, 0)
    expect(scr.pixels[0]).toBe(1)
    expect(scr.pixels[1]).toBe(0)
  })

  it('clips off-screen draws without throwing', () => {
    const scr = createMonoScreen(8, 8, C.BLACK, C.WHITE)
    expect(() => drawMonoBitmap(scr, dot(0, 0), -4, -4)).not.toThrow()
    expect(() => drawMonoBitmap(scr, dot(7, 7), 100, 100)).not.toThrow()
  })

  it('fillMono fills a clipped foreground rectangle', () => {
    const scr = createMonoScreen(8, 8, C.BLACK, C.WHITE)
    fillMono(scr, 2, 3, 3, 1) // pixels (2,3),(3,3),(4,3)
    expect(scr.pixels[3 * 8 + 2]).toBe(1)
    expect(scr.pixels[3 * 8 + 4]).toBe(1)
    expect(scr.pixels[3 * 8 + 5]).toBe(0)
    expect(() => fillMono(scr, -2, -2, 4, 4)).not.toThrow()
  })

  it('clearMonoScreen resets every pixel to paper', () => {
    const scr = createMonoScreen(8, 8, C.BLACK, C.WHITE)
    fillMono(scr, 0, 0, 8, 8)
    clearMonoScreen(scr)
    expect([...scr.pixels].every((v) => v === 0)).toBe(true)
  })
})

// ── flushMonoScreen ───────────────────────────────────────────────────────────

describe('flushMonoScreen', () => {
  it('resolves lit pixels to ink and the rest to paper', () => {
    const scr = createMonoScreen(8, 8, C.BLACK, C.B_CYAN)
    drawMonoBitmap(scr, dot(0, 0), 0, 0)
    flushMonoScreen(target(), scr)
    expect(pixelRgb(scr, 0, 0)).toEqual(hexRgb(C.BLACK))   // lit → ink
    expect(pixelRgb(scr, 1, 0)).toEqual(hexRgb(C.B_CYAN))  // unlit → paper
  })

  it('recolours when ink/paper change (no redraw needed)', () => {
    const scr = createMonoScreen(8, 8, C.BLACK, C.B_CYAN)
    drawMonoBitmap(scr, dot(0, 0), 0, 0)
    scr.ink = C.B_RED
    scr.paper = C.BLACK
    flushMonoScreen(target(), scr)
    expect(pixelRgb(scr, 0, 0)).toEqual(hexRgb(C.B_RED))
    expect(pixelRgb(scr, 1, 0)).toEqual(hexRgb(C.BLACK))
  })

  it('blits at the given canvas offset', () => {
    installMockDocument()
    const scr = createMonoScreen(8, 8, C.BLACK, C.B_CYAN)
    const ctx = target()
    flushMonoScreen(ctx, scr, 0, 16)
    expect((ctx.drawImage as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(scr.canvas, 0, 16)
  })

  it('headless: fills rgba, does not throw, skips the blit', () => {
    const scr = createMonoScreen(8, 8, C.BLACK, C.B_CYAN)
    const ctx = target()
    expect(() => flushMonoScreen(ctx, scr)).not.toThrow()
    expect(scr.rgba).toHaveLength(8 * 8 * 4)
    expect((ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0)
  })
})
