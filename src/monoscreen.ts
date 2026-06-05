/**
 * @module monoscreen
 *
 * **Monochrome playfield — the classic ZX anti-clash trick.** The surest way to
 * avoid attribute clash is to have no clash at all: render the action area in a
 * single ink + paper, and keep the colour in a separate HUD/border around it.
 * Light Force, Bobby Bearing, Highway Encounter and Head Over Heels all did this.
 *
 * A {@link MonoScreen} is a **1-bit foreground mask of any size** (its own,
 * smaller than the canvas) plus two colours. Everything drawn into it is reduced
 * to ink (lit pixels) or paper (everything else) — a white sprite, a green tile
 * and a cyan rabbit all become the same ink, so they can never clash. Draw your
 * colourful HUD normally *outside* the region; {@link flushMonoScreen} blits the
 * playfield at a given offset.
 *
 * Unlike {@link "attrscreen" | attrscreen} (authentic *per-cell* clash), this is
 * one ink/paper for the **whole** region — simpler, cheaper, and the right tool
 * when you want a clean retro look rather than the colour-bleed artefact.
 *
 * Fast flush: the mask is resolved into one reused `ImageData` and uploaded with
 * a single `putImageData` + `drawImage` — never per-pixel `fillRect`. Little-endian
 * (every browser). Headless-safe: the resolve runs, the blit is skipped.
 *
 * @example
 * ```ts
 * const play = createMonoScreen(256, 160, C.BLACK, C.B_CYAN)   // playfield, once
 * // each frame, in playfield space:
 * clearMonoScreen(play)
 * drawMonoBitmap(play, tileBmp,   tx, ty)     // tiles  → ink
 * drawMonoBitmap(play, rabbitBmp, rx, ry)     // sprite → ink (silhouette)
 * fillMono(play, threadX, threadY, 1, len)    // a thin line (e.g. a spider thread)
 * flushMonoScreen(ctx, play, 0, 16)           // blit the playfield below a 16px HUD
 * // …draw the colourful HUD normally, outside the region…
 * ```
 */
import type { SpectrumColor } from './palette.js'
import type { Bitmap } from './renderer.js'

/** A monochrome region: a 1-bit foreground mask plus an ink/paper colour pair. */
export interface MonoScreen {
  readonly width: number
  readonly height: number
  /** Foreground colour (lit pixels). Mutable — recolour the playfield any time. */
  ink: SpectrumColor
  /** Background colour (everything else). Mutable. */
  paper: SpectrumColor
  /** One byte per pixel — `1` = ink/foreground, `0` = paper. Row-major, `width*height`. */
  readonly pixels: Uint8Array
  /** Resolved RGBA buffer (`width*height*4`), filled by {@link flushMonoScreen}. */
  readonly rgba: Uint8ClampedArray
  /** Reusable `ImageData` backing {@link rgba} (`null` when headless). */
  readonly image: ImageData | null
  /** Offscreen canvas the resolved buffer is uploaded to (`null` when headless). */
  readonly canvas: HTMLCanvasElement | null
}

/** Packs a `#RRGGBB` colour into a little-endian RGBA word (opaque). */
function hexToU32(hex: SpectrumColor): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
}

/**
 * Creates a monochrome playfield of the given pixel size — **its own size, not
 * the canvas**. Pick a region smaller than the canvas and keep the HUD colourful
 * around it. `ink`/`paper` are mutable. Create once; reuse across frames. Throws
 * on a non-positive size.
 */
export function createMonoScreen(
  width: number,
  height: number,
  ink: SpectrumColor,
  paper: SpectrumColor,
): MonoScreen {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error(`createMonoScreen: width and height must be positive, got ${width}×${height}`)
  }
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
  const rgba = image ? image.data : new Uint8ClampedArray(width * height * 4)
  return { width, height, ink, paper, pixels: new Uint8Array(width * height), rgba, image, canvas }
}

/** Resets the playfield to all-paper for a new frame. Call before drawing. */
export function clearMonoScreen(scr: MonoScreen): void {
  scr.pixels.fill(0)
}

/**
 * Draws a monochrome {@link Bitmap}'s lit pixels as foreground (ink) at `(x, y)`
 * (rounded; may be off-screen — clipped). Clear pixels are left untouched, so the
 * paper (and anything drawn earlier) shows through.
 */
export function drawMonoBitmap(scr: MonoScreen, bitmap: Bitmap, x: number, y: number): void {
  const { data, width: bw, height: bh } = bitmap
  const bytesPerRow = bw >> 3
  const ox = Math.round(x)
  const oy = Math.round(y)
  for (let row = 0; row < bh; row++) {
    const py = oy + row
    if (py < 0 || py >= scr.height) continue
    const rowByteBase = row * bytesPerRow
    const rowPixBase = py * scr.width
    for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
      const byte = data[rowByteBase + byteIdx]
      if (!byte) continue
      const colBase = byteIdx << 3
      for (let bit = 0; bit < 8; bit++) {
        if (!(byte & (0x80 >> bit))) continue
        const px = ox + colBase + bit
        if (px < 0 || px >= scr.width) continue
        scr.pixels[rowPixBase + px] = 1
      }
    }
  }
}

/**
 * Sets a filled foreground rectangle (clipped) — handy for thin lines (a 1px-wide
 * rect is a spider thread, a ladder rail, a laser) or solid blocks.
 */
export function fillMono(scr: MonoScreen, x: number, y: number, w: number, h: number): void {
  const x0 = Math.max(0, Math.round(x))
  const y0 = Math.max(0, Math.round(y))
  const x1 = Math.min(scr.width, Math.round(x) + w)
  const y1 = Math.min(scr.height, Math.round(y) + h)
  for (let yy = y0; yy < y1; yy++) {
    const base = yy * scr.width
    for (let xx = x0; xx < x1; xx++) scr.pixels[base + xx] = 1
  }
}

/**
 * Resolves the mask into RGBA (ink where lit, paper elsewhere) and blits the
 * region at canvas offset `(dx, dy)` with one `putImageData` + `drawImage` — under
 * the current transform, so `setupCanvas`'s `×scale` is honoured. Headless: fills
 * {@link MonoScreen.rgba} and skips the blit.
 */
export function flushMonoScreen(ctx: CanvasRenderingContext2D, scr: MonoScreen, dx = 0, dy = 0): void {
  const inkU32 = hexToU32(scr.ink)
  const paperU32 = hexToU32(scr.paper)
  const out = new Uint32Array(scr.rgba.buffer)
  const px = scr.pixels
  for (let i = 0; i < px.length; i++) out[i] = px[i] ? inkU32 : paperU32

  if (scr.canvas && scr.image) {
    const offctx = scr.canvas.getContext('2d')
    if (offctx) {
      offctx.putImageData(scr.image, 0, 0)
      ctx.drawImage(scr.canvas, dx, dy)
    }
  }
}
