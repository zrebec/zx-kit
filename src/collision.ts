import { CELL } from './palette.js'
import type { Sprite } from './sprite.js'
import type { TileMap } from './tilemap.js'

/**
 * Axis-aligned bounding rectangle in game pixels.
 */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Returns the bounding `Rect` for a sprite (always `CELL × CELL`).
 * Position is taken from `sprite.x / sprite.y` without rounding —
 * use this for precise overlap tests during the same frame the sprite moved.
 */
export function spriteRect(sprite: Sprite): Rect {
  return { x: sprite.x, y: sprite.y, w: CELL, h: CELL }
}

/**
 * Returns `true` when rectangles `a` and `b` overlap (share at least one pixel).
 * Touching edges (shared border, zero overlap area) returns `false`.
 *
 * @example
 * if (rectsOverlap(spriteRect(bullet), spriteRect(enemy))) { hitEnemy() }
 */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y
}

/**
 * Shorthand for `rectsOverlap(spriteRect(a), spriteRect(b))`.
 *
 * @example
 * if (spritesOverlap(player, coin)) collectCoin()
 */
export function spritesOverlap(a: Sprite, b: Sprite): boolean {
  return rectsOverlap(spriteRect(a), spriteRect(b))
}

/**
 * Returns `true` when the game pixel at `(px, py)` falls inside a solid tile.
 * Converts pixel coords to tile coords via integer division by `CELL`.
 * Out-of-bounds pixels are treated as solid (map boundary is an implicit wall).
 *
 * @example
 * if (isSolidAt(map, player.x, player.y + CELL)) { player.vy = 0 } // on floor
 */
export function isSolidAt(map: TileMap, px: number, py: number): boolean {
  return map.isSolid(Math.floor(px / CELL), Math.floor(py / CELL))
}

/**
 * Resolves a proposed horizontal movement for a sprite against solid tiles.
 * Tests the leading edge of the sprite's bounding box at the target x position.
 * Returns the clamped x coordinate and collision flags.
 *
 * Call BEFORE `resolveY` so each axis is resolved independently.
 *
 * @param sprite - Sprite being moved (uses current `sprite.y` for vertical extent)
 * @param map    - Tile map to test solidity against
 * @param newX   - Proposed new x position (after `moveSprite`)
 *
 * @example
 * moveSprite(player, dt)
 * const rx = resolveX(player, map, player.x)
 * player.x = rx.x
 * if (rx.hitLeft || rx.hitRight) player.vx = 0
 */
export function resolveX(
  sprite: Sprite,
  map: TileMap,
  newX: number,
): { x: number; hitLeft: boolean; hitRight: boolean } {
  const y0 = sprite.y
  const y1 = sprite.y + CELL - 1
  let x = newX
  let hitLeft = false
  let hitRight = false

  if (newX < sprite.x) {
    // Moving left — check left edge
    if (isSolidAt(map, newX, y0) || isSolidAt(map, newX, y1)) {
      // Clamp to in-bounds before computing tile column (avoids negative col from OOB overshoot)
      const safeX = Math.max(0, newX)
      x = (Math.floor(safeX / CELL) + 1) * CELL
      hitLeft = true
    }
  } else if (newX > sprite.x) {
    // Moving right — check right edge
    if (isSolidAt(map, newX + CELL - 1, y0) || isSolidAt(map, newX + CELL - 1, y1)) {
      const safeEdge = Math.min(map.cols * CELL - 1, newX + CELL - 1)
      x = Math.floor(safeEdge / CELL) * CELL - CELL
      hitRight = true
    }
  }

  return { x, hitLeft, hitRight }
}

/**
 * Resolves a proposed vertical movement for a sprite against solid tiles.
 * Tests the leading edge of the sprite's bounding box at the target y position.
 * Returns the clamped y coordinate and collision flags.
 *
 * Typical platformer pattern: `hitBottom` means the sprite landed on a floor.
 * Zero out `vy` on `hitBottom` and `hitTop` to prevent tunnelling.
 *
 * @param sprite - Sprite being moved (uses current `sprite.x` for horizontal extent)
 * @param map    - Tile map to test solidity against
 * @param newY   - Proposed new y position (after `moveSprite`)
 *
 * @example
 * const ry = resolveY(player, map, player.y)
 * player.y = ry.y
 * if (ry.hitBottom) { player.vy = 0; onGround = true }
 * if (ry.hitTop)    { player.vy = 0 }
 */
export function resolveY(
  sprite: Sprite,
  map: TileMap,
  newY: number,
): { y: number; hitTop: boolean; hitBottom: boolean } {
  const x0 = sprite.x
  const x1 = sprite.x + CELL - 1
  let y = newY
  let hitTop = false
  let hitBottom = false

  if (newY < sprite.y) {
    // Moving up — check top edge
    if (isSolidAt(map, x0, newY) || isSolidAt(map, x1, newY)) {
      const safeY = Math.max(0, newY)
      y = (Math.floor(safeY / CELL) + 1) * CELL
      hitTop = true
    }
  } else if (newY > sprite.y) {
    // Moving down — check bottom edge
    if (isSolidAt(map, x0, newY + CELL - 1) || isSolidAt(map, x1, newY + CELL - 1)) {
      const safeEdge = Math.min(map.rows * CELL - 1, newY + CELL - 1)
      y = Math.floor(safeEdge / CELL) * CELL - CELL
      hitBottom = true
    }
  }

  return { y, hitTop, hitBottom }
}
