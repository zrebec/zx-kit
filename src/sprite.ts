import { type SpectrumColor } from './palette.js'
import { mirrorSprite, drawSprite as _drawSprite } from './renderer.js'

/**
 * A game entity with position, velocity, and an 8×8 bitmap.
 * Use `createSprite` to create, `moveSprite` / `applyGravity` to update each frame,
 * and `renderSprite` to draw.
 */
export interface Sprite {
  /** Horizontal position in game pixels (float allowed — rounded on render). */
  x: number
  /** Vertical position in game pixels (float allowed — rounded on render). */
  y: number
  /** Horizontal velocity in pixels per millisecond. */
  vx: number
  /** Vertical velocity in pixels per millisecond. */
  vy: number
  /** 8-byte sprite bitmap — one byte per row, bit 7 = leftmost pixel. */
  bitmap: Uint8Array
  /** Foreground colour (`C.*` palette value). */
  ink: SpectrumColor
  /**
   * Background colour, or `null` for a transparent background.
   * Transparent sprites draw only ink pixels — useful over scrolling backgrounds.
   */
  paper: SpectrumColor | null
  /** When `true` the sprite is rendered mirrored horizontally. Bitmap is cached. */
  flipX: boolean
  /** When `false` `renderSprite` skips this sprite entirely. */
  visible: boolean
}

// Lazy cache: avoids creating a new mirrored Uint8Array every frame
const _flipCache = new WeakMap<Uint8Array, Uint8Array>()

function getFlipped(bm: Uint8Array): Uint8Array {
  let flipped = _flipCache.get(bm)
  if (!flipped) {
    flipped = mirrorSprite(bm)
    _flipCache.set(bm, flipped)
  }
  return flipped
}

/**
 * Creates a `Sprite` at position (0, 0) with zero velocity.
 *
 * @param bitmap - 8-byte sprite definition
 * @param ink    - Foreground colour
 * @param paper  - Background colour, or `null` for transparent (default `null`)
 *
 * @example
 * const player = createSprite(PLAYER_BITMAP, C.B_CYAN)
 * const bullet = createSprite(BULLET_BITMAP, C.B_WHITE, C.BLACK)
 */
export function createSprite(
  bitmap: Uint8Array,
  ink: SpectrumColor,
  paper: SpectrumColor | null = null,
): Sprite {
  return { x: 0, y: 0, vx: 0, vy: 0, bitmap, ink, paper, flipX: false, visible: true }
}

/**
 * Advances the sprite position by `vx * dt` and `vy * dt`.
 * Call once per frame before collision resolution.
 *
 * @param sprite - Sprite to update
 * @param dt     - Elapsed time in milliseconds since last frame
 *
 * @example
 * // Game loop
 * moveSprite(player, dt)
 * const { x, hitBottom } = resolveY(player, map, player.y)
 * player.y = y
 * if (hitBottom) player.vy = 0
 */
export function moveSprite(sprite: Sprite, dt: number): void {
  sprite.x += sprite.vx * dt
  sprite.y += sprite.vy * dt
}

/**
 * Adds `gravity * dt` to the sprite's vertical velocity.
 * Call once per frame before `moveSprite`.
 *
 * @param sprite  - Sprite to affect
 * @param gravity - Acceleration in pixels per millisecond² (e.g. `0.003` for gentle gravity)
 * @param dt      - Elapsed time in milliseconds
 *
 * @example
 * applyGravity(player, 0.003, dt)
 * moveSprite(player, dt)
 */
export function applyGravity(sprite: Sprite, gravity: number, dt: number): void {
  sprite.vy += gravity * dt
}

/**
 * Draws the sprite at its current position (rounded to nearest pixel).
 * Does nothing when `sprite.visible === false`.
 * Respects `sprite.paper` (transparent when `null`) and `sprite.flipX`.
 *
 * Must be called after all position updates and collision resolution for the frame.
 *
 * @param ctx    - Canvas 2D context (same one used for the rest of the frame)
 * @param sprite - Sprite to render
 */
export function renderSprite(ctx: CanvasRenderingContext2D, sprite: Sprite): void {
  if (!sprite.visible) return
  const x = Math.round(sprite.x)
  const y = Math.round(sprite.y)
  const bm = sprite.flipX ? getFlipped(sprite.bitmap) : sprite.bitmap
  if (sprite.paper !== null) {
    _drawSprite(ctx, bm, x, y, sprite.ink, sprite.paper)
  } else {
    // Transparent background — draw only ink pixels
    ctx.fillStyle = sprite.ink
    for (let row = 0; row < 8; row++) {
      const byte = bm[row]
      for (let bit = 0; bit < 8; bit++) {
        if (byte & (0x80 >> bit)) ctx.fillRect(x + bit, y + row, 1, 1)
      }
    }
  }
}
