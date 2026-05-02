import { CELL, type SpectrumColor } from './palette.js'
import { drawSprite } from './renderer.js'

/**
 * A single 8×8 tile placed in a `TileMap`.
 * Sprite format is identical to `drawSprite()` — one byte per row, bit 7 = leftmost pixel.
 */
export interface Tile {
  /** 8-byte sprite bitmap (one byte per row, bit 7 = leftmost pixel). */
  sprite: Uint8Array
  /** Foreground colour — a `C.*` palette value. */
  ink: SpectrumColor
  /** Background colour — a `C.*` palette value. */
  paper: SpectrumColor
  /** When `true` the tile blocks movement (walls, solid objects, map boundary). */
  solid: boolean
  /** Stable identifier used for game logic and smart background swapping. */
  id: string | number
  /** Arbitrary game-specific data attached to this tile instance. */
  metadata?: Record<string, unknown>
}

/** Defines the visible region of a map to render. All values are in tile units, not pixels. */
export interface Viewport {
  /** First visible column (tile units). */
  x: number
  /** First visible row (tile units). */
  y: number
  /** Number of tile columns to render. */
  cols: number
  /** Number of tile rows to render. */
  rows: number
}

/**
 * A scrollable, queryable tile map with O(1) id-based lookup.
 * Obtain an instance via `createTileMap(cols, rows)`.
 *
 * All mutating methods store **shallow copies** of tile objects — the caller
 * may safely reuse or mutate tile definitions without affecting placed tiles.
 */
export interface TileMap {
  /** Map width in tile columns. */
  readonly cols: number
  /** Map height in tile rows. */
  readonly rows: number

  /**
   * Registers or swaps the background tile.
   *
   * - **First call:** stores `tile` as the current background; the map is left unchanged.
   * - **Subsequent calls (smart swap):** every cell whose `id` still matches the previously
   *   registered background is replaced with a shallow copy of the new tile. Cells with
   *   any other `id` (player, objects, modified terrain) are not touched.
   *
   * Comparison is by `id` value, so it works correctly after shallow copies.
   *
   * @example
   * map.fill(TILE_GRASS)
   * map.setBackground(TILE_GRASS)       // registers background; map unchanged
   * map.setTile(3, 5, TILE_PLAYER)
   * map.setBackground(TILE_SNOW)        // grass → snow; TILE_PLAYER untouched
   */
  setBackground(tile: Tile): void

  /**
   * Stores a shallow copy of `tile` at `(x, y)`.
   * Out-of-bounds coordinates are silently ignored.
   */
  setTile(x: number, y: number, tile: Tile): void

  /**
   * Returns the tile at `(x, y)`, or `null` if the cell is empty or out of bounds.
   * Never throws.
   */
  getTile(x: number, y: number): Tile | null

  /**
   * Removes the tile at `(x, y)`, making the cell empty.
   * Out-of-bounds coordinates are silently ignored.
   */
  clearTile(x: number, y: number): void

  /** Fills every cell in the map with a separate shallow copy of `tile`. */
  fill(tile: Tile): void

  /**
   * Fills the rectangle `(x, y) – (x+w, y+h)` with shallow copies of `tile`.
   * Areas outside the map boundary are silently clipped.
   */
  fillRect(x: number, y: number, w: number, h: number, tile: Tile): void

  /**
   * Renders the map (or the given `viewport`) to `ctx` via `drawSprite`.
   * Empty cells are skipped. Tiles partially outside the viewport are not drawn.
   * Canvas pixel position: `canvasX = (tileX - viewport.x) * CELL`.
   *
   * When `viewport` is omitted the entire map is rendered starting at canvas origin.
   */
  render(ctx: CanvasRenderingContext2D, viewport?: Viewport): void

  /**
   * Returns `true` when the tile at `(x, y)` has `solid === true`.
   * Out-of-bounds coordinates return `true` — the map boundary is implicitly solid.
   */
  isSolid(x: number, y: number): boolean

  /**
   * Returns every cell whose tile has the given `id`.
   * Uses an internal index — O(1) lookup, does not iterate the full map.
   * Returns an empty array when no matching tile exists.
   */
  findById(id: string | number): { x: number; y: number; tile: Tile }[]
}

/**
 * Creates a `TileMap` of `cols × rows` tiles. All cells start empty.
 * Use `fill` / `fillRect` / `setTile` to populate terrain, and `setBackground`
 * to register a background tile for later smart swapping.
 *
 * @param cols - Map width in tiles
 * @param rows - Map height in tiles
 *
 * @example
 * import { createTileMap, C } from 'zx-kit'
 *
 * const map = createTileMap(64, 32)
 * map.fill(TILE_GRASS)
 * map.setBackground(TILE_GRASS)
 * map.fillRect(0, 0, 64, 1, TILE_WALL)        // ceiling
 * map.fillRect(0, 31, 64, 1, TILE_WALL)       // floor
 * map.setTile(60, 15, TILE_EXIT)
 *
 * // In game loop — camera follows the player
 * map.render(ctx, { x: camX - 16, y: camY - 12, cols: 32, rows: 24 })
 *
 * // Collision
 * if (!map.isSolid(playerX, playerY + 1)) playerY++
 *
 * // Season swap — player, gems, modified cells are untouched
 * map.setBackground(TILE_SNOW)
 */
export function createTileMap(cols: number, rows: number): TileMap {
  const cells: (Tile | null)[] = new Array<Tile | null>(cols * rows).fill(null)
  const idIndex = new Map<string | number, Set<string>>()
  let currentBackground: Tile | null = null

  function inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < cols && y < rows
  }

  function cellKey(x: number, y: number): string {
    return `${x},${y}`
  }

  function indexRemove(x: number, y: number): void {
    const existing = cells[y * cols + x]
    if (existing === null) return
    const set = idIndex.get(existing.id)
    if (!set) return
    set.delete(cellKey(x, y))
    if (set.size === 0) idIndex.delete(existing.id)
  }

  function indexAdd(x: number, y: number, tile: Tile): void {
    let set = idIndex.get(tile.id)
    if (!set) {
      set = new Set<string>()
      idIndex.set(tile.id, set)
    }
    set.add(cellKey(x, y))
  }

  return {
    get cols() { return cols },
    get rows() { return rows },

    setBackground(tile: Tile): void {
      if (currentBackground === null) {
        currentBackground = { ...tile }
        return
      }
      const oldId = currentBackground.id
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const cell = cells[y * cols + x]
          if (cell !== null && cell.id === oldId) {
            indexRemove(x, y)
            const copy = { ...tile }
            cells[y * cols + x] = copy
            indexAdd(x, y, copy)
          }
        }
      }
      currentBackground = { ...tile }
    },

    setTile(x: number, y: number, tile: Tile): void {
      if (!inBounds(x, y)) return
      indexRemove(x, y)
      const copy = { ...tile }
      cells[y * cols + x] = copy
      indexAdd(x, y, copy)
    },

    getTile(x: number, y: number): Tile | null {
      if (!inBounds(x, y)) return null
      return cells[y * cols + x]
    },

    clearTile(x: number, y: number): void {
      if (!inBounds(x, y)) return
      indexRemove(x, y)
      cells[y * cols + x] = null
    },

    fill(tile: Tile): void {
      idIndex.clear()
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const copy = { ...tile }
          cells[y * cols + x] = copy
          indexAdd(x, y, copy)
        }
      }
    },

    fillRect(x: number, y: number, w: number, h: number, tile: Tile): void {
      const x0 = Math.max(0, x)
      const y0 = Math.max(0, y)
      const x1 = Math.min(cols, x + w)
      const y1 = Math.min(rows, y + h)
      for (let ty = y0; ty < y1; ty++) {
        for (let tx = x0; tx < x1; tx++) {
          indexRemove(tx, ty)
          const copy = { ...tile }
          cells[ty * cols + tx] = copy
          indexAdd(tx, ty, copy)
        }
      }
    },

    render(ctx: CanvasRenderingContext2D, viewport?: Viewport): void {
      const vx = viewport?.x ?? 0
      const vy = viewport?.y ?? 0
      const vcols = viewport?.cols ?? cols
      const vrows = viewport?.rows ?? rows
      for (let row = 0; row < vrows; row++) {
        const ty = vy + row
        if (ty < 0 || ty >= rows) continue
        for (let col = 0; col < vcols; col++) {
          const tx = vx + col
          if (tx < 0 || tx >= cols) continue
          const tile = cells[ty * cols + tx]
          if (tile === null) continue
          drawSprite(ctx, tile.sprite, col * CELL, row * CELL, tile.ink, tile.paper)
        }
      }
    },

    isSolid(x: number, y: number): boolean {
      if (!inBounds(x, y)) return true
      return cells[y * cols + x]?.solid ?? false
    },

    findById(id: string | number): { x: number; y: number; tile: Tile }[] {
      const set = idIndex.get(id)
      if (!set) return []
      const result: { x: number; y: number; tile: Tile }[] = []
      for (const k of set) {
        const comma = k.indexOf(',')
        const tx = parseInt(k.slice(0, comma), 10)
        const ty = parseInt(k.slice(comma + 1), 10)
        const tile = cells[ty * cols + tx]
        if (tile !== null) result.push({ x: tx, y: ty, tile })
      }
      return result
    },
  }
}
