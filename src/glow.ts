/**
 * @module glow
 *
 * **Optional phosphor GLOW / bloom — opt-in, purely additive.** The additive twin
 * of {@link "lighting" | renderDarkness}: where lighting *subtracts* (dithered
 * darkness), glow *adds* (a soft emissive bloom). A game marks its **light
 * sources** — a torch, the moon, a sonar/radar blip — and their colour bleeds into
 * the neighbours, so overlapping haloes sum into *perceived* extra colours **on the
 * glass only**, while the crisp pixel-art framebuffer keeps its flat palette.
 *
 * **Emissive, not brighter (path B).** Glow is a marker on *sources of light*, not
 * a lighter flat colour — the palette is never diluted. Everything the game does
 * NOT draw into the glow layer stays exactly as before: this module adds new
 * exports only, touches no existing render path, and a game that never calls
 * {@link createGlowLayer} / {@link renderGlow} is byte-for-byte unaffected (it
 * tree-shakes away).
 *
 * **Cheap bloom, no WebGL:** the emissive layer is **downscaled** to a small buffer
 * and **upscaled** back with bilinear smoothing — that scaling IS the blur, for
 * free — then blitted onto the frame with `globalCompositeOperation = 'lighter'`
 * (additive). One offscreen buffer, a couple of `drawImage`s, headless-safe.
 *
 * @example
 * ```ts
 * const glow = createGlowLayer(256, 192)           // once, view-sized
 * // each frame, AFTER drawing the scene, BEFORE scanlines:
 * renderGlow(glow, ctx, (g) => {
 *   drawGlowSource(g, { x: torchX, y: torchY, radius: 24, color: C.B_YELLOW, intensity: 0.9 })
 *   drawGlowSource(g, { x: moonX,  y: moonY,  radius: 40, color: C.B_WHITE,  intensity: 0.5 })
 *   // …or draw sprites/pixels directly for pixel-exact glow
 * })
 * ```
 */
import { type SpectrumColor } from './palette.js'

/** Tunables for a {@link GlowLayer}. All optional; defaults are an eye-tuning start. */
export interface GlowOptions {
  /** Blur strength: the emissive layer is scaled down by this factor before the
   *  bilinear upscale spreads it. Bigger = softer & cheaper. Clamped ≥ 1. Default `4`. */
  downscale?: number
  /** How many additive blits of the bloom (brightness/saturation of the halo).
   *  Clamped ≥ 1. Default `1`. */
  passes?: number
  /** Global bloom strength, `0..1` — the `globalAlpha` of each additive blit.
   *  Clamped to `0..1`. Default `0.5`. */
  alpha?: number
}

/** A view-sized glow layer: one emissive canvas + one downscale buffer. Allocate
 *  once, reuse across frames. Both canvases are `null` when headless (no document). */
export interface GlowLayer {
  readonly width: number
  readonly height: number
  readonly downscale: number
  readonly passes: number
  readonly alpha: number
  /** Emissive layer — sources drawn here each frame (transparent elsewhere). `null` headless. */
  readonly source: HTMLCanvasElement | null
  /** Small downscale buffer (the blur). `null` headless. */
  readonly blur: HTMLCanvasElement | null
}

/** A single light source for {@link drawGlowSource}: a soft coloured blob whose
 *  bloom is scaled by `intensity`. Blooms in its **own** `color` — never white-only. */
export interface GlowSource {
  /** Centre in screen px. */
  x: number
  y: number
  /** Reach in px (the blob's radius). */
  radius: number
  /** The source's colour — the halo takes this colour. */
  color: SpectrumColor
  /** Brightness scale `0..1` (default `1`). A dim torch vs a bright radar. */
  intensity?: number
}

const clampInt1 = (n: number, dflt: number): number =>
  Number.isFinite(n) && n >= 1 ? Math.floor(n) : dflt

const clamp01 = (n: number, dflt: number): number =>
  Number.isFinite(n) ? (n < 0 ? 0 : n > 1 ? 1 : n) : dflt

/**
 * Downscale-buffer dimensions for a `width`×`height` view at `downscale` — pure,
 * exported for tests. Each axis is floored, never below 1.
 */
export function glowBufferSize(width: number, height: number, downscale: number): { w: number; h: number } {
  const d = clampInt1(downscale, 4)
  return { w: Math.max(1, Math.floor(width / d)), h: Math.max(1, Math.floor(height / d)) }
}

/**
 * Creates a view-sized glow layer. `opts` tune the bloom ({@link GlowOptions}).
 * Allocate once; reuse. Headless (no `document`): both canvases are `null` and
 * {@link renderGlow} becomes a no-op.
 */
export function createGlowLayer(width: number, height: number, opts: GlowOptions = {}): GlowLayer {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error(`createGlowLayer: width and height must be positive integers, got ${width}×${height}`)
  }
  const downscale = clampInt1(opts.downscale ?? 4, 4)
  const passes = clampInt1(opts.passes ?? 1, 1)
  const alpha = clamp01(opts.alpha ?? 0.5, 0.5)

  let source: HTMLCanvasElement | null = null
  let blur: HTMLCanvasElement | null = null
  if (typeof document !== 'undefined') {
    const { w, h } = glowBufferSize(width, height, downscale)
    source = document.createElement('canvas')
    source.width = width
    source.height = height
    blur = document.createElement('canvas')
    blur.width = w
    blur.height = h
  }

  return { width, height, downscale, passes, alpha, source, blur }
}

/**
 * Draws one {@link GlowSource} — a soft radial blob in the source's own colour,
 * scaled by `intensity` — into the emissive canvas context `g` (the one handed to
 * the {@link renderGlow} callback). The blob fades to transparent at `radius`, so
 * it adds nothing outside its reach when the layer is blitted with `'lighter'`.
 */
export function drawGlowSource(g: CanvasRenderingContext2D, source: GlowSource): void {
  const intensity = clamp01(source.intensity ?? 1, 1)
  if (intensity <= 0 || source.radius <= 0) return
  const grad = g.createRadialGradient(source.x, source.y, 0, source.x, source.y, source.radius)
  grad.addColorStop(0, source.color)
  grad.addColorStop(1, 'transparent')
  const prevAlpha = g.globalAlpha
  g.globalAlpha = intensity
  g.fillStyle = grad
  g.fillRect(source.x - source.radius, source.y - source.radius, source.radius * 2, source.radius * 2)
  g.globalAlpha = prevAlpha
}

/**
 * Renders the bloom onto `ctx`, additively. Call each frame AFTER the scene is
 * drawn (and before scanlines / `curveDisplay`). `drawSources` receives the
 * emissive canvas context — draw your light sources into it (via
 * {@link drawGlowSource} or any drawing). Their colour is then blurred (downscale
 * → bilinear upscale) and blitted onto `ctx` with `'lighter'` at the layer's
 * `alpha`, `passes` times. Restores `ctx`'s composite/alpha/smoothing afterwards,
 * so it composes cleanly with the rest of the frame. Headless: a silent no-op.
 */
export function renderGlow(
  layer: GlowLayer,
  ctx: CanvasRenderingContext2D,
  drawSources: (g: CanvasRenderingContext2D) => void,
): void {
  const { source, blur, width, height, passes, alpha } = layer
  if (!source || !blur) return // headless → nothing to draw

  // Draw the emissive sources, then downscale into the small blur buffer. In a
  // browser both contexts exist; headless-ish (jsdom, getContext null) this block
  // is skipped and only the blit below runs — mirrors renderDarkness.
  const g = source.getContext('2d')
  const b = blur.getContext('2d')
  if (g && b) {
    g.clearRect(0, 0, width, height) // transparent = additive-neutral
    drawSources(g)
    b.imageSmoothingEnabled = true
    b.clearRect(0, 0, blur.width, blur.height)
    b.drawImage(source, 0, 0, blur.width, blur.height) // downscale (average)
  }

  // Upscale + additive blit: drawing the small buffer back to full size with
  // smoothing on IS the blur; 'lighter' sums the haloes over the flat scene.
  const prevSmooth = ctx.imageSmoothingEnabled
  const prevOp = ctx.globalCompositeOperation
  const prevAlpha = ctx.globalAlpha
  ctx.imageSmoothingEnabled = true
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = alpha
  for (let i = 0; i < passes; i++) ctx.drawImage(blur, 0, 0, width, height)
  ctx.imageSmoothingEnabled = prevSmooth
  ctx.globalCompositeOperation = prevOp
  ctx.globalAlpha = prevAlpha
}
