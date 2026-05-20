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

// ─── Public API — instrumentation widgets (stateless) ───────────────────────

/**
 * Options for {@link drawDottedGrid}.
 */
export type DrawDottedGridOptions = {
  /** Left edge in game pixels. */
  x: number
  /** Top edge in game pixels. */
  y: number
  /** Total width covered by the dot field, in pixels. */
  width: number
  /** Total height covered by the dot field, in pixels. */
  height: number
  /** Distance between adjacent dot centres in pixels. Common values: 2, 4, 8. */
  spacing: number
  /** Dot colour. */
  color: SpectrumColor
  /** Optional background fill behind the dots. Omit for transparent. */
  paper?: SpectrumColor
  /** Dot size in pixels (default `1`). Use `2` for chunkier dots. */
  dotSize?: number
}

/**
 * Draws a regularly-spaced dot pattern covering a rectangular area.
 *
 * Useful for: radar / sonar screens, tactical scanner overlays, debug grids,
 * stippled backgrounds, "dotted line" decorative elements, alien-invasion
 * style detection grids.
 *
 * @example
 * // Sonar background (submarine)
 * drawDottedGrid(ctx, {
 *   x: 8, y: 8, width: 64, height: 48,
 *   spacing: 4, color: C.GREEN, paper: C.BLACK,
 * })
 *
 * // Tactical overlay
 * drawDottedGrid(ctx, { x: 0, y: 0, width: 256, height: 192, spacing: 8, color: C.B_WHITE })
 */
export function drawDottedGrid(
  ctx: CanvasRenderingContext2D,
  options: DrawDottedGridOptions,
): void {
  const { x, y, width, height, spacing, color, paper, dotSize = 1 } = options
  if (paper !== undefined) {
    ctx.fillStyle = paper
    ctx.fillRect(x, y, width, height)
  }
  ctx.fillStyle = color
  for (let dy = 0; dy < height; dy += spacing) {
    for (let dx = 0; dx < width; dx += spacing) {
      ctx.fillRect(x + dx, y + dy, dotSize, dotSize)
    }
  }
}

/**
 * Options for {@link drawSegmentedBar}.
 *
 * Choose ONE colouring strategy:
 * - **Single colour:** set `color` — every filled segment uses it (e.g. Robocop health bar).
 * - **Threshold gradient:** set `colors` as `[lowColor, midColor, highColor]` — the
 *   widget picks one of the three based on `value / max`: `< 1/3 → lowColor`,
 *   `< 2/3 → midColor`, `else → highColor` (e.g. oxygen status: red → yellow → green).
 */
export type DrawSegmentedBarOptions = {
  /** Left edge in game pixels. */
  x: number
  /** Top edge in game pixels. */
  y: number
  /** Total number of segments rendered (filled + empty). */
  segments: number
  /** Current value mapped to the bar. */
  value: number
  /** Maximum value (the bar is full when `value >= max`). */
  max: number
  /** Width of each segment in pixels. Default `8` (one `CELL`). */
  segmentWidth?: number
  /** Height of each segment in pixels. Default `8` (one `CELL`). */
  segmentHeight?: number
  /** Gap between adjacent segments in pixels. Default `1`. */
  gap?: number
  /** Single fill colour for every filled segment. Mutually exclusive with `colors`. */
  color?: SpectrumColor
  /** Three-stop threshold gradient `[low, mid, high]`. Mutually exclusive with `color`. */
  colors?: [SpectrumColor, SpectrumColor, SpectrumColor]
  /** Background colour for empty segments. Omit for transparent. */
  paper?: SpectrumColor
  /** Bar orientation. Default `'horizontal'`. */
  orientation?: 'horizontal' | 'vertical'
}

/**
 * Draws a discrete segmented bar — health, ammo, shield, fuel, stamina, mana,
 * battery, damage indicators. The bar shows `round(value/max * segments)` filled
 * segments out of `segments` total.
 *
 * @example
 * // Robocop-style health (single colour):
 * drawSegmentedBar(ctx, {
 *   x: 0, y: 0, segments: 10, value: 7, max: 10, color: C.B_GREEN,
 * })
 *
 * // Oxygen with threshold gradient (red → yellow → green):
 * drawSegmentedBar(ctx, {
 *   x: 0, y: 0, segments: 10, value: 8, max: 10,
 *   colors: [C.B_RED, C.B_YELLOW, C.B_GREEN],
 *   paper: C.BLACK,
 * })
 *
 * // Vertical bar (e.g. oxygen indicator next to ballast tanks):
 * drawSegmentedBar(ctx, {
 *   x: 0, y: 0, segments: 8, value: 5, max: 8,
 *   orientation: 'vertical', color: C.B_GREEN,
 * })
 */
export function drawSegmentedBar(
  ctx: CanvasRenderingContext2D,
  options: DrawSegmentedBarOptions,
): void {
  const {
    x, y, segments, value, max,
    segmentWidth = CELL, segmentHeight = CELL, gap = 1,
    color, colors, paper,
    orientation = 'horizontal',
  } = options

  if ((color === undefined) === (colors === undefined)) {
    throw new Error('drawSegmentedBar: provide exactly one of `color` or `colors`')
  }

  const clamped = Math.max(0, Math.min(max, value))
  const ratio = max === 0 ? 0 : clamped / max
  const filled = Math.round(ratio * segments)

  let fillColor: SpectrumColor
  if (color !== undefined) {
    fillColor = color
  } else {
    const [lo, mid, hi] = colors!
    fillColor = ratio < 1 / 3 ? lo : ratio < 2 / 3 ? mid : hi
  }

  for (let i = 0; i < segments; i++) {
    const filledHere = i < filled
    const drawColor = filledHere ? fillColor : paper
    if (drawColor === undefined) continue

    const dx = orientation === 'horizontal' ? i * (segmentWidth + gap) : 0
    const dy = orientation === 'horizontal' ? 0 : (segments - 1 - i) * (segmentHeight + gap)

    ctx.fillStyle = drawColor
    ctx.fillRect(x + dx, y + dy, segmentWidth, segmentHeight)
  }
}

/**
 * Options for {@link drawTank}.
 */
export type DrawTankOptions = {
  /** Left edge in game pixels. */
  x: number
  /** Top edge in game pixels. */
  y: number
  /** Container width in pixels. */
  width: number
  /** Container height in pixels. */
  height: number
  /** Fill level `0..1`. Out-of-range values are clamped. */
  fillPct: number
  /** Container outline shape. `'pill'` = rounded ends (submarine-style),
   * `'rect'` = sharp corners. Default `'pill'`. */
  shape?: 'pill' | 'rect'
  /** Fluid colour. */
  liquidColor: SpectrumColor
  /** Container outline colour. Defaults to `liquidColor`. */
  containerColor?: SpectrumColor
  /** Background colour for the empty portion. Defaults to `C.BLACK`.
   * Set explicitly to a different palette colour, or use `'transparent'` to
   * leave the empty area un-painted (so the underlying frame shows through). */
  emptyColor?: SpectrumColor | 'transparent'
}

/**
 * Draws a fluid container — ballast tanks, fuel gauges, water reservoirs,
 * lava levels, oil drums, chemical canisters. Liquid fills from the bottom up.
 *
 * **Shape `'pill'`** renders rounded semicircular caps at top and bottom for a
 * sci-fi / submarine look. **Shape `'rect'`** uses sharp corners — simpler and
 * more industrial. Both share the same fill semantics.
 *
 * @example
 * // Submarine ballast tank (pill, cyan fluid)
 * drawTank(ctx, {
 *   x: 8, y: 16, width: 16, height: 48,
 *   fillPct: 0.66,
 *   shape: 'pill',
 *   liquidColor: C.B_CYAN,
 *   containerColor: C.WHITE,
 *   emptyColor: C.BLACK,
 * })
 *
 * // Generic fuel gauge (rect, yellow fluid)
 * drawTank(ctx, {
 *   x: 200, y: 8, width: 24, height: 32,
 *   fillPct: 0.4, shape: 'rect',
 *   liquidColor: C.B_YELLOW, containerColor: C.WHITE, emptyColor: C.BLACK,
 * })
 */
export function drawTank(
  ctx: CanvasRenderingContext2D,
  options: DrawTankOptions,
): void {
  const {
    x, y, width, height, fillPct,
    shape = 'pill',
    liquidColor,
    containerColor = liquidColor,
    emptyColor = C.BLACK,
  } = options

  const pct = Math.max(0, Math.min(1, fillPct))
  const fillHeight = Math.round(height * pct)
  const fillTop = y + height - fillHeight

  // For pill shape, the cap radius is half the width capped to a sensible max.
  const capRadius = shape === 'pill' ? Math.min(Math.floor(width / 2), Math.floor(height / 2)) : 0

  // ── Empty region fill ────────────────────────────────────────────────────
  if (emptyColor !== 'transparent') {
    ctx.fillStyle = emptyColor
    if (shape === 'rect') {
      ctx.fillRect(x, y, width, height - fillHeight)
    } else {
      // Pill: fill the body (rectangle middle), and add top semicircle if
      // empty area extends into it.
      for (let dy = 0; dy < height - fillHeight; dy++) {
        const py = y + dy
        const insetLeft  = _capInset(dy, height, capRadius, width)
        ctx.fillRect(x + insetLeft, py, width - 2 * insetLeft, 1)
      }
    }
  }

  // ── Liquid region fill ──────────────────────────────────────────────────
  if (fillHeight > 0) {
    ctx.fillStyle = liquidColor
    if (shape === 'rect') {
      ctx.fillRect(x, fillTop, width, fillHeight)
    } else {
      for (let dy = 0; dy < fillHeight; dy++) {
        const py = fillTop + dy
        const trueDy = (height - fillHeight) + dy  // offset within full container
        const insetLeft = _capInset(trueDy, height, capRadius, width)
        ctx.fillRect(x + insetLeft, py, width - 2 * insetLeft, 1)
      }
    }
  }

  // ── Container outline ────────────────────────────────────────────────────
  ctx.fillStyle = containerColor
  if (shape === 'rect') {
    // 4 thin lines for the rectangular outline (1 px thick)
    ctx.fillRect(x, y, width, 1)                 // top
    ctx.fillRect(x, y + height - 1, width, 1)    // bottom
    ctx.fillRect(x, y, 1, height)                // left
    ctx.fillRect(x + width - 1, y, 1, height)    // right
  } else {
    // Pill outline: vertical sides + curved top/bottom via _capInset
    for (let dy = 0; dy < height; dy++) {
      const inset = _capInset(dy, height, capRadius, width)
      // Left and right edge pixels of the outline at this row
      ctx.fillRect(x + inset, y + dy, 1, 1)
      ctx.fillRect(x + width - 1 - inset, y + dy, 1, 1)
    }
  }
}

/**
 * Internal helper: for a pill shape of given dimensions and cap radius,
 * returns how many pixels are inset from the left edge at row `dy` (0-indexed
 * from the top). Returns 0 in the rectangular middle. The shape is symmetric,
 * so the right edge inset equals the left edge inset.
 */
function _capInset(dy: number, totalHeight: number, capRadius: number, _width: number): number {
  if (capRadius === 0) return 0
  // Top cap: rows 0..capRadius-1
  if (dy < capRadius) {
    const r = capRadius
    const offsetFromCenter = r - 1 - dy
    const horiz = Math.round(r - Math.sqrt(Math.max(0, r * r - (offsetFromCenter + 0.5) * (offsetFromCenter + 0.5))))
    return horiz
  }
  // Bottom cap: rows (totalHeight - capRadius)..totalHeight-1
  if (dy >= totalHeight - capRadius) {
    const r = capRadius
    const offsetFromCenter = dy - (totalHeight - capRadius)
    const horiz = Math.round(r - Math.sqrt(Math.max(0, r * r - (offsetFromCenter + 0.5) * (offsetFromCenter + 0.5))))
    return horiz
  }
  return 0  // straight middle
}

/**
 * Options for {@link drawDial}.
 */
export type DrawDialOptions = {
  /** Centre x in game pixels. */
  cx: number
  /** Centre y in game pixels. */
  cy: number
  /** Dial radius in pixels. */
  radius: number
  /** Current value mapped to the needle angle. */
  value: number
  /** Minimum value. Default `0`. */
  min?: number
  /** Maximum value. Default `100`. */
  max?: number
  /** Needle start angle in radians (corresponds to `min`). Default `3π/4`
   * (bottom-left at 7–8 o'clock). Canvas convention: `0` = right, `π/2` = down,
   * `π` = left, `3π/2` = up — angles increase **clockwise** on screen because
   * the y-axis points down. */
  startAngle?: number
  /** Needle end angle in radians (corresponds to `max`). Default `9π/4`
   * (bottom-right at 4–5 o'clock, after sweeping clockwise through the top).
   * Note the value is greater than `2π` so linear interpolation from `startAngle`
   * traverses the top of the dial rather than the short path through the bottom. */
  endAngle?: number
  /** Needle colour. */
  needleColor: SpectrumColor
  /** Optional dial face fill (filled circle). */
  faceColor?: SpectrumColor
  /** Optional dial rim outline colour (circle outline). */
  rimColor?: SpectrumColor
  /** Optional tick mark colour. Requires `ticks` to actually draw any. */
  tickColor?: SpectrumColor
  /** Number of evenly-spaced tick marks between startAngle and endAngle.
   * Default `0` (no ticks). Tick marks are short radial lines at the rim. */
  ticks?: number
}

/**
 * Draws a circular analog gauge with a movable needle — RPM, speedometer,
 * fuel level, temperature, volume knob, anything that maps a scalar to an angle.
 *
 * Optional decorations: filled face background, circular rim outline, evenly
 * spaced tick marks. None of these are required; the needle alone is the
 * minimum visible output.
 *
 * @example
 * // Submarine motor RPM gauge (range 0-3000)
 * drawDial(ctx, {
 *   cx: 128, cy: 100, radius: 24,
 *   value: 1500, min: 0, max: 3000,
 *   needleColor: C.B_RED,
 *   rimColor: C.WHITE,
 *   tickColor: C.WHITE,
 *   ticks: 7,
 * })
 *
 * // Bare minimum: just the needle
 * drawDial(ctx, { cx: 50, cy: 50, radius: 10, value: 75, needleColor: C.B_GREEN })
 */
export function drawDial(
  ctx: CanvasRenderingContext2D,
  options: DrawDialOptions,
): void {
  const {
    cx, cy, radius, value,
    min = 0, max = 100,
    startAngle = 3 * Math.PI / 4,
    endAngle   = Math.PI / 4 + 2 * Math.PI,
    needleColor, faceColor, rimColor, tickColor, ticks = 0,
  } = options

  // Face
  if (faceColor !== undefined) {
    ctx.fillStyle = faceColor
    _fillCircle(ctx, cx, cy, radius)
  }

  // Rim
  if (rimColor !== undefined) {
    ctx.fillStyle = rimColor
    _plotCircle(ctx, cx, cy, radius)
  }

  // Ticks
  if (tickColor !== undefined && ticks > 0) {
    ctx.fillStyle = tickColor
    const sweep = endAngle - startAngle
    const innerR = Math.max(0, radius - 3)
    for (let i = 0; i < ticks; i++) {
      const t = ticks === 1 ? 0 : i / (ticks - 1)
      const a = startAngle + sweep * t
      const cosA = Math.cos(a), sinA = Math.sin(a)
      _plotLine(ctx,
        cx + innerR * cosA, cy + innerR * sinA,
        cx + radius * cosA, cy + radius * sinA,
      )
    }
  }

  // Needle
  const clamped = Math.max(min, Math.min(max, value))
  const t = max === min ? 0 : (clamped - min) / (max - min)
  const angle = startAngle + (endAngle - startAngle) * t
  ctx.fillStyle = needleColor
  _plotLine(ctx, cx, cy, cx + radius * Math.cos(angle), cy + radius * Math.sin(angle))
}

/**
 * Options for {@link drawCompassText}.
 */
export type DrawCompassTextOptions = {
  /** Left edge in game pixels (text baseline starts here). */
  x: number
  /** Top edge in game pixels. */
  y: number
  /** Heading in degrees `0..360`. `0`/`360` = North, `90` = East, `180` = South, `270` = West. */
  heading: number
  /** Colour for non-current direction labels. */
  color: SpectrumColor
  /** Colour for the current direction label. Defaults to `color` (no highlight). */
  highlightColor?: SpectrumColor
  /** Optional background colour behind each label. */
  paper?: SpectrumColor
  /** Wrap the two directions immediately adjacent to the centre in square
   * brackets `[NW] [NE]` — the classic tactical-display look from 80s sub
   * and space sims. The outer (±2) directions and the centre are never bracketed.
   * Default `true`. */
  brackets?: boolean
}

const _COMPASS_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

/**
 * Draws a text-based compass heading indicator — the classic 80s tactical
 * display `[W [NW] N [NE] E]` style with the current direction in the centre,
 * highlighted, and the two neighbouring directions on each side.
 *
 * Useful for: submarine HUD, space sim navigation, rally / driving game
 * heading, any first-person game that needs a cheap-to-render compass.
 *
 * The heading is rounded to the nearest 45° step and then five labels are
 * shown — the centre direction plus two on each side, wrapping around as
 * needed (heading `0` → `W [NW] N [NE] E`, heading `90` → `N [NE] E [SE] S`).
 *
 * @example
 * drawCompassText(ctx, {
 *   x: 0, y: 168,
 *   heading: 0,                        // N
 *   color: C.WHITE,
 *   highlightColor: C.B_YELLOW,
 *   paper: C.BLACK,
 * })
 * // Renders: `W [NW] N [NE] E` — centre "N" in bright yellow, ±1 in brackets,
 * // outer ±2 ("W", "E") plain.
 */
export function drawCompassText(
  ctx: CanvasRenderingContext2D,
  options: DrawCompassTextOptions,
): void {
  const {
    x, y, heading, color,
    highlightColor = color, paper, brackets = true,
  } = options

  // Normalise heading into [0, 360)
  const h = ((heading % 360) + 360) % 360
  // Round to nearest 45° step → index 0..7
  const centerIdx = Math.round(h / 45) % 8

  // Five directions: centre and ±1, ±2 (wrapping)
  const indices = [
    (centerIdx + 6) % 8,   // -2
    (centerIdx + 7) % 8,   // -1
    centerIdx,             //  0
    (centerIdx + 1) % 8,   // +1
    (centerIdx + 2) % 8,   // +2
  ]

  let cursorX = x
  for (let i = 0; i < indices.length; i++) {
    const label = _COMPASS_DIRS[indices[i]]
    const isCenter   = i === 2
    const isAdjacent = i === 1 || i === 3
    const shown = isAdjacent && brackets ? `[${label}]` : label
    const ink   = isCenter ? highlightColor : color
    drawText(ctx, shown, cursorX, y, ink, paper)
    cursorX += shown.length * CELL
    // single-cell space between tokens
    cursorX += CELL
  }
}

// ─── Drawing primitives (private) ────────────────────────────────────────────

/**
 * Bresenham line algorithm — plots a 1-pixel-wide line from (x0,y0) to (x1,y1)
 * using the current `ctx.fillStyle`. Coordinates are rounded to integers.
 */
function _plotLine(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
): void {
  let ix0 = Math.round(x0), iy0 = Math.round(y0)
  const ix1 = Math.round(x1), iy1 = Math.round(y1)
  const dx =  Math.abs(ix1 - ix0)
  const dy = -Math.abs(iy1 - iy0)
  const sx = ix0 < ix1 ? 1 : -1
  const sy = iy0 < iy1 ? 1 : -1
  let err = dx + dy
  while (true) {
    ctx.fillRect(ix0, iy0, 1, 1)
    if (ix0 === ix1 && iy0 === iy1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; ix0 += sx }
    if (e2 <= dx) { err += dx; iy0 += sy }
  }
}

/**
 * Midpoint circle algorithm — plots a 1-pixel-wide circle outline of radius
 * `r` centred at (cx,cy) using the current `ctx.fillStyle`.
 */
function _plotCircle(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
): void {
  let x = 0, y = r, d = 1 - r
  while (y >= x) {
    ctx.fillRect(cx + x, cy + y, 1, 1)
    ctx.fillRect(cx + y, cy + x, 1, 1)
    ctx.fillRect(cx - x, cy + y, 1, 1)
    ctx.fillRect(cx - y, cy + x, 1, 1)
    ctx.fillRect(cx + x, cy - y, 1, 1)
    ctx.fillRect(cx + y, cy - x, 1, 1)
    ctx.fillRect(cx - x, cy - y, 1, 1)
    ctx.fillRect(cx - y, cy - x, 1, 1)
    x++
    if (d < 0) {
      d += 2 * x + 1
    } else {
      y--
      d += 2 * (x - y) + 1
    }
  }
}

/**
 * Fills a solid disc of radius `r` centred at (cx,cy) using the current
 * `ctx.fillStyle`. Uses horizontal `fillRect` spans for efficiency.
 */
function _fillCircle(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
): void {
  for (let dy = -r; dy <= r; dy++) {
    const xMax = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)))
    if (xMax >= 0) ctx.fillRect(cx - xMax, cy + dy, 2 * xMax + 1, 1)
  }
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
