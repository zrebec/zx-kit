/**
 * @module lighting
 *
 * **Dithered cave darkness** — the ZX way to fake light: hard 8×8 light pools
 * with an ordered (Bayer) dither edge, no alpha gradients. Think *Knight Lore*,
 * not modern soft shadows.
 *
 * Built for speed. The naive way (recompute a full-screen `ImageData` and
 * `putImageData` it every frame) is a CPU/upload hog — it was ~27% of a frame in
 * a real game. Instead:
 *
 *  1. The dither for each darkness **level** is pre-rendered once to a tiny 8×8
 *     tile ({@link createDarknessLayer}).
 *  2. The view is darkened **cell by cell** into a persistent buffer, and only
 *     cells whose level **changed** since the last frame are repainted.
 *  3. The whole buffer is blitted with **one `drawImage`** — no per-frame
 *     `putImageData`.
 *
 * The game supplies a per-cell darkness via a callback, so it owns the *policy*
 * (lights, depth gradients, fog…) while this module owns the fast *rendering*.
 * {@link brightnessAt} is a ready helper for the common "pools of light" case.
 *
 * @example
 * ```ts
 * const dark = createDarknessLayer(256, 192)        // once, view-sized
 * // each frame, after drawing the scene:
 * renderDarkness(dark, ctx, (col, row) => {
 *   const b = brightnessAt(col * CELL + 4, row * CELL + 4, lights)
 *   return 1 - b                                    // 0 = lit, 1 = pitch black
 * })
 * ```
 */
import { CELL } from './palette.js'

/** A point light: position (screen px), reach `radius` (px) and `intensity` 0..1. */
export interface Light {
  x: number
  y: number
  radius: number
  intensity: number
}

// Dispersed 4×4 Bayer matrix (values 0..15), row-major — drives the stipple.
// 8×8 cells are a multiple of 4, so tiles dither seamlessly across cell borders.
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const

/**
 * The ordered-dither rule: is pixel `(px, py)` black at darkness `amount` (0..1)?
 * Pure and deterministic — used to bake the level tiles, and handy to test.
 */
export function ditherBlack(px: number, py: number, amount: number): boolean {
  return (BAYER4[((py & 3) << 2) | (px & 3)]! + 0.5) / 16 < amount
}

/**
 * Brightest attenuated light at a point: `max((1 - dist/radius) * intensity)`
 * over all lights, clamped to 0..1. Turn it into darkness with `1 - brightnessAt(...)`.
 */
export function brightnessAt(px: number, py: number, lights: readonly Light[]): number {
  let b = 0
  for (const l of lights) {
    if (l.radius <= 0) continue
    const dx = px - l.x
    const dy = py - l.y
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < l.radius) {
      const c = (1 - d / l.radius) * l.intensity
      if (c > b) b = c
    }
  }
  return b > 1 ? 1 : b < 0 ? 0 : b
}

/** A view-sized darkness overlay with pre-baked dither tiles + a cached buffer. */
export interface DarknessLayer {
  readonly width: number
  readonly height: number
  readonly levels: number
  readonly cols: number
  readonly rows: number
  /** Pre-rendered 8×8 dither tiles, index 0 (lit, `null`) … levels-1 (darkest). */
  readonly tiles: ReadonlyArray<HTMLCanvasElement | null>
  /** Persistent darkness buffer (view-sized), blitted each frame. */
  readonly buffer: HTMLCanvasElement | null
  /** Last level drawn per cell, row-major; -1 = never drawn (forces a repaint). */
  readonly cellLevel: Int16Array
}

/** Bakes one 8×8 dither tile for darkness `amount`, or `null` when fully lit. */
function makeTile(amount: number): HTMLCanvasElement | null {
  if (amount <= 0 || typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = CELL
  c.height = CELL
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#000'
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      if (ditherBlack(x, y, amount)) ctx.fillRect(x, y, 1, 1)
    }
  }
  return c
}

/**
 * Creates a darkness layer sized to the view. `levels` is the number of darkness
 * steps (default 8) — more is a smoother dither for a little more memory. Call
 * once; reuse across frames.
 */
export function createDarknessLayer(width: number, height: number, levels = 8): DarknessLayer {
  if (!Number.isInteger(levels) || levels < 2) {
    throw new Error(`createDarknessLayer: levels must be an integer >= 2, got ${levels}`)
  }
  const cols = Math.ceil(width / CELL)
  const rows = Math.ceil(height / CELL)
  const tiles: (HTMLCanvasElement | null)[] = []
  for (let i = 0; i < levels; i++) tiles.push(makeTile(i / (levels - 1)))

  let buffer: HTMLCanvasElement | null = null
  if (typeof document !== 'undefined') {
    buffer = document.createElement('canvas')
    buffer.width = width
    buffer.height = height
  }

  const cellLevel = new Int16Array(cols * rows).fill(-1)
  return { width, height, levels, cols, rows, tiles, buffer, cellLevel }
}

/**
 * Renders dithered darkness onto `ctx`. `darknessAt(col, row)` returns the
 * darkness of each 8×8 cell: **0 = lit**, **1 = pitch black** (values are clamped
 * and quantised to the layer's `levels`). Only cells whose level changed since the
 * last call are repainted on the cached buffer; the buffer is then blitted once.
 */
export function renderDarkness(
  layer: DarknessLayer,
  ctx: CanvasRenderingContext2D,
  darknessAt: (col: number, row: number) => number,
): void {
  const { buffer, tiles, levels, cols, rows, cellLevel } = layer
  const bctx = buffer ? buffer.getContext('2d') : null
  const maxLevel = levels - 1

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let a = darknessAt(col, row)
      a = a < 0 ? 0 : a > 1 ? 1 : a
      const level = Math.round(a * maxLevel)
      const idx = row * cols + col
      if (cellLevel[idx] === level) continue // unchanged → skip the repaint
      cellLevel[idx] = level
      if (bctx) {
        const x = col * CELL
        const y = row * CELL
        bctx.clearRect(x, y, CELL, CELL)
        const tile = tiles[level]
        if (tile) bctx.drawImage(tile, x, y)
      }
    }
  }

  if (buffer) ctx.drawImage(buffer, 0, 0)
}
