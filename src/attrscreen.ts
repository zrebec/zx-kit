/**
 * @module attrscreen
 *
 * **Authentic ZX attribute clash — opt-in.** The real Spectrum stored the screen
 * as two separate planes: a 1-bit **pixel** bitmap (256×192) and a 32×24
 * **attribute** grid where each 8×8 cell holds exactly *one* ink + *one* paper.
 * Drawing a sprite into a cell rewrote that cell's attribute, so everything in
 * the cell — sprite *and* background — snapped to the same two colours. That bleed
 * is the famous *colour clash*.
 *
 * zx-kit normally composites in full colour (no clash — by design, see the README).
 * This module is the opt-in way to get the real thing, the same shape as the other
 * effects ({@link "renderer" | drawScanlines}, {@link "lighting" | renderDarkness}):
 * a game that wants clash routes its drawing through an {@link AttrScreen} and
 * calls {@link flushAttrScreen} once per frame.
 *
 * **The dual plane:** {@link stampMono} writes a monochrome bitmap's *shape* into
 * the pixel plane and re-attributes every cell it touches (per {@link AttrPolicy}).
 * Crucially it does **not** clear other pixels — so a leaf already drawn in a cell
 * keeps its pixels but now renders in the *new* cell colour. That is the clash.
 *
 * **Fast flush:** the two planes are resolved into one RGBA buffer and uploaded
 * with a single `putImageData` + `drawImage` — never per-pixel `fillRect`. Assumes
 * a little-endian platform (every browser; common Node).
 *
 * Headless-safe: with no `document` the offscreen canvas is `null`, the resolve
 * still runs (so the logic is testable) and the blit is skipped — nothing throws.
 *
 * @example
 * ```ts
 * const scr = createAttrScreen()                       // 32×24 cells = 256×192, once
 * // each frame, in screen space:
 * clearAttrScreen(scr, C.BLACK)                        // blank paper
 * stampMono(scr, caveBitmap,   0,  0, C.B_BLUE,  C.BLACK)   // background
 * stampMono(scr, rabbitBitmap, rx, ry, C.B_WHITE, C.BLACK)  // sprite → its cells clash to white
 * flushAttrScreen(ctx, scr)                            // one putImageData + drawImage
 * ```
 */
import { CELL, type SpectrumColor } from './palette.js'
import type { Bitmap } from './renderer.js'

/**
 * How a {@link stampMono} re-colours each cell it touches:
 * - `'both'` — set ink **and** paper (last writer owns the whole cell — the most
 *   authentic clash: the background paper changes too).
 * - `'ink-only'` — set ink, keep the existing paper (gentler bleed).
 * - `'paper-only'` — set paper, keep the existing ink.
 */
export type AttrPolicy = 'both' | 'ink-only' | 'paper-only'

/** A screen-space dual plane: 1-bit pixels + per-cell ink/paper attributes. */
export interface AttrScreen {
  readonly cols: number
  readonly rows: number
  readonly width: number
  readonly height: number
  /** One byte per pixel — `1` = ink, `0` = paper. Row-major, `width*height`. */
  readonly pixels: Uint8Array
  /** Packed RGBA (little-endian) ink colour per cell, `cols*rows`. */
  readonly cellInk: Uint32Array
  /** Packed RGBA paper colour per cell, `cols*rows`. */
  readonly cellPaper: Uint32Array
  /** Resolved RGBA frame buffer (`width*height*4`), filled by {@link flushAttrScreen}. */
  readonly rgba: Uint8ClampedArray
  /** Reusable `ImageData` backing {@link rgba} (`null` when headless). */
  readonly image: ImageData | null
  /** Offscreen canvas the resolved buffer is uploaded to (`null` when headless). */
  readonly canvas: HTMLCanvasElement | null
}

/** Packs a `#RRGGBB` Spectrum colour into a little-endian RGBA word (opaque). */
function hexToU32(hex: SpectrumColor): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
}

/**
 * Creates a screen-space attribute plane of `cols`×`rows` 8×8 cells (default
 * 32×24 = 256×192). Allocate once; reuse across frames. Throws on a non-positive
 * size.
 */
export function createAttrScreen(cols = 32, rows = 24): AttrScreen {
  if (!Number.isInteger(cols) || cols <= 0 || !Number.isInteger(rows) || rows <= 0) {
    throw new Error(`createAttrScreen: cols and rows must be positive integers, got ${cols}×${rows}`)
  }
  const width = cols * CELL
  const height = rows * CELL
  let canvas: HTMLCanvasElement | null = null
  let image: ImageData | null = null
  if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.imageSmoothingEnabled = false
      image = ctx.createImageData(width, height)
    }
  }
  // In the browser the resolved buffer IS the ImageData's data (no per-frame copy,
  // no constructor); headless it's a standalone buffer so the resolve stays testable.
  const rgba = image ? image.data : new Uint8ClampedArray(width * height * 4)
  return {
    cols,
    rows,
    width,
    height,
    pixels: new Uint8Array(width * height),
    cellInk: new Uint32Array(cols * rows),
    cellPaper: new Uint32Array(cols * rows),
    rgba,
    image,
    canvas,
  }
}

/**
 * Resets the screen for a new frame: clears all pixels to paper and fills every
 * cell's attributes. `ink` defaults to `paper`, so untouched cells are a flat
 * paper colour. Call at the start of each frame, before stamping.
 */
export function clearAttrScreen(scr: AttrScreen, paper: SpectrumColor, ink: SpectrumColor = paper): void {
  scr.pixels.fill(0)
  scr.cellPaper.fill(hexToU32(paper))
  scr.cellInk.fill(hexToU32(ink))
}

/**
 * Stamps a monochrome {@link Bitmap} at screen pixel `(x, y)` (rounded; may be
 * sub-cell, negative, or off-screen — clipped). Sets the bitmap's lit pixels in
 * the pixel plane and re-attributes every cell that receives a lit pixel, per
 * `policy` (default `'both'`). Lit-pixel-only: existing pixels are never cleared,
 * so other sprites/background in a touched cell bleed to the new colour.
 */
export function stampMono(
  scr: AttrScreen,
  bitmap: Bitmap,
  x: number,
  y: number,
  ink: SpectrumColor,
  paper: SpectrumColor,
  policy: AttrPolicy = 'both',
): void {
  const inkU32 = hexToU32(ink)
  const paperU32 = hexToU32(paper)
  const setInk = policy !== 'paper-only'
  const setPaper = policy !== 'ink-only'
  const { data, width: bw, height: bh } = bitmap
  const bytesPerRow = bw >> 3
  const ox = Math.round(x)
  const oy = Math.round(y)

  for (let row = 0; row < bh; row++) {
    const py = oy + row
    if (py < 0 || py >= scr.height) continue
    const rowByteBase = row * bytesPerRow
    const rowPixBase = py * scr.width
    const cellRowBase = (py >> 3) * scr.cols
    for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
      const byte = data[rowByteBase + byteIdx]
      if (!byte) continue
      const colBase = byteIdx << 3
      for (let bit = 0; bit < 8; bit++) {
        if (!(byte & (0x80 >> bit))) continue
        const px = ox + colBase + bit
        if (px < 0 || px >= scr.width) continue
        scr.pixels[rowPixBase + px] = 1
        const cell = cellRowBase + (px >> 3)
        if (setInk) scr.cellInk[cell] = inkU32
        if (setPaper) scr.cellPaper[cell] = paperU32
      }
    }
  }
}

/**
 * Resolves the two planes into RGBA (each pixel takes its cell's ink or paper)
 * and uploads the result with one `putImageData` + `drawImage`. The image is
 * drawn at `(0, 0)` under the current transform, so the usual `setupCanvas`
 * `×scale` makes it fill the canvas. Headless: fills {@link AttrScreen.rgba} and
 * skips the blit.
 */
export function flushAttrScreen(ctx: CanvasRenderingContext2D, scr: AttrScreen): void {
  const { pixels, cellInk, cellPaper, width, height, cols } = scr
  const out = new Uint32Array(scr.rgba.buffer)
  let p = 0
  for (let yy = 0; yy < height; yy++) {
    const cellRow = (yy >> 3) * cols
    for (let xx = 0; xx < width; xx++) {
      const cell = cellRow + (xx >> 3)
      out[p] = pixels[p] ? cellInk[cell] : cellPaper[cell]
      p++
    }
  }

  if (scr.canvas && scr.image) {
    const offctx = scr.canvas.getContext('2d')
    if (offctx) {
      offctx.putImageData(scr.image, 0, 0)
      ctx.drawImage(scr.canvas, 0, 0)
    }
  }
}
