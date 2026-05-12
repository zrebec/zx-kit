// ── Camera: viewport that follows a target across a larger world ────────────

/**
 * A 2D camera that maps a window of world space onto the screen viewport.
 *
 * The camera's position (`x`, `y`) is the world-pixel coordinate of the viewport's
 * top-left corner. Use `worldToScreen` to convert sprite positions for rendering,
 * or `tickCamera` each frame to follow a moving target with smoothing.
 *
 * **Coordinate model:**
 * - World extends from `(0,0)` to `(worldW, worldH)`
 * - Viewport is a `viewW × viewH` window into the world
 * - Camera clamps so the viewport never sees outside world bounds
 *
 * **Smoothing:**
 * - `lerp = 1` → snaps to target each tick
 * - `lerp < 1` → eases toward target; lower = slower follow
 * - The lerp factor is **frame-rate independent** — internally adjusted by `dt`
 *
 * **Deadzone:**
 * - Rectangle centred on the camera's centre point
 * - While the target stays inside the deadzone, the camera does not move
 * - Once the target exits, the camera shifts just enough to put the target back on the deadzone edge
 */
export interface Camera {
  /** Current viewport top-left X in world pixels. */
  x: number
  /** Current viewport top-left Y in world pixels. */
  y: number
  /** Viewport width in pixels (typically the game's canvas width). */
  viewW: number
  /** Viewport height in pixels. */
  viewH: number
  /** World width in pixels — camera clamps so `x` stays in `[0, worldW - viewW]`. */
  worldW: number
  /** World height in pixels. */
  worldH: number
  /**
   * Lerp factor in `(0..1]` — fraction of remaining distance covered per 60 fps frame.
   * `1` = instant snap, `0.1` = covers 10 % of distance per 16.67 ms.
   * Frame-rate corrected: `tickCamera(cam, 33.34)` ≈ two `tickCamera(cam, 16.67)` calls.
   */
  lerp: number
  /** Deadzone width — target may move ±`deadzoneW/2` from viewport centre without scrolling. */
  deadzoneW: number
  /** Deadzone height. */
  deadzoneH: number
  /** Current target X in world pixels (set via `setCameraTarget`). */
  targetX: number
  /** Current target Y in world pixels. */
  targetY: number
}

/**
 * Options passed to `createCamera`. See {@link Camera} for full semantics.
 */
export interface CameraOptions {
  viewW: number
  viewH: number
  worldW: number
  worldH: number
  /** Default `1` (instant snap). */
  lerp?: number
  /** Default `0`. */
  deadzoneW?: number
  /** Default `0`. */
  deadzoneH?: number
}

/**
 * Creates a Camera at world origin `(0, 0)`.
 *
 * @example
 * const cam = createCamera({
 *   viewW: 256, viewH: 192,            // game canvas size
 *   worldW: 2048, worldH: 192,         // long horizontal level
 *   lerp: 0.15, deadzoneW: 64,         // smooth follow with a centre deadzone
 * })
 */
export function createCamera(opts: CameraOptions): Camera {
  return {
    x: 0,
    y: 0,
    viewW: opts.viewW,
    viewH: opts.viewH,
    worldW: opts.worldW,
    worldH: opts.worldH,
    lerp: opts.lerp ?? 1,
    deadzoneW: opts.deadzoneW ?? 0,
    deadzoneH: opts.deadzoneH ?? 0,
    targetX: 0,
    targetY: 0,
  }
}

/**
 * Sets the world-space point the camera should track.
 * Call each frame with the player (or other follow target) position.
 * Does not move the camera itself — call `tickCamera` for that.
 */
export function setCameraTarget(cam: Camera, x: number, y: number): void {
  cam.targetX = x
  cam.targetY = y
}

/**
 * Advances the camera one frame:
 * 1. Computes the desired viewport position from `targetX/Y`, respecting the deadzone
 * 2. Eases `cam.x/y` toward the desired position by `lerp` (frame-rate-corrected by `dt`)
 * 3. Clamps to world bounds so the viewport never sees outside the world
 *
 * Call once per frame after `setCameraTarget`.
 */
export function tickCamera(cam: Camera, dt: number): void {
  // Desired viewport position that puts target on the relevant deadzone edge.
  const halfW = cam.viewW / 2
  const halfH = cam.viewH / 2
  const dzL = cam.deadzoneW / 2
  const dzT = cam.deadzoneH / 2

  const centerX = cam.x + halfW
  const centerY = cam.y + halfH

  let desiredX = cam.x
  let desiredY = cam.y

  if (cam.targetX > centerX + dzL) {
    desiredX = cam.targetX - halfW - dzL
  } else if (cam.targetX < centerX - dzL) {
    desiredX = cam.targetX - halfW + dzL
  }
  if (cam.targetY > centerY + dzT) {
    desiredY = cam.targetY - halfH - dzT
  } else if (cam.targetY < centerY - dzT) {
    desiredY = cam.targetY - halfH + dzT
  }

  // Frame-rate-corrected lerp: t = 1 - (1 - lerp)^(dt/16.67)
  const FRAME_MS = 16.67
  const t = cam.lerp >= 1
    ? (dt > 0 ? 1 : 0)
    : (dt > 0 ? 1 - Math.pow(1 - cam.lerp, dt / FRAME_MS) : 0)

  cam.x += (desiredX - cam.x) * t
  cam.y += (desiredY - cam.y) * t

  // Clamp to world bounds; if world is smaller than viewport, pin to 0.
  const maxX = Math.max(0, cam.worldW - cam.viewW)
  const maxY = Math.max(0, cam.worldH - cam.viewH)
  if (cam.x < 0) cam.x = 0
  else if (cam.x > maxX) cam.x = maxX
  if (cam.y < 0) cam.y = 0
  else if (cam.y > maxY) cam.y = maxY
}

/**
 * Converts a world coordinate to a screen (viewport-relative) coordinate.
 * Useful when drawing sprites: `drawSprite(ctx, bmp, screen.x, screen.y, ink, paper)`.
 *
 * @example
 * const s = worldToScreen(cam, enemy.x, enemy.y)
 * drawSprite(ctx, ENEMY, s.x, s.y, C.B_RED, C.BLACK)
 */
export function worldToScreen(cam: Camera, wx: number, wy: number): { x: number; y: number } {
  return { x: wx - cam.x, y: wy - cam.y }
}

/**
 * Returns `true` when a world-space rectangle overlaps the camera viewport.
 * Use to cull off-screen sprites before drawing.
 *
 * `w` and `h` default to `0` (point test). For an 8×8 sprite pass `8, 8`.
 *
 * @example
 * for (const e of enemies) {
 *   if (!isInView(cam, e.x, e.y, 8, 8)) continue
 *   // draw e
 * }
 */
export function isInView(cam: Camera, wx: number, wy: number, w = 0, h = 0): boolean {
  return wx + w > cam.x
    && wx < cam.x + cam.viewW
    && wy + h > cam.y
    && wy < cam.y + cam.viewH
}
