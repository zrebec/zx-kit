import { describe, it, expect, vi, afterEach } from 'vitest'
import { createLayerCache, invalidateLayer, refreshLayer } from '../src/cache.js'

// ── Mock document/canvas ───────────────────────────────────────────────────────
// zx-kit tests run in the Node env (no real canvas). Stub a minimal document so
// the browser path is exercised; tests that omit the stub hit the headless path.

function installMockDocument() {
  const ctx = {
    imageSmoothingEnabled: true,
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
  }
  vi.stubGlobal('document', { createElement: vi.fn(() => canvas) })
  return { canvas, ctx }
}

afterEach(() => vi.unstubAllGlobals())

// ── createLayerCache ────────────────────────────────────────────────────────────

describe('createLayerCache', () => {
  it('throws on non-positive size', () => {
    expect(() => createLayerCache(0, 10)).toThrow(/positive/)
    expect(() => createLayerCache(10, -1)).toThrow(/positive/)
    expect(() => createLayerCache(Number.NaN, 10)).toThrow(/positive/)
  })

  it('stores the size and starts dirty', () => {
    installMockDocument()
    const layer = createLayerCache(256, 800)
    expect(layer.width).toBe(256)
    expect(layer.height).toBe(800)
    expect(layer.dirty).toBe(true)
  })

  it('sizes the offscreen canvas and disables image smoothing', () => {
    const { canvas, ctx } = installMockDocument()
    createLayerCache(256, 192)
    expect(canvas.width).toBe(256)
    expect(canvas.height).toBe(192)
    expect(ctx.imageSmoothingEnabled).toBe(false)
  })

  it('is headless-safe: canvas is null without a document', () => {
    const layer = createLayerCache(64, 64) // no document stubbed → Node env
    expect(layer.canvas).toBeNull()
  })
})

// ── refreshLayer + invalidateLayer ───────────────────────────────────────────────

describe('refreshLayer', () => {
  it('runs the render callback once while dirty, then caches it', () => {
    installMockDocument()
    const layer = createLayerCache(32, 32)
    const render = vi.fn()
    refreshLayer(layer, render)
    expect(render).toHaveBeenCalledTimes(1)
    expect(layer.dirty).toBe(false)
    refreshLayer(layer, render) // clean → skipped
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('clears the offscreen before rendering and returns the canvas', () => {
    const { canvas, ctx } = installMockDocument()
    const layer = createLayerCache(32, 48)
    const out = refreshLayer(layer, () => {})
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 32, 48)
    expect(out).toBe(canvas)
  })

  it('re-renders again after invalidateLayer', () => {
    installMockDocument()
    const layer = createLayerCache(32, 32)
    const render = vi.fn()
    refreshLayer(layer, render)
    invalidateLayer(layer)
    expect(layer.dirty).toBe(true)
    refreshLayer(layer, render)
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('headless: does not throw, skips render, clears dirty, returns null', () => {
    const layer = createLayerCache(32, 32) // no document
    const render = vi.fn()
    expect(refreshLayer(layer, render)).toBeNull()
    expect(render).not.toHaveBeenCalled()
    expect(layer.dirty).toBe(false)
  })
})

// ── Proof that caching actually happens — work done once, reused per frame ───────
// Simulates a real game loop: the render callback draws many primitives (like a
// tile map). With caching, those draws must run ONCE, not once per frame.

describe('caching behaviour', () => {
  it('does the expensive draw once and reuses it across many frames', () => {
    const { ctx } = installMockDocument()
    const layer = createLayerCache(256, 192)

    // A tile-map-like render: many primitive draws per full re-render.
    const DRAWS_PER_RENDER = 64
    let renderRuns = 0
    const render = (c: CanvasRenderingContext2D) => {
      renderRuns++
      for (let i = 0; i < DRAWS_PER_RENDER; i++) c.fillRect(i, 0, 8, 8)
    }

    // Simulate a 60-frame game loop.
    for (let frame = 0; frame < 60; frame++) refreshLayer(layer, render)

    const fillRect = ctx.fillRect as ReturnType<typeof vi.fn>
    expect(renderRuns).toBe(1)                                  // rendered on frame 0 only
    expect(fillRect.mock.calls.length).toBe(DRAWS_PER_RENDER)   // 64 total, NOT 60×64
  })

  it('reuses the same offscreen canvas every frame (stable blit source)', () => {
    const { canvas } = installMockDocument()
    const layer = createLayerCache(64, 64)
    const a = refreshLayer(layer, () => {})
    const b = refreshLayer(layer, () => {})
    expect(a).toBe(canvas)
    expect(b).toBe(canvas)
  })

  it('re-renders once per invalidation, not per frame (e.g. a crumbling tile)', () => {
    installMockDocument()
    const layer = createLayerCache(64, 64)
    let renderRuns = 0
    const render = (): void => { renderRuns++ }
    for (let frame = 0; frame < 30; frame++) {
      if (frame === 10 || frame === 20) invalidateLayer(layer) // two tile changes
      refreshLayer(layer, render)
    }
    expect(renderRuns).toBe(3) // initial render + 2 invalidations across 30 frames
  })
})
