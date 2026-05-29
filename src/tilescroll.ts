/**
 * @module tilescroll
 *
 * **Pixel-smooth tile-map scrolling.** The built-in {@link "tilemap" |
 * TileMap.render} takes a viewport in *whole tiles*, so a camera can only move
 * in 8-pixel steps — fine for grid games, visibly steppy for a platformer where
 * the player moves sub-pixel-smooth while jumping.
 *
 * {@link drawTileMapAt} renders the map at an arbitrary pixel camera position by
 * drawing one extra row/column and offsetting every tile by `camX % CELL` /
 * `camY % CELL`. Off-screen and empty cells are skipped; the leading/trailing
 * partial tiles are drawn and naturally clipped by the canvas bounds.
 *
 * @example
 * ```ts
 * const cam = createCamera({ viewW: 256, viewH: 192, ...tileMapWorldSize(map) })
 * // game loop:
 * setCameraTarget(cam, player.x, player.y)
 * tickCamera(cam, dt)
 * drawTileMapAt(ctx, map, cam.x, cam.y)        // smooth background
 * // …draw entities at (e.x - cam.x, e.y - cam.y)…
 * ```
 */
import { CELL } from './palette.js'
import { drawSprite } from './renderer.js'
import type { TileMap } from './tilemap.js'

/**
 * Returns the map's full size in pixels — handy for `worldW`/`worldH` when
 * constructing a {@link "camera" | Camera}.
 *
 * @example
 * const { width, height } = tileMapWorldSize(map)
 */
export function tileMapWorldSize(map: TileMap): { width: number; height: number } {
  return { width: map.cols * CELL, height: map.rows * CELL }
}

/**
 * Renders `map` with the viewport's top-left at world pixel `(camX, camY)`.
 * The camera position is rounded to whole pixels for crisp output, then the
 * visible tile range (plus one overscan row/column) is drawn at
 * `tileX * CELL - camX`, giving smooth scrolling at any pixel offset.
 *
 * @param viewW - Visible width in pixels (default `256`). Must be positive.
 * @param viewH - Visible height in pixels (default `192`). Must be positive.
 *
 * @example
 * drawTileMapAt(ctx, map, cam.x, cam.y)            // standard 256×192
 * drawTileMapAt(ctx, map, cam.x, cam.y, 256, 176)  // shorter play area
 */
export function drawTileMapAt(
  ctx: CanvasRenderingContext2D,
  map: TileMap,
  camX: number,
  camY: number,
  viewW = 256,
  viewH = 192,
): void {
  if (viewW <= 0 || viewH <= 0) {
    throw new Error(`drawTileMapAt: viewW and viewH must be positive, got ${viewW}×${viewH}`)
  }

  const ox = Math.round(camX)
  const oy = Math.round(camY)
  const startCol = Math.floor(ox / CELL)
  const startRow = Math.floor(oy / CELL)
  const cols = Math.ceil(viewW / CELL) + 1
  const rows = Math.ceil(viewH / CELL) + 1

  for (let ry = 0; ry < rows; ry++) {
    const ty = startRow + ry
    if (ty < 0 || ty >= map.rows) continue
    for (let rx = 0; rx < cols; rx++) {
      const tx = startCol + rx
      if (tx < 0 || tx >= map.cols) continue
      const tile = map.getTile(tx, ty)
      if (tile === null) continue
      drawSprite(ctx, tile.sprite, tx * CELL - ox, ty * CELL - oy, tile.ink, tile.paper)
    }
  }
}
