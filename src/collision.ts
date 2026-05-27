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

// ─── Pixel-precise collision (bitmap-level) ────────────────────────────────

/**
 * Pre-computed per-row opaque pixel data for a {@link Bitmap}.
 * Build once with {@link bitmapPixelMask}, reuse every frame.
 *
 * Each row is a sorted array of column indices where the bitmap has a set bit.
 * Empty rows have zero-length arrays — never `undefined`.
 *
 * @example
 * ```
 * // 16×16 circular sprite:
 * mask.rows[0]  → [6, 7, 8, 9]              // narrow top
 * mask.rows[7]  → [0, 1, 2, ..., 15]        // full-width middle
 * mask.rows[11] → [3, 4, 10, 11]            // only feet
 * mask.rows[14] → []                         // below feet, empty
 * ```
 */
export interface PixelMask {
  readonly width: number
  readonly height: number
  readonly rows: readonly (readonly number[])[]
  readonly totalPixels: number
}

/**
 * Extract a pixel mask from a {@link Bitmap}.
 * Reads each row's bit data (bit 7 = leftmost pixel) and collects column
 * indices of set (opaque) pixels into sorted arrays.
 *
 * Pre-compute once per sprite definition — the result is immutable and
 * derived from immutable bitmap data.
 *
 * @example
 * ```ts
 * const HERO_MASK = bitmapPixelMask(HERO_BMP)
 * // Now use with masksOverlap() or pixelSolidCount()
 * ```
 */
export function bitmapPixelMask(bitmap: Bitmap): PixelMask {
  const bytesPerRow = bitmap.width / 8
  const rows: number[][] = []
  let total = 0

  for (let row = 0; row < bitmap.height; row++) {
    const cols: number[] = []
    for (let col = 0; col < bitmap.width; col++) {
      const byteIdx = row * bytesPerRow + Math.floor(col / 8)
      const bitIdx = 7 - (col % 8)
      if (bitmap.data[byteIdx]! & (1 << bitIdx)) cols.push(col)
    }
    rows.push(cols)
    total += cols.length
  }

  return { width: bitmap.width, height: bitmap.height, rows, totalPixels: total }
}

/**
 * Count opaque pixels of mask `a` at `(ax, ay)` that overlap with
 * opaque pixels of mask `b` at `(bx, by)`.
 *
 * Returns 0 when no overlap. Any value > 0 means pixel-perfect collision.
 * The count itself is useful for overlap severity — e.g. damage scaling.
 *
 * Uses sorted-merge intersection per row — O(pixels) total, no allocations.
 *
 * @example
 * ```ts
 * const BULLET = bitmapPixelMask(BULLET_BMP)
 * const ENEMY  = bitmapPixelMask(ENEMY_BMP)
 *
 * if (masksOverlap(BULLET, bx, by, ENEMY, ex, ey) > 0) {
 *   destroyEnemy()
 * }
 * ```
 */
export function masksOverlap(
  a: PixelMask, ax: number, ay: number,
  b: PixelMask, bx: number, by: number,
): number {
  const top = Math.max(ay, by)
  const bot = Math.min(ay + a.height, by + b.height)
  if (top >= bot) return 0
  if (ax >= bx + b.width || ax + a.width <= bx) return 0

  let count = 0
  for (let y = top; y < bot; y++) {
    const rowA = a.rows[y - ay]!
    const rowB = b.rows[y - by]!
    if (rowA.length === 0 || rowB.length === 0) continue

    let i = 0, j = 0
    while (i < rowA.length && j < rowB.length) {
      const ca = rowA[i]! + ax
      const cb = rowB[j]! + bx
      if (ca === cb) { count++; i++; j++ }
      else if (ca < cb) i++
      else j++
    }
  }
  return count
}

/**
 * Count opaque pixels of a mask at `(mx, my)` that sit on solid tiles
 * in a {@link TileMap}. Pixel-precise replacement for AABB-based checks.
 *
 * Solves the "character standing on a platform edge" problem: a round
 * sprite with narrow feet can hang over the edge — only real foot pixels
 * are checked, not the full bounding box.
 *
 * ```
 * AABB (16px wide):    ████████████████  → full-width overlap check
 * pixelSolidCount:     ···██····██····  → only feet matter
 * ```
 *
 * @example
 * ```ts
 * const HERO_MASK = bitmapPixelMask(HERO_BMP)
 *
 * // Check if standing: test 1px below current position
 * const standing = pixelSolidCount(HERO_MASK, hero.x, hero.y + 1, map) > 0
 *
 * // Check wall to the right
 * const wallRight = pixelSolidCount(HERO_MASK, hero.x + 1, hero.y, map) > 0
 * ```
 */
export function pixelSolidCount(
  mask: PixelMask,
  mx: number, my: number,
  map: TileMap,
): number {
  let count = 0
  for (let row = 0; row < mask.height; row++) {
    const worldY = my + row
    const tileY = Math.floor(worldY / CELL)
    for (const col of mask.rows[row]!) {
      if (map.isSolid(Math.floor((mx + col) / CELL), tileY)) count++
    }
  }
  return count
}

// ─── AABB sprite wrappers (backward-compatible) ─────────────────────────────

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
