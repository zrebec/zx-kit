import { C, CELL } from './palette.js'
import type { SpectrumColor } from './palette.js'
import { drawChar, drawText } from './renderer.js'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Border configuration for UI primitives.
 * When the `border` object is present on a parent option, a border is rendered.
 * `enabled` defaults to `true` — set it to `false` to suppress the border
 * while keeping the object in place for future toggling.
 */
export type BorderOptions = {
  /** Enable/disable border rendering. Default: `true` */
  enabled?: boolean

  /** Border thickness in pixels. Default: `1` */
  thickness?: number

  /**
   * Border color. Default: same as the primary `ink` / `color` of the parent function.
   * Accepts any {@link SpectrumColor} value.
   */
  color?: SpectrumColor

  /**
   * Border style.
   * - `'solid'`  — continuous lines (default)
   * - `'dashed'` — alternating 2 px on / 2 px off segments
   */
  style?: 'solid' | 'dashed'
}

/**
 * Options for {@link drawProgressBar}.
 */
export type DrawProgressBarOptions = {
  /**
   * Stable key for managed-visibility mode.
   * The bar's last-drawn state is registered under this key so `renderUI` can
   * redraw it on subsequent frames. Defaults to `"${x},${y}"` when omitted.
   */
  id?: string

  /** Left edge of the bar in game pixels. */
  x: number

  /** Top edge of the bar in game pixels. */
  y: number

  /**
   * Total width of the bar in game pixels.
   * Should be a multiple of `CELL` (8) — any remainder is left blank.
   */
  width: number

  /** Current value to represent. */
  value: number

  /** Minimum value (left edge = empty). Default: `0` */
  min?: number

  /** Maximum value (right edge = full). Default: `1` */
  max?: number

  /** Filled-block foreground color. Default: `C.B_WHITE` */
  ink?: SpectrumColor

  /** Empty-block background color. Default: `C.BLACK` */
  paper?: SpectrumColor

  /** Optional border around the entire bar. */
  border?: BorderOptions

  /**
   * How long the bar stays visible after the last `drawProgressBar` call (ms).
   * - `> 0` — auto-hides after this many milliseconds.
   * - `0`   — permanent; only cleared by `resetUI()`.
   * Default: `500`
   */
  visibilityLength?: number
}

// ─── Internal state ───────────────────────────────────────────────────────────

type _BarState = {
  options: DrawProgressBarOptions
  timer: number
  permanent: boolean
}

const _bars = new Map<string, _BarState>()

// ─── Private helpers ──────────────────────────────────────────────────────────

function _drawBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  border: BorderOptions,
  fallbackColor: SpectrumColor,
): void {
  if (border.enabled === false) return
  const color = border.color ?? fallbackColor
  const t = border.thickness ?? 1
  ctx.fillStyle = color
  if (border.style !== 'dashed') {
    ctx.fillRect(x, y, width, t)                       // top
    ctx.fillRect(x, y + height - t, width, t)          // bottom
    ctx.fillRect(x, y, t, height)                      // left
    ctx.fillRect(x + width - t, y, t, height)          // right
  } else {
    const d = 2  // dash length in pixels
    for (let i = 0; i < width; i += d * 2) {
      ctx.fillRect(x + i, y,              Math.min(d, width - i),  t)  // top
      ctx.fillRect(x + i, y + height - t, Math.min(d, width - i),  t)  // bottom
    }
    for (let i = 0; i < height; i += d * 2) {
      ctx.fillRect(x,             y + i, t, Math.min(d, height - i))  // left
      ctx.fillRect(x + width - t, y + i, t, Math.min(d, height - i))  // right
    }
  }
}

function _renderBar(ctx: CanvasRenderingContext2D, o: DrawProgressBarOptions): void {
  const min   = o.min   ?? 0
  const max   = o.max   ?? 1
  const ink   = o.ink   ?? C.B_WHITE
  const paper = o.paper ?? C.BLACK
  const chars = Math.floor(o.width / CELL)
  const ratio = Math.max(0, Math.min(1, (o.value - min) / (max - min)))
  const filled = Math.round(ratio * chars)

  ctx.fillStyle = paper
  ctx.fillRect(o.x, o.y, chars * CELL, CELL)

  for (let i = 0; i < filled; i++) {
    drawChar(ctx, 127, o.x + i * CELL, o.y, ink, paper)  // 127 = solid block █
  }

  if (o.border) _drawBorder(ctx, o.x, o.y, chars * CELL, CELL, o.border, ink)
}

// ─── Public API — stateless primitives ───────────────────────────────────────

/**
 * Draws a filled rectangular box using ZX-style rendering.
 *
 * Renders a solid background (`paper`) and an optional border.
 * Coordinates are in game pixels (already scaled by `setupCanvas`).
 * Does NOT render text — use `drawPanelTitle` for labelled panels.
 *
 * @example
 * drawBox(ctx, {
 *   x: 8, y: 8, width: 112, height: 40,
 *   paper: C.BLACK, ink: C.B_WHITE,
 *   border: { style: 'solid', thickness: 1 },
 * })
 */
export function drawBox(
  ctx: CanvasRenderingContext2D,
  options: {
    /** Left edge in game pixels */
    x: number
    /** Top edge in game pixels */
    y: number
    /** Width in game pixels */
    width: number
    /** Height in game pixels */
    height: number
    /** Background fill color */
    paper: SpectrumColor
    /** Foreground color — used as default border color when `border.color` is omitted */
    ink?: SpectrumColor
    /** Optional border */
    border?: BorderOptions
  },
): void {
  const { x, y, width, height, paper, ink, border } = options
  ctx.fillStyle = paper
  ctx.fillRect(x, y, width, height)
  if (border) _drawBorder(ctx, x, y, width, height, border, ink ?? paper)
}

/**
 * Draws a rectangular frame — border only, no background fill.
 *
 * Unlike `drawBox`, the inside area is left untouched.
 * Useful for selection highlights, overlays, and ZX-style panels
 * where the background is already painted.
 *
 * @example
 * drawFrame(ctx, { x: 0, y: 0, width: 256, height: 176, color: C.B_CYAN })
 * drawFrame(ctx, { x: 16, y: 16, width: 64, height: 32, color: C.B_RED,
 *   border: { style: 'dashed', thickness: 1 } })
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  options: {
    /** Left edge in game pixels */
    x: number
    /** Top edge in game pixels */
    y: number
    /** Width in game pixels */
    width: number
    /** Height in game pixels */
    height: number
    /** Frame color */
    color: SpectrumColor
    /** Border configuration — `color` here overrides the top-level `color` */
    border?: BorderOptions
  },
): void {
  const { x, y, width, height, color, border = {} } = options
  _drawBorder(ctx, x, y, width, height, { ...border, color }, color)
}

/**
 * Draws a ZX-style panel title — a text strip with an optional background fill.
 *
 * Does NOT draw the surrounding container (`drawBox` / `drawFrame` are separate).
 * The strip height is always `CELL + padding * 2` pixels.
 *
 * @example
 * // Labelled panel:
 * drawBox(ctx,   { x: 8, y: 24, width: 128, height: 56, paper: C.BLACK })
 * drawPanelTitle(ctx, { text: 'OPTIONS', x: 8, y: 24, ink: C.B_YELLOW,
 *   paper: C.BLACK, centered: true, width: 128 })
 *
 * // No background — ink only:
 * drawPanelTitle(ctx, { text: 'DEBUG', x: 0, y: 0, ink: C.B_CYAN })
 */
export function drawPanelTitle(
  ctx: CanvasRenderingContext2D,
  options: {
    /** Title text (ASCII — rendered via ZX ROM font) */
    text: string
    /** Left edge in game pixels */
    x: number
    /** Top edge of the title strip in game pixels */
    y: number
    /** Text color */
    ink: SpectrumColor
    /** Background behind the title strip. Omit for transparent (ink-only rendering) */
    paper?: SpectrumColor
    /** Padding inside the strip in pixels. Default: `2` */
    padding?: number
    /**
     * Center the title horizontally within `width`.
     * Requires `width` to be provided; ignored otherwise.
     */
    centered?: boolean
    /** Width used for centering (game pixels). Required when `centered: true`. */
    width?: number
  },
): void {
  const { text, x, y, ink, paper, padding = 2, centered, width } = options
  const textW = text.length * CELL
  const stripW = centered && width !== undefined ? width : textW + padding * 2

  if (paper !== undefined) {
    ctx.fillStyle = paper
    ctx.fillRect(x, y, stripW, CELL + padding * 2)
  }

  const tx = centered && width !== undefined
    ? x + Math.floor((width - textW) / 2)
    : x + padding

  drawText(ctx, text, tx, y + padding, ink, paper)
}

// ─── Public API — stateful widget ────────────────────────────────────────────

/**
 * Draws a ZX-style progress / value bar and registers it for managed redraws.
 *
 * The bar is drawn **immediately** on every call. Additionally, the options are
 * stored internally so `renderUI` can repaint the bar each frame for
 * `visibilityLength` ms without requiring the caller to supply the state again.
 *
 * Calling `drawProgressBar` again with the same `id` **resets the timer** — use
 * this to refresh the display when the value changes.
 *
 * **Typical pattern:**
 * ```ts
 * // On value change only:
 * if (consumeVolUp()) {
 *   increaseVolume()
 *   drawProgressBar(ctx, { id: 'volume', x: 88, y: 88, width: 80,
 *     value: getMasterVolume(), visibilityLength: 1500 })
 * }
 *
 * // Every frame (after game world render):
 * tickUI(dt)
 * renderUI(ctx)
 * ```
 *
 * @example
 * // Permanent HUD health bar:
 * drawProgressBar(ctx, {
 *   id: 'health', x: 0, y: 184, width: 40, value: lives, min: 0, max: 3,
 *   ink: C.B_GREEN, paper: C.BLACK, visibilityLength: 0,
 * })
 *
 * // Temporary volume indicator (auto-hides after 1.5 s):
 * drawProgressBar(ctx, {
 *   id: 'volume', x: 88, y: 88, width: 80, value: getMasterVolume(),
 *   ink: C.B_GREEN, paper: C.BLACK,
 *   border: { style: 'solid' },
 *   visibilityLength: 1500,
 * })
 */
export function drawProgressBar(
  ctx: CanvasRenderingContext2D,
  options: DrawProgressBarOptions,
): void {
  _renderBar(ctx, options)
  const id = options.id ?? `${options.x},${options.y}`
  const visibilityLength = options.visibilityLength ?? 500
  _bars.set(id, {
    options,
    timer: visibilityLength,
    permanent: visibilityLength === 0,
  })
}

/**
 * Advances all managed bar timers by `dtMs` milliseconds.
 * Bars whose timer reaches zero are removed and will no longer appear in `renderUI`.
 * Call once per frame, typically just before `renderUI`.
 *
 * @param dtMs - Frame delta in milliseconds
 *
 * @example
 * // End of game loop:
 * tickUI(dt)
 * renderUI(ctx)
 */
export function tickUI(dtMs: number): void {
  for (const [id, bar] of _bars) {
    if (bar.permanent) continue
    bar.timer -= dtMs
    if (bar.timer <= 0) _bars.delete(id)
  }
}

/**
 * Redraws all currently visible managed bars (timer > 0 or permanent).
 * Call every frame **after** the game world has been rendered so bars appear on top.
 *
 * @param ctx - Canvas 2D rendering context
 *
 * @example
 * renderFrame(ctx, state)
 * tickUI(dt)
 * renderUI(ctx)
 */
export function renderUI(ctx: CanvasRenderingContext2D): void {
  for (const bar of _bars.values()) {
    _renderBar(ctx, bar.options)
  }
}

/**
 * Clears all managed UI state — removes every active bar timer and its stored options.
 * Call alongside `resetInput()` when transitioning between major game phases.
 *
 * @example
 * resetInput()
 * resetUI()
 * appPhase = 'intro'
 */
export function resetUI(): void {
  _bars.clear()
}
