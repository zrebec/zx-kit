/**
 * @module audio
 *
 * **The beeper** — single-channel, 1-bit-style square-wave audio, faithful to
 * the ZX Spectrum 48K speaker. Use this module for **sound effects** (jumps,
 * shots, hits, beeps) and simple monophonic melodies.
 *
 * For **music** (multi-voice harmony, envelope shaping, noise mixing), use
 * the companion {@link "ay" | ay.ts} module — the AY-3-8912 chip that 128K
 * Spectrum games used alongside the beeper. Both modules share the same
 * `AudioContext` and master `GainNode`, so:
 *
 * - `setMasterVolume()` controls both at once
 * - `initAudio()` initialises both (call once, inside a user-gesture handler)
 * - You can run AY music and beeper SFX in parallel — that's the authentic
 *   128K pattern (Robocop, R-Type, Chase H.Q.…)
 *
 * @see {@link createAY} and {@link playAY} for multi-channel music in `ay.ts`
 */

import { C, CELL, SCALE } from './palette.js'
import type { SpectrumColor } from './palette.js'
import { drawProgressBar } from './ui.js'

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null

const VOLUME_STEP = 0.1

/** Wall-clock time (ms, `performance.now()`) of the last volume change — drives the auto-show HUD bar. */
let _volumeChangedAt = 0

/** How long {@link drawVolumeBar} keeps the bar visible after a change (ms). */
const VOLUME_BAR_MS = 1500

function clampVolume(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/**
 * Creates the shared `AudioContext` and master `GainNode`. Idempotent — safe to call
 * multiple times (subsequent calls are no-ops).
 * Must be called inside a user-gesture handler (click or keydown) due to browser autoplay policy.
 *
 * @param volume - Master gain value (0.0–1.0, default `0.3`). Clamped to valid range.
 *
 * @example
 * window.addEventListener('keydown', () => initAudio(), { once: true })
 */
export function initAudio(volume = 0.3): void {
  if (ctx) return
  ctx = new AudioContext()
  masterGain = ctx.createGain()
  masterGain.gain.value = clampVolume(volume)
  masterGain.connect(ctx.destination)
}

/**
 * Resumes a suspended `AudioContext`. Browsers suspend the context on tab hide or first load.
 * Call before scheduling any audio in the game loop.
 *
 * @example
 * resumeAudio()
 * beep(440, 80, getAudioContext()!.currentTime)
 */
export function resumeAudio(): void {
  if (ctx && ctx.state === 'suspended') void ctx.resume()
}

/**
 * Returns the shared `AudioContext`, or `null` if `initAudio()` has not been called yet.
 * Use to get `currentTime` for scheduling beeps and to check audio readiness.
 *
 * @example
 * const audio = getAudioContext()
 * if (audio) beep(440, 80, audio.currentTime)
 */
export function getAudioContext(): AudioContext | null {
  return ctx
}

/**
 * Returns the master `GainNode`, or `null` before `initAudio()`.
 * Connect your own oscillators/gains to this node to respect the global volume level.
 *
 * @example
 * const osc = ctx.createOscillator()
 * osc.connect(getMasterGain()!)
 */
export function getMasterGain(): GainNode | null {
  return masterGain
}

/**
 * Returns the current master volume (0.0–1.0), or `0` before `initAudio()`.
 *
 * @example
 * const vol = getMasterVolume()  // e.g. 0.3
 */
export function getMasterVolume(): number {
  return masterGain?.gain.value ?? 0
}

/**
 * Sets the master volume. Clamped to 0.0–1.0. No-op before `initAudio()`.
 *
 * @param volume - Target gain value (0.0–1.0)
 *
 * @example
 * setMasterVolume(0.5)   // 50%
 * setMasterVolume(0)     // mute
 */
export function setMasterVolume(volume: number): void {
  if (!masterGain) return
  masterGain.gain.value = clampVolume(volume)
}

/**
 * Increases master volume by 0.1, up to a maximum of 1.0.
 * Also marks the moment so {@link drawVolumeBar} auto-shows the HUD bar — calling
 * this (by key **or** programmatically) makes the bar appear for ~1.5 s.
 *
 * @example
 * increaseVolume()  // 0.3 → 0.4
 */
export function increaseVolume(): void {
  setMasterVolume(getMasterVolume() + VOLUME_STEP)
  _volumeChangedAt = performance.now()
}

/**
 * Decreases master volume by 0.1, down to a minimum of 0.0.
 * Also marks the moment so {@link drawVolumeBar} auto-shows the HUD bar — calling
 * this (by key **or** programmatically) makes the bar appear for ~1.5 s.
 *
 * @example
 * decreaseVolume()  // 0.3 → 0.2
 */
export function decreaseVolume(): void {
  setMasterVolume(getMasterVolume() - VOLUME_STEP)
  _volumeChangedAt = performance.now()
}

// ─── Volume HUD bar ─────────────────────────────────────────────────────────
// A deliberate break from ZX authenticity (the Speccy had no software volume) —
// an "under glass, 2026" affordance like curveDisplay/scanlines. The bar logic is
// a thin wrapper over ui.ts `drawProgressBar` (a managed auto-hide widget); this
// module owns only the style state and the auto-show timestamp.

/** Resolved style for the auto-hide volume bar. Mutated by {@link setVolumeBarStyle}. */
interface VolumeBarStyle {
  color: SpectrumColor
  segments: number
  /** Left edge in game pixels; `undefined` → centred via `ctx.canvas` width. */
  x: number | undefined
  y: number
}

const _volumeBarStyle: VolumeBarStyle = {
  color: C.B_GREEN,           // → drawProgressBar ink
  segments: 10,               // → width = 10 * CELL = 80 px
  x: undefined,               // centred horizontally
  y: 96 - CELL,               // roughly mid-screen
}

/** Optional overrides for {@link setVolumeBarStyle}. */
export interface VolumeBarStyleOptions {
  /** Bar ink colour. Default `C.B_GREEN`. */
  color?: SpectrumColor
  /** Bar width in cells (`width = segments * CELL`). Default `10`. */
  segments?: number
  /** Left edge in game pixels. Omit to centre horizontally. */
  x?: number
  /** Top edge in game pixels. Default `96 - CELL` (≈ mid-screen). */
  y?: number
}

/**
 * Configures the auto-hide volume bar's appearance (config-once style). Stores
 * style in module state only — does **not** render. Optional: the defaults
 * (centred 10-segment green bar, mid-screen) apply if this is never called.
 *
 * @param opts - Style overrides; unspecified fields keep their current value.
 *
 * @example
 * setVolumeBarStyle({ color: C.B_CYAN })          // recolour only
 * setVolumeBarStyle({ segments: 16, y: 176 })     // wider, near the bottom
 */
export function setVolumeBarStyle(opts: VolumeBarStyleOptions = {}): void {
  if (opts.color    !== undefined) _volumeBarStyle.color    = opts.color
  if (opts.segments !== undefined) _volumeBarStyle.segments = opts.segments
  if (opts.x        !== undefined) _volumeBarStyle.x        = opts.x
  if (opts.y        !== undefined) _volumeBarStyle.y        = opts.y
}

/**
 * Draws the volume bar — the only render-loop call. Reads the stored style (see
 * {@link setVolumeBarStyle}); takes no style args. Auto-show: draws nothing once
 * more than ~1.5 s has passed since the last {@link increaseVolume} /
 * {@link decreaseVolume}; otherwise renders the current master volume and hides
 * itself afterwards. Call every frame.
 *
 * @param canvasCtx - The game canvas 2D context (scaled by `SCALE`).
 *
 * @example
 * // in the render loop:
 * drawVolumeBar(ctx)   // shows ~1.5 s after a change, then hides itself
 */
export function drawVolumeBar(canvasCtx: CanvasRenderingContext2D): void {
  if (performance.now() - _volumeChangedAt > VOLUME_BAR_MS) return
  const { color, segments, x, y } = _volumeBarStyle
  const width = segments * CELL
  // drawProgressBar works in game-pixel space; convert the device-pixel backing
  // store to it via the context's current horizontal scale (set by setupCanvas),
  // so centring is correct at any scale. Falls back to SCALE if getTransform is
  // unavailable (e.g. a bare test mock).
  const scaleX = canvasCtx.getTransform?.().a || SCALE
  const screenW = canvasCtx.canvas.width / scaleX
  drawProgressBar(canvasCtx, {
    id: 'zxkit:volume',
    x: x ?? Math.round((screenW - width) / 2),
    y,
    width,
    value: getMasterVolume(),
    min: 0,
    max: 1,
    ink: color,
    paper: C.BLACK,
    border: { style: 'solid' },
    visibilityLength: VOLUME_BAR_MS,
  })
}

/** A single note in a melody pattern. Use `freq: 0` for a rest (silence). */
export interface Note {
  freq: number  // Hz; 0 = rest (silence)
  dur: number   // ms; duration of note or rest
  pan?: number  // -1 = left, 0 = centre (default), +1 = right
}

/**
 * Schedules a sequence of notes on the shared `AudioContext`.
 * Silently exits if audio has not been initialised yet.
 * `freq: 0` entries are treated as rests — they advance the timeline but produce no sound.
 *
 * @param notes      - Array of `Note` objects to play in order
 * @param startDelay - Optional delay before the first note in milliseconds (default `0`)
 *
 * @example
 * // Jingle — three notes with rests
 * playPattern([
 *   { freq: 523, dur: 120 },  // C5
 *   { freq: 0,   dur: 40  },  // rest
 *   { freq: 659, dur: 120 },  // E5
 *   { freq: 0,   dur: 40  },  // rest
 *   { freq: 784, dur: 200 },  // G5
 * ])
 *
 * // With a 500ms delay after scene load
 * playPattern([{ freq: 440, dur: 100 }, { freq: 880, dur: 50 }], 500)
 */
export function playPattern(notes: Note[], startDelay = 0): void {
  const audio = getAudioContext()
  if (!audio) return
  resumeAudio()
  let offset = startDelay
  for (const note of notes) {
    if (note.freq > 0) beep(note.freq, note.dur, audio.currentTime + offset / 1000, note.pan ?? 0)
    offset += note.dur
  }
}

/**
 * Schedules a single square-wave beep on the shared `AudioContext` — the
 * canonical Spectrum **sound effect**: short, monophonic, era-correct.
 *
 * Uses a 5 ms linear ramp attack and release to avoid click artefacts.
 * Routed through the master gain node.
 *
 * **When to reach for `beep`:** SFX (shots, jumps, hits, pickup blips).
 * **For sequences,** use `playPattern`. **For multi-voice music,** use
 * `playAY` from `ay.js` — the two modules are designed to run in parallel
 * (AY music + beeper SFX = the authentic 128K Spectrum sound).
 *
 * @param freq       - Frequency in Hz
 * @param durationMs - Duration in milliseconds
 * @param startTime  - Absolute `AudioContext.currentTime` to start at
 * @param pan        - Stereo position: -1 left … 0 centre (default) … +1 right
 *
 * @example
 * const audio = getAudioContext()!
 * resumeAudio()
 * beep(440, 80, audio.currentTime)
 * beep(880, 80, audio.currentTime + 0.15)  // second note 150ms later
 */
export function beep(freq: number, durationMs: number, startTime: number, pan = 0): void {
  if (!ctx || !masterGain) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(0.8, startTime + 0.005)
  gain.gain.setValueAtTime(0.8, startTime + durationMs / 1000 - 0.005)
  gain.gain.linearRampToValueAtTime(0, startTime + durationMs / 1000)
  osc.connect(gain)
  // pan = 0 (centre) keeps the original graph (gain → master); a non-zero pan
  // inserts a transparent StereoPanner so existing callers are byte-identical.
  if (pan !== 0) {
    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, pan))
    gain.connect(panner)
    panner.connect(masterGain)
  } else {
    gain.connect(masterGain)
  }
  osc.start(startTime)
  osc.stop(startTime + durationMs / 1000 + 0.01)
}
