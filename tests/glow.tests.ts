import { describe, it, expect, vi } from 'vitest'
import { glowBufferSize, createGlowLayer, drawGlowSource, renderGlow } from '../src/glow.js'
import { C } from '../src/palette.js'

// The suite runs in the `node` environment (no `document`), so the canvas paths
// are exercised via a fake document whose canvases hand out mock 2D contexts.
// Each created canvas exposes its context as `_ctx` for assertions.
function fakeDocument() {
  return {
    createElement: (_tag: string) => {
      const ctx = {
        imageSmoothingEnabled: false,
        globalAlpha: 1,
        fillStyle: '' as unknown,
        clearRect: vi.fn(),
        drawImage: vi.fn(),
        fillRect: vi.fn(),
        createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      }
      return { width: 0, height: 0, getContext: vi.fn(() => ctx), _ctx: ctx }
    },
  } as unknown as Document
}

// A main-canvas ctx that captures composite state AT blit time (renderGlow
// restores it afterwards, so the final state can't reveal what it used).
function mockMainCtx() {
  const seen: Array<{ op: string; alpha: number; smooth: boolean }> = []
  const ctx = { imageSmoothingEnabled: false, globalCompositeOperation: 'source-over', globalAlpha: 1, drawImage: vi.fn() }
  ctx.drawImage = vi.fn(() =>
    seen.push({ op: ctx.globalCompositeOperation, alpha: ctx.globalAlpha, smooth: ctx.imageSmoothingEnabled }),
  )
  return { ctx: ctx as unknown as CanvasRenderingContext2D, raw: ctx, seen }
}

// ── glowBufferSize — pure downscale-buffer dimensions ───────────────────────────

describe('glowBufferSize', () => {
  it('divides each axis by downscale, floored, never below 1', () => {
    expect(glowBufferSize(256, 192, 4)).toEqual({ w: 64, h: 48 })
    expect(glowBufferSize(255, 191, 4)).toEqual({ w: 63, h: 47 }) // floor, not round
    expect(glowBufferSize(2, 2, 8)).toEqual({ w: 1, h: 1 })       // clamped to 1
  })

  it('clamps a bad downscale to the default 4', () => {
    expect(glowBufferSize(256, 192, 0)).toEqual({ w: 64, h: 48 })
    expect(glowBufferSize(256, 192, -3)).toEqual({ w: 64, h: 48 })
    expect(glowBufferSize(256, 192, NaN)).toEqual({ w: 64, h: 48 })
  })
})

// ── createGlowLayer ─────────────────────────────────────────────────────────────

describe('createGlowLayer', () => {
  it('stores the view size and the tunables', () => {
    const l = createGlowLayer(256, 192, { downscale: 2, passes: 3, alpha: 0.7 })
    expect(l.width).toBe(256)
    expect(l.height).toBe(192)
    expect(l.downscale).toBe(2)
    expect(l.passes).toBe(3)
    expect(l.alpha).toBe(0.7)
  })

  it('defaults and clamps the tunables', () => {
    const def = createGlowLayer(64, 64)
    expect(def.downscale).toBe(4)
    expect(def.passes).toBe(1)
    expect(def.alpha).toBe(0.5)

    const clamped = createGlowLayer(64, 64, { downscale: 0, passes: 0, alpha: 5 })
    expect(clamped.downscale).toBe(4) // < 1 → default
    expect(clamped.passes).toBe(1)    // < 1 → default
    expect(clamped.alpha).toBe(1)     // > 1 → clamped
  })

  it('throws on a non-positive / non-integer size', () => {
    expect(() => createGlowLayer(0, 10)).toThrow(/positive integers/)
    expect(() => createGlowLayer(10, -1)).toThrow(/positive integers/)
    expect(() => createGlowLayer(10.5, 10)).toThrow(/positive integers/)
  })

  it('is headless-safe: no document → both canvases null', () => {
    // (node env has no document already, but be explicit)
    expect(typeof document === 'undefined').toBe(true)
    const l = createGlowLayer(64, 64)
    expect(l.source).toBeNull()
    expect(l.blur).toBeNull()
  })

  it('allocates and sizes the canvases when a document exists', () => {
    vi.stubGlobal('document', fakeDocument())
    try {
      const l = createGlowLayer(256, 192, { downscale: 4 })
      expect(l.source!.width).toBe(256)
      expect(l.source!.height).toBe(192)
      expect(l.blur!.width).toBe(64)
      expect(l.blur!.height).toBe(48)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

// ── drawGlowSource — a scaled, coloured emissive blob ───────────────────────────

function mockEmissive() {
  const grad = { addColorStop: vi.fn() }
  const raw = {
    globalAlpha: 1,
    fillStyle: '' as unknown,
    createRadialGradient: vi.fn(() => grad),
    fillRect: vi.fn(),
  }
  return { g: raw as unknown as CanvasRenderingContext2D, raw, grad }
}

describe('drawGlowSource', () => {
  it('draws a radial blob in the source colour, scaled by intensity, and restores alpha', () => {
    const { g, raw, grad } = mockEmissive()
    drawGlowSource(g, { x: 10, y: 12, radius: 8, color: C.B_YELLOW, intensity: 0.5 })
    expect(raw.createRadialGradient).toHaveBeenCalledWith(10, 12, 0, 10, 12, 8)
    expect(grad.addColorStop).toHaveBeenCalledWith(0, C.B_YELLOW) // blooms in its OWN colour
    expect(grad.addColorStop).toHaveBeenCalledWith(1, 'transparent')
    expect(raw.fillRect).toHaveBeenCalled()
    expect(raw.globalAlpha).toBe(1) // restored after the intensity-scaled fill
  })

  it('is a no-op for intensity 0 or radius 0 (nothing added)', () => {
    const { g, raw } = mockEmissive()
    drawGlowSource(g, { x: 0, y: 0, radius: 0, color: C.B_WHITE })
    drawGlowSource(g, { x: 0, y: 0, radius: 8, color: C.B_WHITE, intensity: 0 })
    expect(raw.createRadialGradient).not.toHaveBeenCalled()
  })
})

// ── renderGlow — the additive bloom blit ────────────────────────────────────────

describe('renderGlow', () => {
  it('is headless-safe: no document → no-op, main ctx untouched', () => {
    const layer = createGlowLayer(64, 64) // node env → source/blur null
    const { ctx, raw } = mockMainCtx()
    expect(() => renderGlow(layer, ctx, () => {})).not.toThrow()
    expect(raw.drawImage).not.toHaveBeenCalled()
  })

  it('draws sources → downscales → blits additively with lighter, once per pass, then restores ctx', () => {
    vi.stubGlobal('document', fakeDocument())
    try {
      const layer = createGlowLayer(256, 192, { passes: 2, alpha: 0.4 })
      const { ctx, raw, seen } = mockMainCtx()
      const draw = vi.fn()
      renderGlow(layer, ctx, draw)

      const srcCtx = (layer.source as unknown as { _ctx: { clearRect: ReturnType<typeof vi.fn> } })._ctx
      const blurCtx = (layer.blur as unknown as { _ctx: { drawImage: ReturnType<typeof vi.fn> } })._ctx
      expect(draw).toHaveBeenCalledWith(srcCtx)      // the game gets the emissive ctx
      expect(srcCtx.clearRect).toHaveBeenCalled()    // emissive cleared (transparent = additive-neutral)
      expect(blurCtx.drawImage).toHaveBeenCalled()   // downscale into the blur buffer

      expect(raw.drawImage).toHaveBeenCalledTimes(2)                 // one blit per pass
      expect(seen.every((s) => s.op === 'lighter')).toBe(true)      // additive
      expect(seen.every((s) => s.alpha === 0.4)).toBe(true)         // the layer's alpha
      expect(seen.every((s) => s.smooth === true)).toBe(true)       // bilinear = the blur
      expect(raw.globalCompositeOperation).toBe('source-over')      // restored to the caller's state
      expect(raw.globalAlpha).toBe(1)
      expect(raw.imageSmoothingEnabled).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
