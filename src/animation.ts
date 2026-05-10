/**
 * Time-based easing curve. Maps progress `t` (0..1) to eased value (typically 0..1).
 * Pass to `createTween` via the `ease` option.
 */
export type Easing = (t: number) => number

/**
 * Built-in easing curves for `Tween`. Pass to `createTween({ ease: Easings.easeOut })`.
 * Roll your own by writing any `(t: number) => number` function.
 */
export const Easings = {
  /** Constant velocity. */
  linear: ((t) => t) as Easing,
  /** Slow start, fast end (quadratic in). */
  easeIn: ((t) => t * t) as Easing,
  /** Fast start, slow end (quadratic out). */
  easeOut: ((t) => 1 - (1 - t) * (1 - t)) as Easing,
} as const

// ── Animation: frame timer ──────────────────────────────────────────────────

/**
 * A frame-index timer for sprite-strip animations.
 * Holds no bitmaps — just counts time and reports which frame index should be shown.
 * Use the index to look up your own sprite table (lets one timer drive multi-direction
 * sprites: `SPRITES[playerDir][tickAnimation(walkAnim, dt)]`).
 */
export interface Animation {
  /** Number of frames in the cycle. */
  frameCount: number
  /** Duration of each frame in milliseconds. */
  frameMs: number
  /** When `true` the animation wraps; when `false` it stops on the last frame. */
  loop: boolean
  /** Internal: accumulated time since last reset. */
  elapsed: number
  /** `true` once a non-looping animation has reached its last frame. */
  done: boolean
  /** Optional callback fired exactly once when a non-looping animation completes. */
  onComplete?: () => void
}

/**
 * Creates an `Animation` frame timer at frame 0.
 *
 * @param frameCount - Number of distinct frames (e.g. `2` for a walk cycle, `4` for an explosion)
 * @param frameMs    - Milliseconds per frame
 * @param opts.loop  - When `true` (default) the animation wraps; when `false` it stops on the last frame
 * @param opts.onComplete - Fired exactly once when a non-looping animation reaches its last frame
 *
 * @example
 * const walkAnim = createAnimation(2, 60)                          // looping 2-frame cycle
 * const explosion = createAnimation(4, 50, { loop: false,
 *   onComplete: () => state.phase = 'gameover' })
 */
export function createAnimation(
  frameCount: number,
  frameMs: number,
  opts: { loop?: boolean; onComplete?: () => void } = {},
): Animation {
  return {
    frameCount,
    frameMs,
    loop: opts.loop ?? true,
    elapsed: 0,
    done: false,
    onComplete: opts.onComplete,
  }
}

/**
 * Advances the animation by `dt` milliseconds and returns the current frame index (`0..frameCount-1`).
 * Call once per frame. For non-looping animations, fires `onComplete` once on completion.
 *
 * @param anim - Animation to tick
 * @param dt   - Frame delta in milliseconds
 * @returns Current frame index — use to look up your sprite bitmap
 *
 * @example
 * const idx = tickAnimation(walkAnim, dt)
 * const sprite = PLAYER_FRAMES[playerDir][idx]
 * drawSprite(ctx, sprite, x, y, C.B_WHITE, C.BLACK)
 */
export function tickAnimation(anim: Animation, dt: number): number {
  if (anim.done) return anim.frameCount - 1
  anim.elapsed += dt
  const totalMs = anim.frameCount * anim.frameMs
  if (!anim.loop && anim.elapsed >= totalMs) {
    anim.done = true
    anim.onComplete?.()
    return anim.frameCount - 1
  }
  const t = anim.loop ? anim.elapsed % totalMs : anim.elapsed
  return Math.min(anim.frameCount - 1, Math.floor(t / anim.frameMs))
}

/**
 * Returns the current frame index without advancing time.
 * Useful when reading the index outside the tick (e.g. inside a renderer).
 */
export function getAnimationFrame(anim: Animation): number {
  if (anim.done) return anim.frameCount - 1
  const totalMs = anim.frameCount * anim.frameMs
  const t = anim.loop ? anim.elapsed % totalMs : Math.min(anim.elapsed, totalMs)
  return Math.min(anim.frameCount - 1, Math.floor(t / anim.frameMs))
}

/**
 * Resets the animation to frame 0 and clears `done`.
 * Call before re-using a non-looping animation, or to restart a loop from the beginning.
 */
export function resetAnimation(anim: Animation): void {
  anim.elapsed = 0
  anim.done = false
}

// ── Tween: position interpolator ────────────────────────────────────────────

/**
 * A time-based linear interpolation between two 2D points.
 * Use to slide a sprite from one cell to another, drop a mine in an arc (with `easeIn`),
 * or animate any pair of pixel coordinates.
 *
 * Read `tween.x` / `tween.y` after `tickTween` to draw at the current position.
 */
export interface Tween {
  /** Starting X in game pixels. */
  fromX: number
  /** Starting Y in game pixels. */
  fromY: number
  /** Ending X in game pixels. */
  toX: number
  /** Ending Y in game pixels. */
  toY: number
  /** Total duration in milliseconds. */
  durationMs: number
  /** Internal: time elapsed since creation. */
  elapsed: number
  /** Current interpolated X — updated each `tickTween`. */
  x: number
  /** Current interpolated Y — updated each `tickTween`. */
  y: number
  /** Easing curve mapping linear progress `t` to eased value. */
  ease: Easing
  /** `true` once the tween has reached its end. */
  done: boolean
  /** Optional callback fired exactly once on completion. */
  onComplete?: () => void
}

/**
 * Creates a `Tween` from `(fromX, fromY)` to `(toX, toY)` over `durationMs`.
 * Initial `x`/`y` are set to the starting point.
 *
 * @param fromX, fromY - Starting position in game pixels
 * @param toX, toY     - Ending position in game pixels
 * @param durationMs   - Total duration in milliseconds
 * @param opts.ease    - Easing curve (default `Easings.linear`)
 * @param opts.onComplete - Fired exactly once when the tween reaches its end
 *
 * @example
 * // Slide player from one cell to the next over 120ms
 * state.walkTween = createTween(
 *   state.playerCol * 8, state.playerRow * 8,
 *   newCol * 8, newRow * 8,
 *   120,
 *   { onComplete: () => commitMove(state) },
 * )
 */
export function createTween(
  fromX: number, fromY: number,
  toX: number, toY: number,
  durationMs: number,
  opts: { ease?: Easing; onComplete?: () => void } = {},
): Tween {
  return {
    fromX, fromY, toX, toY, durationMs,
    elapsed: 0,
    x: fromX, y: fromY,
    ease: opts.ease ?? Easings.linear,
    done: false,
    onComplete: opts.onComplete,
  }
}

/**
 * Advances the tween by `dt` milliseconds and updates `tween.x` / `tween.y`.
 * Returns `true` once the tween has finished (also fires `onComplete` exactly once).
 * Subsequent calls after completion are no-ops and return `true`.
 *
 * @param tween - Tween to advance
 * @param dt    - Frame delta in milliseconds
 * @returns `true` when the tween has reached its end this frame or earlier
 *
 * @example
 * if (state.walkTween) {
 *   tickTween(state.walkTween, dt)
 *   // renderer reads state.walkTween.x / .y
 * }
 */
export function tickTween(tween: Tween, dt: number): boolean {
  if (tween.done) return true
  tween.elapsed += dt
  const t = Math.min(1, tween.elapsed / tween.durationMs)
  const eased = tween.ease(t)
  tween.x = tween.fromX + (tween.toX - tween.fromX) * eased
  tween.y = tween.fromY + (tween.toY - tween.fromY) * eased
  if (t >= 1) {
    tween.done = true
    tween.x = tween.toX
    tween.y = tween.toY
    tween.onComplete?.()
  }
  return tween.done
}
