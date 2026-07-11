/**
 * @module aydump
 *
 * **Sample-accurate AY register-dump player** — the "sample-accurate
 * AudioWorklet backend" that {@link "ay" | ay.ts} promises on its roadmap.
 * Where `ay.ts` *synthesises* notes (`AYNote[]` → band-limited oscillators),
 * this module *reproduces the hardware*: it feeds a cycle-level emulation of
 * the AY-3-8910 / YM2149 chip a stream of register writes (a **PSG dump**) and
 * renders real PCM — so you can play **actual ZX-scene tunes** in a game.
 *
 * The pipeline is data-driven, exactly like a bitmap font:
 *
 * ```
 *   .psg file (register dump, bundled as data)
 *        │  parsePSG()
 *        ▼
 *   AYDump  (flat typed-array frames: who-writes-what-when)
 *        │  AYDumpPlayer  (applies each frame's writes every sampleRate/50 samples)
 *        ▼
 *   AYChipCore  (16 registers → L/R PCM, HW logic from the datasheet)
 *        │  playAYDump()  (realtime AudioWorklet)  or  renderAYDump() (offline)
 *        ▼
 *   master GainNode (shared with audio.ts / ay.ts — global M mute works for free)
 * ```
 *
 * **Scope:** v1 is the **PSG** format (a raw register dump — HW-level, unambiguous,
 * dependency-free). Anything from zxart.ee (PT3, STC…) is converted to `.psg`
 * **offline** on a PC (Ay_Emul "save as PSG", `zxtune123 --convert`, Vortex
 * Tracker II). The dump is *data*, not a code dependency — Zero Dependencies stays
 * clean. A native PT3 replay routine over the same {@link AYChipCore} is a future
 * (v2) module.
 *
 * **Authorship:** a PSG dump is a derivative of the original tune. zxart hosting is
 * not a licence — ship a track only with the composer's permission (credit + link).
 *
 * @see {@link "ay" | ay.ts} for note-based music, {@link "audio" | audio.ts} for the beeper.
 */

import { AY_CLOCK, AY_VOL } from './ay.js'
import type { AYStereoMode } from './ay.js'
import { initAudio, getAudioContext, getMasterGain } from './audio.js'

// ─── Types & configuration (§4.1) ───────────────────────────────────────────────

/** Chip variant: `ay` = 16-step envelope; `ym` = 32-step envelope (finer). */
export type AYChipVariant = 'ay' | 'ym'

/** How to configure the emulated chip. All fields optional — see defaults below. */
export interface AYChipConfig {
  /** Chip clock in Hz. Default `1_773_400` (ZX 128K). Melodik = `1_750_000`. */
  clockHz?: number
  /** Chip variant. Default `'ay'`. */
  variant?: AYChipVariant
  /** Stereo preset. Default `'acb'` (Melodik jack: A left, C centre, B right). */
  stereo?: AYStereoMode
  /** 16-entry DAC table (level → amplitude). Default zx-kit `AY_VOL`; hook for measured tables. */
  dacTable?: readonly number[]
}

/** Ready-made presets for real machines. */
export const AY_MACHINE = {
  /** ZX Spectrum 128K / +2 / +3 — TV speaker, mono. */
  zx128:    { clockHz: 1_773_400, variant: 'ay', stereo: 'mono' },
  /** Didaktik + Melodik add-on — 1.75 MHz, ACB stereo jack. */
  melodik:  { clockHz: 1_750_000, variant: 'ay', stereo: 'acb' },
  /** Pentagon clone — 1.75 MHz, ACB. */
  pentagon: { clockHz: 1_750_000, variant: 'ay', stereo: 'acb' },
  /** Atari ST — YM2149 at 2 MHz, mono. */
  atariST:  { clockHz: 2_000_000, variant: 'ym', stereo: 'mono' },
} as const satisfies Record<string, AYChipConfig>

// ─── AYChipCore — the chip emulator (§4.2) ───────────────────────────────────────
//
// WORKLET-SAFE INVARIANT: this class must not import or reference anything outside
// itself — its source is stringified via Function.prototype.toString() and injected
// into an AudioWorklet. It receives every constant (clock, DAC table, …) through the
// constructor. It uses only worklet globals: Math, Uint8Array, Array. Do not add a
// module-scope reference here or the worklet will break after minification.

/**
 * Cycle-level AY-3-8910 / YM2149 emulator: register writes in, PCM samples out.
 * Three square-wave tone channels, a shared 17-bit LFSR noise generator, and the
 * hardware envelope generator (16 or 32 steps). Pure and self-contained so it runs
 * inside an AudioWorklet **and** in a headless test with no `AudioContext`.
 *
 * Named `AYChipCore` (not `AYChip`) so it does not collide with the real-time
 * {@link "ay".AYChip} handle interface exported from `ay.ts`.
 */
export class AYChipCore {
  private readonly regs = new Uint8Array(16)

  // Tone: per-channel down-counter + square phase.
  private readonly toneCnt = [0, 0, 0]
  private readonly toneOut = [0, 0, 0]

  // Noise: 17-bit LFSR (seed 1) + counter + current output bit.
  private noiseCnt = 0
  private lfsr = 1
  private noiseOut = 1

  // Envelope generator state.
  private envCnt = 0
  private envPos = 0
  private envAttack = false
  private envHolding = false
  private envCont = 0
  private envAlt = 0
  private envHold = 0

  // Fractional accumulator: chip ticks (clock/8) per output sample.
  private cycleAcc = 0
  private readonly cyclesPerSample: number

  // Per-channel L/R mix gains (0..1), derived from the stereo preset.
  private panL = [0.5, 0.5, 0.5]
  private panR = [0.5, 0.5, 0.5]

  // DC-blocker state per output channel (the chip output is unipolar).
  private dcxL = 0
  private dcyL = 0
  private dcxR = 0
  private dcyR = 0

  /**
   * @param sampleRate Output sample rate (Hz).
   * @param clockHz    Chip master clock (Hz).
   * @param envSteps   Envelope resolution: 16 (AY) or 32 (YM).
   * @param dac        16-entry DAC amplitude table (level → 0..1).
   * @param stereo     Stereo preset (mono / abc / acb).
   */
  constructor(
    sampleRate: number,
    clockHz: number,
    private readonly envSteps: number,
    private readonly dac: readonly number[],
    stereo: AYStereoMode,
  ) {
    // Internal chip tick = 8 master clocks → tone f = clock / (16·TP).
    this.cyclesPerSample = clockHz / 8 / sampleRate
    this.setStereo(stereo)
    this.reset()
  }

  /** Clears counters, registers, LFSR, envelope and DC state. Call at start / seek. */
  reset(): void {
    this.regs.fill(0)
    this.toneCnt[0] = this.toneCnt[1] = this.toneCnt[2] = 0
    this.toneOut[0] = this.toneOut[1] = this.toneOut[2] = 0
    this.noiseCnt = 0
    this.lfsr = 1
    this.noiseOut = 1
    this.envCnt = 0
    this.envPos = 0
    this.envAttack = false
    this.envHolding = false
    this.envCont = this.envAlt = this.envHold = 0
    this.cycleAcc = 0
    this.dcxL = this.dcyL = this.dcxR = this.dcyR = 0
  }

  /**
   * Applies a demoscene stereo preset. Soft panning (0.75/0.25), so headphones
   * don't get a hard 1/0 split; L+R gain per channel always sums to 1.
   */
  setStereo(mode: AYStereoMode): void {
    const L = [0.5, 0.5, 0.5]
    const R = [0.5, 0.5, 0.5]
    const left  = (ch: number): void => { L[ch] = 0.75; R[ch] = 0.25 }
    const right = (ch: number): void => { L[ch] = 0.25; R[ch] = 0.75 }
    if (mode === 'abc') { left(0); right(2) }          // A left, B centre, C right
    else if (mode === 'acb') { left(0); right(1) }     // A left, C centre, B right
    // 'mono' leaves all three centred.
    this.panL = L
    this.panR = R
  }

  /**
   * Writes a chip register (0..15), masking to the hardware register width.
   * Writing R13 (envelope shape) always restarts the envelope.
   */
  setRegister(r: number, v: number): void {
    r &= 0x0F
    switch (r) {
      case 1: case 3: case 5: v &= 0x0F; break  // tone coarse (12-bit period)
      case 6:                 v &= 0x1F; break  // noise period (5-bit)
      case 8: case 9: case 10: v &= 0x1F; break // volume (bit4 = use envelope)
      case 13:                v &= 0x0F; break  // envelope shape
      default:                v &= 0xFF; break
    }
    this.regs[r] = v
    if (r === 13) {
      // Decode R13: bit3=CONT bit2=ATT bit1=ALT bit0=HOLD.
      this.envCont = (v >> 3) & 1
      this.envAlt  = (v >> 1) & 1
      this.envHold =  v       & 1
      this.envAttack = ((v >> 2) & 1) === 1   // ATT sets the initial ramp direction
      this.envHolding = false
      this.envPos = 0
      this.envCnt = 0
    }
  }

  /** Steps the 17-bit LFSR once (feedback = bit0 XOR bit3) and latches the output bit. */
  private stepNoise(): void {
    const bit = (this.lfsr ^ (this.lfsr >> 3)) & 1
    this.lfsr = (this.lfsr >> 1) | (bit << 16)
    this.noiseOut = this.lfsr & 1
  }

  /** Advances the envelope generator by one step (called when its counter elapses). */
  private envStep(): void {
    if (this.envHolding) return
    this.envPos++
    if (this.envPos >= this.envSteps) {
      if (this.envCont === 0 || this.envHold === 1) {
        if (this.envCont === 1 && this.envHold === 1 && this.envAlt === 1) {
          this.envAttack = !this.envAttack
        } else if (this.envCont === 0) {
          this.envAttack = false          // one-shot shapes always settle at 0
        }
        this.envHolding = true
        this.envPos = this.envSteps - 1
      } else {
        if (this.envAlt === 1) this.envAttack = !this.envAttack
        this.envPos = 0
      }
    }
  }

  /** Current envelope amplitude as a DAC index (0..15). */
  private envLevel(): number {
    const lvl = this.envAttack ? this.envPos : (this.envSteps - 1 - this.envPos)
    return this.envSteps === 32 ? (lvl >> 1) : lvl
  }

  /**
   * Renders `count` stereo samples into `left`/`right` starting at `offset`.
   * Box-filters the chip's raw ticks within each output sample (a cheap
   * anti-alias), then DC-blocks each output channel.
   */
  renderInto(left: Float32Array, right: Float32Array, offset: number, count: number): void {
    const r = this.regs
    const dac = this.dac
    const HEADROOM = 0.5   // three channels + soft pan must not clip the bus

    for (let i = 0; i < count; i++) {
      this.cycleAcc += this.cyclesPerSample
      let ticks = Math.floor(this.cycleAcc)
      this.cycleAcc -= ticks
      if (ticks < 1) ticks = 1

      let sumL = 0
      let sumR = 0

      for (let t = 0; t < ticks; t++) {
        // ── Tone counters ──
        for (let ch = 0; ch < 3; ch++) {
          let tp = ((r[ch * 2 + 1] & 0x0F) << 8) | r[ch * 2]
          if (tp === 0) tp = 1
          if (++this.toneCnt[ch] >= tp) {
            this.toneCnt[ch] = 0
            this.toneOut[ch] ^= 1
          }
        }

        // ── Noise (17-bit LFSR) ──
        let np = r[6] & 0x1F
        if (np === 0) np = 1
        if (++this.noiseCnt >= (np << 1)) {
          this.noiseCnt = 0
          this.stepNoise()
        }

        // ── Envelope ──
        let ep = (r[12] << 8) | r[11]
        if (ep === 0) ep = 1
        const envStepTicks = this.envSteps === 32 ? ep : (ep << 1)
        if (++this.envCnt >= envStepTicks) {
          this.envCnt = 0
          this.envStep()
        }
        const envDac = this.envLevel()

        // ── Mixer + amplitude ──
        const dis = r[7]
        for (let ch = 0; ch < 3; ch++) {
          // R7 is active-low: a set bit disables (forces high) that source.
          const toneBit  = (this.toneOut[ch] | ((dis >> ch) & 1)) & 1
          const noiseBit = (this.noiseOut  | ((dis >> (ch + 3)) & 1)) & 1
          const on = toneBit & noiseBit
          const vreg = r[8 + ch]
          const lvl = (vreg & 0x10) ? envDac : (vreg & 0x0F)
          const s = dac[lvl] * on
          sumL += s * this.panL[ch]
          sumR += s * this.panR[ch]
        }
      }

      const invT = HEADROOM / ticks
      const rawL = sumL * invT
      const rawR = sumR * invT

      // DC-blocker: y = x - x1 + 0.995·y1 (centre the unipolar output).
      const yL = rawL - this.dcxL + 0.995 * this.dcyL
      this.dcxL = rawL; this.dcyL = yL
      const yR = rawR - this.dcxR + 0.995 * this.dcyR
      this.dcxR = rawR; this.dcyR = yR

      left[offset + i]  = yL
      right[offset + i] = yR
    }
  }

  /**
   * @internal Test hook — steps the LFSR `n` times, returning each output bit.
   * Locks the noise sequence against a tap/shift typo (see stepNoise).
   */
  _stepNoiseForTest(n: number): number[] {
    const out: number[] = []
    for (let i = 0; i < n; i++) { this.stepNoise(); out.push(this.noiseOut) }
    return out
  }

  /**
   * @internal Test hook — advances the envelope generator `n` times (after an R13
   * write), returning the amplitude level (0..15) after each step.
   */
  _stepEnvelopeForTest(n: number): number[] {
    const out: number[] = []
    for (let i = 0; i < n; i++) { this.envStep(); out.push(this.envLevel()) }
    return out
  }
}

// ─── AYDump — parsed register dump (§4.3) ────────────────────────────────────────

/**
 * A parsed PSG register dump — flat typed arrays so it transfers into the
 * AudioWorklet with zero copying and allocates nothing on the audio thread.
 * Frame `f`'s writes are `writeRegs[frameOffsets[f] .. frameOffsets[f+1])`.
 */
export interface AYDump {
  /** Frame rate (PSG = 50 Hz). */
  frameRateHz: number
  /** Number of frames. */
  frameCount: number
  /** Register index (0..15) per write, all frames concatenated. */
  writeRegs: Uint8Array
  /** Value per write, parallel to {@link writeRegs}. */
  writeVals: Uint8Array
  /** Length `frameCount + 1`; last element = `writeRegs.length`. */
  frameOffsets: Uint32Array
}

// ─── parsePSG (§4.4) ─────────────────────────────────────────────────────────────

/**
 * Parses a PSG register dump (the format Ay_Emul / zxtune produce) into an
 * {@link AYDump}. A PSG file is a `"PSG\x1a"` header then a byte stream:
 *
 * - `0xFF`        — start a new frame
 * - `0xFE n`      — `n × 4` empty frames (chip holds its state)
 * - `0xFD`        — end of song (often absent: end-of-data ends the song)
 * - `0x00..0x0F`  — register index; the next byte is its value
 * - `0x10..0xFC`  — foreign device (MSX / 2nd chip) → skip this byte and the next
 *
 * @throws if the header is wrong or a register/`0xFE` pair is truncated.
 */
export function parsePSG(bytes: Uint8Array): AYDump {
  if (bytes.length < 16
    || bytes[0] !== 0x50 || bytes[1] !== 0x53 || bytes[2] !== 0x47 || bytes[3] !== 0x1A) {
    throw new Error('parsePSG: bad header (expected "PSG\\x1a")')
  }

  const regs: number[] = []
  const vals: number[] = []
  const offsets: number[] = []   // start index (into regs/vals) of each frame

  const openFrame = (): void => { offsets.push(regs.length) }

  let i = 16
  let ended = false
  while (i < bytes.length && !ended) {
    const b = bytes[i++]
    if (b === 0xFF) {
      openFrame()                              // first 0xFF opens frame 0 — no spurious empty frame
    } else if (b === 0xFE) {
      if (i >= bytes.length) throw new Error('parsePSG: truncated 0xFE run (missing count)')
      const n = bytes[i++]
      for (let k = 0; k < n * 4; k++) openFrame()
    } else if (b === 0xFD) {
      ended = true
    } else if (b <= 0x0F) {
      if (i >= bytes.length) throw new Error('parsePSG: truncated register pair (missing value)')
      if (offsets.length === 0) openFrame()    // tolerate a register write before the first 0xFF
      regs.push(b)
      vals.push(bytes[i++])
    } else {
      // Foreign device (0x10..0xFC): skip this command byte and its value byte.
      i++
    }
  }

  const frameCount = offsets.length
  const frameOffsets = new Uint32Array(frameCount + 1)
  frameOffsets.set(offsets)
  frameOffsets[frameCount] = regs.length

  return {
    frameRateHz: 50,
    frameCount,
    writeRegs: Uint8Array.from(regs),
    writeVals: Uint8Array.from(vals),
    frameOffsets,
  }
}

// ─── AYDumpPlayer — pure playback, no Web Audio (§4.5) ────────────────────────────
//
// WORKLET-SAFE INVARIANT: like AYChipCore, no imports / no module references.

/**
 * Drives an {@link AYChipCore} from an {@link AYDump}: applies each frame's
 * register writes on the right sample and fills PCM buffers. Uses a *fractional*
 * samples-per-frame accumulator so a 3-minute tune doesn't drift at exotic rates.
 * Pure — testable with a spy chip, runnable inside the worklet.
 */
export class AYDumpPlayer {
  private readonly frameCount: number
  private readonly samplesPerFrame: number
  private frame = 0
  private frameAcc = 0
  private ended = false

  /**
   * @param chip         The chip to drive.
   * @param writeRegs    Concatenated register indices (see {@link AYDump}).
   * @param writeVals    Concatenated values.
   * @param frameOffsets Frame boundaries (length `frameCount + 1`).
   * @param frameRateHz  Frames per second (PSG = 50).
   * @param sampleRate   Output sample rate (Hz).
   * @param loop         Restart at `loopFrame` after the last frame.
   * @param loopFrame    Frame to jump to when looping.
   */
  constructor(
    private readonly chip: AYChipCore,
    private readonly writeRegs: Uint8Array,
    private readonly writeVals: Uint8Array,
    private readonly frameOffsets: Uint32Array,
    frameRateHz: number,
    sampleRate: number,
    private readonly loop: boolean,
    private readonly loopFrame: number,
  ) {
    this.frameCount = frameOffsets.length - 1
    this.samplesPerFrame = sampleRate / frameRateHz
  }

  private applyFrame(f: number): void {
    const start = this.frameOffsets[f]
    const end = this.frameOffsets[f + 1]
    for (let k = start; k < end; k++) {
      this.chip.setRegister(this.writeRegs[k], this.writeVals[k])
    }
  }

  /** Fills `left`/`right` completely. Returns `true` once the (non-looping) song has ended. */
  render(left: Float32Array, right: Float32Array): boolean {
    const N = left.length
    let i = 0
    while (i < N) {
      if (this.frameAcc <= 0) {
        if (this.frame >= this.frameCount) {
          if (this.loop) this.frame = this.loopFrame
          else this.ended = true
        }
        if (this.ended) {
          for (; i < N; i++) { left[i] = 0; right[i] = 0 }
          break
        }
        this.applyFrame(this.frame)
        this.frame++
        this.frameAcc += this.samplesPerFrame
      }
      let n = Math.min(N - i, Math.ceil(this.frameAcc))
      if (n < 1) n = 1
      this.chip.renderInto(left, right, i, n)
      this.frameAcc -= n
      i += n
    }
    return this.ended
  }

  /** Fast-forwards to frame `f` by replaying its register writes without rendering. */
  seekToFrame(f: number): void {
    this.chip.reset()
    const target = Math.max(0, Math.min(f, this.frameCount))
    for (let k = 0; k < target; k++) this.applyFrame(k)
    this.frame = target
    this.frameAcc = 0
    this.ended = false
  }
}

// ─── Config resolution (module scope — resolves defaults OUTSIDE the worklet classes) ──

interface ResolvedConfig {
  clockHz: number
  variant: AYChipVariant
  envSteps: number
  dac: number[]
  stereo: AYStereoMode
}

function resolveConfig(opts: AYChipConfig): ResolvedConfig {
  const variant = opts.variant ?? 'ay'
  return {
    clockHz: opts.clockHz ?? AY_CLOCK,
    variant,
    envSteps: variant === 'ym' ? 32 : 16,
    dac: Array.from(opts.dacTable ?? AY_VOL),
    stereo: opts.stereo ?? 'acb',
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

// ─── Web Audio bridge (§4.6) ─────────────────────────────────────────────────────

/** Live handle to a {@link playAYDump} call. */
export interface AYDumpHandle {
  /** Detach the node and stop playback (irreversible). */
  stop(): void
  /** Silence via the gain node (the worklet keeps running) — instant. */
  pause(): void
  /** Restore the pre-pause volume. */
  resume(): void
  /** Per-track volume, 0..1 (master volume stays with audio.ts). */
  setVolume(v: number): void
  /** Change the stereo preset live. */
  setStereo(mode: AYStereoMode): void
  /** `true` while the node is connected and not stopped. */
  readonly playing: boolean
  /** Called once when a non-looping song finishes. */
  onEnded?: () => void
}

/** Options for {@link playAYDump}. */
export interface PlayAYDumpOptions extends AYChipConfig {
  /** Loop at `loopFrame` after the last frame. Default `false`. */
  loop?: boolean
  /** Frame to loop back to. Default `0`. */
  loopFrame?: number
  /** Initial per-track volume 0..1. Default `1`. */
  volume?: number
}

/** Name the worklet processor is registered under. */
const AYDUMP_PROCESSOR = 'zxkit-aydump'

/**
 * Assembles the AudioWorklet source: the two worklet-safe classes stringified,
 * plus a processor that loads a dump and renders it.
 *
 * Each class is bound to a **fixed name we control** (`const __AYChipCore = …`).
 * This is essential: a bundler (Vite/esbuild) commonly emits a class as an
 * *anonymous* expression (`var AYChipCore = class {…}`), so its `.toString()`
 * has no name. Injected as a bare top-level statement that would be
 * `class {…}` → **SyntaxError: class statement requires a name**. Assigning it to
 * a `const` makes it a valid class expression whatever form `toString()` takes,
 * and neither class references its own name internally, so renaming is safe.
 *
 * Internal; exported only so a test can assemble and evaluate the source.
 */
export function _buildAYDumpWorkletSource(): string {
  const Chip = '__AYChipCore'
  const Player = '__AYDumpPlayer'
  return `const ${Chip} = ${AYChipCore.toString()};
const ${Player} = ${AYDumpPlayer.toString()};
registerProcessor(${JSON.stringify(AYDUMP_PROCESSOR)}, class extends AudioWorkletProcessor {
  constructor() {
    super()
    this.player = null
    this.chip = null
    this.endedPosted = false
    this.port.onmessage = (e) => {
      const d = e.data
      if (d.type === 'load') {
        const chip = new ${Chip}(sampleRate, d.clockHz, d.envSteps, d.dac, d.stereo)
        this.chip = chip
        this.player = new ${Player}(chip,
          new Uint8Array(d.writeRegs), new Uint8Array(d.writeVals),
          new Uint32Array(d.frameOffsets), d.frameRateHz, sampleRate, d.loop, d.loopFrame)
        this.endedPosted = false
      } else if (d.type === 'stereo' && this.chip) {
        this.chip.setStereo(d.mode)
      }
    }
  }
  process(_inputs, outputs) {
    const out = outputs[0]
    if (!this.player) return true
    const ended = this.player.render(out[0], out[1])
    if (ended && !this.endedPosted) { this.endedPosted = true; this.port.postMessage({ type: 'ended' }) }
    return true
  }
})`
}

// One-time worklet registration per AudioContext.
const _workletReady = new WeakSet<BaseAudioContext>()

async function ensureAYDumpWorklet(ctx: BaseAudioContext): Promise<void> {
  if (_workletReady.has(ctx)) return
  const src = _buildAYDumpWorkletSource()
  const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))
  try {
    await ctx.audioWorklet.addModule(url)
  } finally {
    URL.revokeObjectURL(url)
  }
  _workletReady.add(ctx)
}

/**
 * Plays a parsed {@link AYDump} in real time through an AudioWorklet, routed to the
 * shared master gain (so global `M` mute / `setMasterVolume` apply for free).
 * Call after {@link initAudio} inside a user gesture — same contract as `playAY`.
 *
 * @example
 * const dump = await loadPSG('./music/tune.psg')
 * const track = await playAYDump(dump, { loop: true, ...AY_MACHINE.melodik })
 * // later: track.setVolume(0.6); track.stop()
 */
export async function playAYDump(dump: AYDump, opts: PlayAYDumpOptions = {}): Promise<AYDumpHandle> {
  initAudio()
  const ctx = getAudioContext()
  const master = getMasterGain()
  if (!ctx || !master) {
    throw new Error('playAYDump: call initAudio() inside a user gesture first')
  }
  await ensureAYDumpWorklet(ctx)

  const cfg = resolveConfig(opts)
  const node = new AudioWorkletNode(ctx, AYDUMP_PROCESSOR, { outputChannelCount: [2] })
  const gain = ctx.createGain()
  let volume = clamp01(opts.volume ?? 1)
  gain.gain.value = volume
  node.connect(gain)
  gain.connect(master)

  // Copy the arrays before transferring their buffers, so the caller's dump stays
  // usable (e.g. to play it again) — the copy is cheap next to zero-copy on the audio thread.
  const wr = dump.writeRegs.slice()
  const wv = dump.writeVals.slice()
  const fo = dump.frameOffsets.slice()
  node.port.postMessage(
    {
      type: 'load',
      clockHz: cfg.clockHz, envSteps: cfg.envSteps, dac: cfg.dac, stereo: cfg.stereo,
      writeRegs: wr, writeVals: wv, frameOffsets: fo,
      frameRateHz: dump.frameRateHz, loop: !!opts.loop, loopFrame: opts.loopFrame ?? 0,
    },
    [wr.buffer, wv.buffer, fo.buffer],
  )

  let playing = true
  const handle: AYDumpHandle = {
    get playing() { return playing },
    stop() {
      playing = false
      try { node.disconnect() } catch { /* already gone */ }
      try { gain.disconnect() } catch { /* already gone */ }
    },
    pause() { gain.gain.value = 0 },
    resume() { gain.gain.value = volume },
    setVolume(v: number) { volume = clamp01(v); gain.gain.value = volume },
    setStereo(mode: AYStereoMode) { node.port.postMessage({ type: 'stereo', mode }) },
  }
  node.port.onmessage = (e: MessageEvent) => {
    if ((e.data as { type?: string })?.type === 'ended') {
      playing = false
      handle.onEnded?.()
    }
  }
  return handle
}

// ─── Offline render + loader (§4.7) ──────────────────────────────────────────────

/** Options for {@link renderAYDump}. */
export interface RenderAYDumpOptions extends AYChipConfig {
  /** Output sample rate. Default `44100`. */
  sampleRate?: number
  /** Cap the render length in seconds. Default = the whole song. */
  maxSeconds?: number
}

/**
 * Renders a dump to stereo PCM **without an AudioContext** — deterministic, for
 * unit tests, `AudioWorklet`-less fallbacks, and offline tooling (e.g. PSG → WAV).
 * Beware RAM: a full 3-minute stereo render at 44.1 kHz is ≈ 64 MB — pass
 * `maxSeconds` to bound it.
 */
export function renderAYDump(
  dump: AYDump,
  opts: RenderAYDumpOptions = {},
): { left: Float32Array; right: Float32Array } {
  const sampleRate = opts.sampleRate ?? 44100
  const cfg = resolveConfig(opts)
  const chip = new AYChipCore(sampleRate, cfg.clockHz, cfg.envSteps, cfg.dac, cfg.stereo)
  const player = new AYDumpPlayer(
    chip, dump.writeRegs, dump.writeVals, dump.frameOffsets,
    dump.frameRateHz, sampleRate, false, 0,
  )

  const songSeconds = dump.frameCount / dump.frameRateHz + 0.1
  const seconds = opts.maxSeconds !== undefined ? Math.min(opts.maxSeconds, songSeconds) : songSeconds
  const total = Math.max(0, Math.ceil(seconds * sampleRate))
  const left = new Float32Array(total)
  const right = new Float32Array(total)

  const CHUNK = 4096
  for (let i = 0; i < total;) {
    const n = Math.min(CHUNK, total - i)
    const ended = player.render(left.subarray(i, i + n), right.subarray(i, i + n))
    i += n
    if (ended) break
  }
  return { left, right }
}

/**
 * Fetches a `.psg` file and parses it into an {@link AYDump}. Network / parse
 * errors propagate so the game decides how to handle them.
 *
 * @example
 * const dump = await loadPSG('./music/tune.psg')
 */
export async function loadPSG(url: string): Promise<AYDump> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`loadPSG: HTTP ${res.status} for ${url}`)
  return parsePSG(new Uint8Array(await res.arrayBuffer()))
}
