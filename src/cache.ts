/**
 * @module cache
 *
 * **Offscreen layer cache** — render a static (or rarely-changing) layer to an
 * offscreen canvas **once**, then blit it every frame with a single `drawImage`
 * instead of re-rasterising it. This is the antidote to the per-pixel `fillRect`
 * cost of {@link "renderer" | drawBitmap} / {@link "tilescroll" | drawTileMapAt}
 * when they are used for a full-screen layer on every frame.
 *
 * The cache is **dirty-driven**: {@link refreshLayer} re-runs your draw callback
 * only while the cache is `dirty`, then clears the flag. Call
 * {@link invalidateLayer} whenever the layer's contents change (a tile edited, a
 * palette swap, a level reset) to force exactly one re-render next frame.
 *
 * Headless-safe: with no `document` (Node / SSR / tests) the canvas is `null`,
 * `refreshLayer` skips the draw and returns `null`, and nothing throws — mirrors
 * the {@link "lighting" | lighting} module's degrade-gracefully behaviour.
 *
 * @example Cache a whole tile map, blit a moving camera window each frame
 * ```ts
 * const world = tileMapWorldSize(map)
 * const tiles = createLayerCache(world.width, world.height)   // once
 * // game loop:
 * refreshLayer(tiles, (lctx) => drawTileMapAt(lctx, map, 0, 0, world.width, world.height))
 * if (tiles.canvas) ctx.drawImage(tiles.canvas, camX, camY, viewW, viewH, 0, 0, viewW, viewH)
 * // when a tile changes (e.g. a platform crumbles or the level resets):
 * invalidateLayer(tiles)
 * ```
 *
 * @example Cache a static overlay — drawn once, blitted forever
 * ```ts
 * const overlay = createLayerCache(canvas.width, canvas.height)
 * refreshLayer(overlay, (lctx) => drawScanlines(lctx))
 * if (overlay.canvas) ctx.drawImage(overlay.canvas, 0, 0)
 * ```
 */

/** An offscreen canvas plus a dirty flag. `canvas` is `null` when headless. */
export interface LayerCache {
  /** Width of the cached layer in pixels. */
  readonly width: number
  /** Height of the cached layer in pixels. */
  readonly height: number
  /** The offscreen canvas to blit, or `null` with no `document` (headless). */
  readonly canvas: HTMLCanvasElement | null
  /** When `true`, the next {@link refreshLayer} re-runs the draw callback. */
  dirty: boolean
}

/**
 * Creates an offscreen layer cache of the given pixel size. Starts `dirty`, so
 * the first {@link refreshLayer} renders it. Image smoothing is disabled on the
 * offscreen context for crisp ZX output. Create once and reuse across frames.
 *
 * @throws if `width` or `height` is not a positive finite number.
 */
export function createLayerCache(width: number, height: number): LayerCache {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error(`createLayerCache: width and height must be positive, got ${width}×${height}`)
  }
  let canvas: HTMLCanvasElement | null = null
  if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.imageSmoothingEnabled = false
  }
  return { width, height, canvas, dirty: true }
}

/** Marks the cache stale so the next {@link refreshLayer} re-renders it. */
export function invalidateLayer(layer: LayerCache): void {
  layer.dirty = true
}

/**
 * Re-renders the cache via `render` **only if it is dirty**, then clears the
 * dirty flag. `render` receives the offscreen 2D context (already cleared) and
 * should draw the whole layer in layer-local coordinates (top-left = `0,0`).
 * Returns the offscreen canvas to blit (or `null` when headless).
 *
 * Blitting is the caller's job: use a `drawImage` source window for a scrolling
 * camera, or `drawImage(canvas, 0, 0)` for a static overlay.
 */
export function refreshLayer(
  layer: LayerCache,
  render: (ctx: CanvasRenderingContext2D) => void,
): HTMLCanvasElement | null {
  if (layer.dirty) {
    layer.dirty = false
    const ctx = layer.canvas ? layer.canvas.getContext('2d') : null
    if (ctx) {
      ctx.clearRect(0, 0, layer.width, layer.height)
      ctx.imageSmoothingEnabled = false
      render(ctx)
    }
  }
  return layer.canvas
}
