import { C, CELL, type SpectrumColor } from './palette.js'
import { drawText } from './renderer.js'

/**
 * A snapshot of debug/telemetry numbers for one frame, produced by {@link sampleDebug}.
 *
 * Only what a 2D-canvas browser game can honestly measure: frame pacing and JS main-thread work.
 * There is **no VRAM or GPU figure** — neither is observable from a Canvas2D context (that would
 * need WebGL + driver hooks the browser does not expose). `cpuLoad` is the JS update+render cost
 * against the frame budget, not the GPU's blit time. Resolution, JS heap, draw-call counters and
 * estimated bitmap memory are planned for later slices.
 */
export interface DebugInfo {
  /** Smoothed frames per second (exponential moving average). */
  fps: number
  /** Duration of the last frame in milliseconds (delta between consecutive `beginFrame` calls). */
  frameMs: number
  /** Measured update+render time in ms (between `beginFrame` and `endFrame`); `0` if `endFrame` was not called. */
  workMs: number
  /** Target per-frame budget in ms (`1000 / targetFps`, e.g. `16.67` at 60 fps). */
  budgetMs: number
  /** `workMs / budgetMs` (0..1+): JS main-thread load against the budget. Above `1` means the frame overran. */
  cpuLoad: number
  /** Game-supplied fields merged into the snapshot — e.g. `{ mines: 12, level: 3 }`. */
  custom: Record<string, string | number>
}

/**
 * Per-frame timing state. Create with {@link createDebugMonitor}, bracket each frame with
 * {@link beginFrame} / {@link endFrame}, then read with {@link sampleDebug}.
 * Holds no DOM references — safe to keep at module scope.
 */
export interface DebugMonitor {
  /** Target frame rate used for `budgetMs` / `cpuLoad` (default `60`). */
  targetFps: number
  /** EMA smoothing factor 0..1 applied to `fps` (default `0.1`; higher = snappier, noisier). */
  smoothing: number
  /** Timestamp of the last `beginFrame`, or `null` before the first frame. */
  lastTime: number | null
  /** Timestamp captured at `beginFrame`, used by `endFrame` to compute `workMs`. */
  workStart: number
  /** Current smoothed fps. */
  fps: number
  /** Last frame delta in ms. */
  frameMs: number
  /** Last measured work time in ms. */
  workMs: number
}

/**
 * Creates a frame-timing monitor.
 *
 * @param opts.targetFps - Frame rate the budget/load are measured against (default `60`)
 * @param opts.smoothing - EMA factor 0..1 for the fps readout (default `0.1`)
 *
 * @example
 * const dbg = createDebugMonitor()                       // 60 fps budget
 * const dbg = createDebugMonitor({ targetFps: 50 })      // PAL
 */
export function createDebugMonitor(
  opts: { targetFps?: number; smoothing?: number } = {},
): DebugMonitor {
  return {
    targetFps: opts.targetFps ?? 60,
    smoothing: opts.smoothing ?? 0.1,
    lastTime: null,
    workStart: 0,
    fps: 0,
    frameMs: 0,
    workMs: 0,
  }
}

/**
 * Marks the start of a frame. Updates `frameMs` (delta since the previous `beginFrame`) and the
 * smoothed `fps`, and starts the work-time clock for {@link endFrame}.
 * Call once at the top of your `requestAnimationFrame` loop.
 *
 * @param now - Timestamp in ms (default `performance.now()`); pass the rAF timestamp for accuracy.
 */
export function beginFrame(m: DebugMonitor, now: number = performance.now()): void {
  if (m.lastTime !== null) {
    m.frameMs = now - m.lastTime
    const inst = m.frameMs > 0 ? 1000 / m.frameMs : 0
    // First real sample primes directly; afterwards apply EMA smoothing.
    m.fps = m.fps === 0 ? inst : m.fps + m.smoothing * (inst - m.fps)
  }
  m.lastTime = now
  m.workStart = now
}

/**
 * Marks the end of the frame's JS work (after update + render). Sets `workMs` to the time since
 * {@link beginFrame}. Optional — skip it and `workMs` / `cpuLoad` stay `0`.
 *
 * @param now - Timestamp in ms (default `performance.now()`).
 */
export function endFrame(m: DebugMonitor, now: number = performance.now()): void {
  m.workMs = Math.max(0, now - m.workStart)
}

/**
 * Reads the current numbers as a fresh {@link DebugInfo}. Merge game-specific fields via `custom`.
 *
 * @example
 * const info = sampleDebug(dbg, { mines: mineCount, level })
 */
export function sampleDebug(
  m: DebugMonitor,
  custom: Record<string, string | number> = {},
): DebugInfo {
  const budgetMs = m.targetFps > 0 ? 1000 / m.targetFps : 0
  return {
    fps: m.fps,
    frameMs: m.frameMs,
    workMs: m.workMs,
    budgetMs,
    cpuLoad: budgetMs > 0 ? m.workMs / budgetMs : 0,
    custom,
  }
}

/**
 * Draws a small Spectrum-style debug overlay: `FPS` + frame ms, then `CPU %` (only when work time
 * was measured), then one line per `custom` field. Lines are `CELL`-spaced down from `(x, y)`.
 *
 * The game owns the toggle key and placement — this is just a convenience renderer over
 * {@link drawText}.
 *
 * @param x     - Left edge in game pixels (default `1`)
 * @param y     - Top edge in game pixels (default `1`)
 * @param ink   - Text colour (default `C.B_YELLOW`)
 * @param paper - Background colour for readability (default `C.BLACK`)
 *
 * @example
 * if (showDebug) drawDebugOverlay(ctx, sampleDebug(dbg, { mines }))
 */
export function drawDebugOverlay(
  ctx: CanvasRenderingContext2D,
  info: DebugInfo,
  x: number = 1,
  y: number = 1,
  ink: SpectrumColor = C.B_YELLOW,
  paper: SpectrumColor = C.BLACK,
): void {
  const lines: string[] = [`${Math.round(info.fps)} FPS ${info.frameMs.toFixed(1)}ms`]
  if (info.workMs > 0) lines.push(`CPU ${Math.round(info.cpuLoad * 100)}%`)
  for (const key of Object.keys(info.custom)) lines.push(`${key} ${info.custom[key]}`)
  for (let i = 0; i < lines.length; i++) {
    drawText(ctx, lines[i], x, y + i * CELL, ink, paper)
  }
}
