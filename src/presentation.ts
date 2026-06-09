/**
 * @module presentation
 *
 * Small **8-bit title / loading-screen helpers** — the iconic ZX "PRESS ANY KEY"
 * blink, tape-loading border stripes, and a title menu. These are tiny, composable
 * functions over the renderer + palette (in the spirit of {@link "renderer" | drawScanlines}
 * and {@link "renderer" | drawText}), **not** a framework: a game wires its own title
 * or loading screen from them.
 *
 * Everything draws in **game pixels** (rely on the `setupCanvas` scale), so these
 * compose freely with `drawText`, sprites, and tiles.
 *
 * @example
 * ```ts
 * // A loading screen, composed from the pieces (no built-in "title screen"):
 * drawTapeStripes(ctx, now, { side: 'border' })
 * drawTextCentered(ctx, 'LOADING CHAOSBUNNY', 80, 32, C.B_WHITE)
 * drawBlinkingText(ctx, 'PRESS ANY KEY', 96, 120, now, C.B_YELLOW)
 * ```
 */
import { C, CELL, type SpectrumColor } from './palette.js'
import { drawText } from './renderer.js'

/**
 * `true` for the lit half of each blink cycle — a pure, time-driven toggle (no
 * state). Gate any flashing element with it.
 *
 * @example
 * if (blinkVisible(now)) drawText(ctx, 'INSERT COIN', x, y, C.B_WHITE)
 */
export function blinkVisible(now: number, intervalMs = 500): boolean {
  return Math.floor(now / intervalMs) % 2 === 0
}

/**
 * Draws `text` only on the visible half of the blink cycle — the classic flashing
 * "PRESS ANY KEY" / "PRESS FIRE" prompt. Same args as {@link drawText} plus `now`.
 */
export function drawBlinkingText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  now: number,
  ink: SpectrumColor = C.B_WHITE,
  paper?: SpectrumColor,
  intervalMs = 500,
): void {
  if (blinkVisible(now, intervalMs)) drawText(ctx, text, x, y, ink, paper)
}

/** Options for {@link drawTapeStripes}. */
export interface TapeStripesOptions {
  /** Colours cycled down the screen. Default: the classic loader red / cyan. */
  colors?: readonly SpectrumColor[]
  /** Stripe thickness in game px (default `2`). */
  stripeHeight?: number
  /** Scroll speed in px/second (default `24`) — animates the loading shimmer. */
  speed?: number
  /** `'full'` stripes the whole screen; `'border'` stripes only a frame. Default `'full'`. */
  side?: 'full' | 'border'
  /** Border band thickness in px when `side: 'border'` (default `CELL`). */
  band?: number
  /** Screen size in game px (default 256×192 — the ZX canvas). */
  width?: number
  height?: number
}

/**
 * Draws animated ZX **tape-loading stripes** — the shimmering coloured bands of a
 * cassette load. `'full'` paints the whole screen; `'border'` paints only a frame
 * (leaving the middle for your title art). Call before your title/logo each frame.
 */
export function drawTapeStripes(
  ctx: CanvasRenderingContext2D,
  now: number,
  options: TapeStripesOptions = {},
): void {
  const {
    colors = [C.B_RED, C.B_CYAN],
    stripeHeight = 2,
    speed = 24,
    side = 'full',
    band = CELL,
    width = 256,
    height = 192,
  } = options
  const n = colors.length
  if (n === 0 || stripeHeight <= 0) return
  const offset = Math.floor((now / 1000) * speed)
  for (let y = 0; y < height; y += stripeHeight) {
    const i = Math.floor((y - offset) / stripeHeight)
    ctx.fillStyle = colors[((i % n) + n) % n]!
    const h = Math.min(stripeHeight, height - y)
    if (side === 'full' || y < band || y >= height - band) {
      ctx.fillRect(0, y, width, h)               // full row (whole screen, or top/bottom band)
    } else {
      ctx.fillRect(0, y, band, h)                // left band
      ctx.fillRect(width - band, y, band, h)     // right band
    }
  }
}

/** Options for {@link drawMenuOptions}. */
export interface MenuOptionsConfig {
  /** Ink for unselected options (default `C.WHITE`). */
  ink?: SpectrumColor
  /** Ink for the selected option (default `C.B_YELLOW`). */
  selectedInk?: SpectrumColor
  /** Optional paper behind each line. */
  paper?: SpectrumColor
  /** Extra px between rows on top of the 8px line height (default `2`). */
  gap?: number
  /** Marker before the selected option; others are padded to align (default `'> '`). */
  prefix?: string
}

/**
 * Draws a vertical **title menu** at `(x, y)`. The selected option is highlighted
 * with `selectedInk` and the `prefix` marker; the rest are padded to stay aligned.
 */
export function drawMenuOptions(
  ctx: CanvasRenderingContext2D,
  options: readonly string[],
  selectedIndex: number,
  x: number, y: number,
  config: MenuOptionsConfig = {},
): void {
  const { ink = C.WHITE, selectedInk = C.B_YELLOW, paper, gap = 2, prefix = '> ' } = config
  const pad = ' '.repeat(prefix.length)
  const lineH = CELL + gap
  for (let i = 0; i < options.length; i++) {
    const selected = i === selectedIndex
    drawText(ctx, (selected ? prefix : pad) + options[i]!, x, y + i * lineH, selected ? selectedInk : ink, paper)
  }
}
