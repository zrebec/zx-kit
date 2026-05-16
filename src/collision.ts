import { CELL } from './palette.js'
import type { Sprite } from './sprite.js'
import type { TileMap } from './tilemap.js'
import type { Bitmap } from './renderer.js'

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
 * Returns the bounding `Rect` for a {@link Bitmap} positioned at `(x, y)`.
 * Works for any size — `16×16`, `16×24`, `32×32`, `96×128`, etc.
 *
 * @example
 * const heroRect  = bitmapRect(HERO_BITMAP,  hero.x,  hero.y)
 * const enemyRect = bitmapRect(ENEMY_BITMAP, enemy.x, enemy.y)
 * if (rectsOverlap(heroRect, enemyRect)) damage(hero)
 */
export function bitmapRect(bitmap: Bitmap, x: number, y: number): Rect {
  return { x, y, w: bitmap.width, h: bitmap.height }
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

// ─── Generic rect-based collision (works for any sprite size) ────────────────

function _solidAlongVerticalEdge(map: TileMap, edgeX: number, y0: number, y1: number): boolean {
  // Check every tile row the edge from y0..y1 crosses (handles tall sprites > CELL).
  const tileTop = Math.floor(y0 / CELL)
  const tileBot = Math.floor(y1 / CELL)
  for (let ty = tileTop; ty <= tileBot; ty++) {
    if (isSolidAt(map, edgeX, ty * CELL)) return true
  }
  return false
}

function _solidAlongHorizontalEdge(map: TileMap, edgeY: number, x0: number, x1: number): boolean {
  // Check every tile column the edge from x0..x1 crosses (handles wide sprites > CELL).
  const tileLeft  = Math.floor(x0 / CELL)
  const tileRight = Math.floor(x1 / CELL)
  for (let tx = tileLeft; tx <= tileRight; tx++) {
    if (isSolidAt(map, tx * CELL, edgeY)) return true
  }
  return false
}

/**
 * Generic horizontal sweep-resolver for any axis-aligned rectangle.
 * Works correctly for sprites taller than `CELL` (e.g. 16×24 hero) — the leading
 * edge is checked across every tile row the rectangle spans, not just two corners.
 *
 * Returns the clamped x and collision flags. On collision, the rectangle is
 * placed flush against the wall.
 *
 * @example
 * const rect = bitmapRect(HERO, hero.x, hero.y)
 * const r = resolveRectX(rect, map, hero.x + dx)
 * hero.x = r.x
 * if (r.hitLeft || r.hitRight) hero.vx = 0
 */
export function resolveRectX(
  rect: Rect,
  map: TileMap,
  newX: number,
): { x: number; hitLeft: boolean; hitRight: boolean } {
  const y0 = rect.y
  const y1 = rect.y + rect.h - 1
  let x = newX
  let hitLeft = false
  let hitRight = false

  if (newX < rect.x) {
    if (_solidAlongVerticalEdge(map, newX, y0, y1)) {
      const safeX = Math.max(0, newX)
      x = (Math.floor(safeX / CELL) + 1) * CELL
      hitLeft = true
    }
  } else if (newX > rect.x) {
    const rightEdge = newX + rect.w - 1
    if (_solidAlongVerticalEdge(map, rightEdge, y0, y1)) {
      const safeEdge = Math.min(map.cols * CELL - 1, rightEdge)
      x = Math.floor(safeEdge / CELL) * CELL - rect.w
      hitRight = true
    }
  }

  return { x, hitLeft, hitRight }
}

/**
 * Generic vertical sweep-resolver for any axis-aligned rectangle.
 * Works correctly for sprites wider than `CELL` — the leading edge is checked
 * across every tile column the rectangle spans.
 *
 * @example
 * const rect = bitmapRect(HERO, hero.x, hero.y)
 * const r = resolveRectY(rect, map, hero.y + dy)
 * hero.y = r.y
 * if (r.hitBottom) { hero.vy = 0; onGround = true }
 */
export function resolveRectY(
  rect: Rect,
  map: TileMap,
  newY: number,
): { y: number; hitTop: boolean; hitBottom: boolean } {
  const x0 = rect.x
  const x1 = rect.x + rect.w - 1
  let y = newY
  let hitTop = false
  let hitBottom = false

  if (newY < rect.y) {
    if (_solidAlongHorizontalEdge(map, newY, x0, x1)) {
      const safeY = Math.max(0, newY)
      y = (Math.floor(safeY / CELL) + 1) * CELL
      hitTop = true
    }
  } else if (newY > rect.y) {
    const bottomEdge = newY + rect.h - 1
    if (_solidAlongHorizontalEdge(map, bottomEdge, x0, x1)) {
      const safeEdge = Math.min(map.rows * CELL - 1, bottomEdge)
      y = Math.floor(safeEdge / CELL) * CELL - rect.h
      hitBottom = true
    }
  }

  return { y, hitTop, hitBottom }
}

/**
 * Resolves a proposed horizontal movement for an 8×8 sprite against solid tiles.
 * Thin wrapper over {@link resolveRectX} preserved for backward compatibility.
 *
 * Call BEFORE `resolveY` so each axis is resolved independently.
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
  return resolveRectX(spriteRect(sprite), map, newX)
}

/**
 * Resolves a proposed vertical movement for an 8×8 sprite against solid tiles.
 * Thin wrapper over {@link resolveRectY} preserved for backward compatibility.
 *
 * Typical platformer pattern: `hitBottom` means the sprite landed on a floor.
 *
 * @example
 * const ry = resolveY(player, map, player.y)
 * player.y = ry.y
 * if (ry.hitBottom) { player.vy = 0; onGround = true }
 */
export function resolveY(
  sprite: Sprite,
  map: TileMap,
  newY: number,
): { y: number; hitTop: boolean; hitBottom: boolean } {
  return resolveRectY(spriteRect(sprite), map, newY)
}
