import { initAudio, getMasterGain } from './audio.js'

// ─── Hardware constants ────────────────────────────────────────────────────────

/** ZX Spectrum 128K / Melodik AY-3-8912 master clock. */
export const AY_CLOCK = 1_773_400

/**
 * Hardware-accurate logarithmic amplitude table.
 * The real chip uses ≈ √2 steps per level (≈ 3 dB).
 * Index 0 = silence, index 15 = full amplitude.
 */
export const AY_VOL: readonly number[] = [
  0,      0.0089, 0.0118, 0.0156, 0.0211, 0.0289, 0.0403, 0.0549,
  0.0744, 0.1060, 0.1518, 0.2139, 0.2969, 0.4259, 0.6098, 1.0,
]

// Headroom so three simultaneous channels don't clip the master bus.
const CH_GAIN = 0.28

function ayVol(level: number): number {
  return AY_VOL[Math.max(0, Math.min(15, level))] * CH_GAIN
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type AYChannel = 'A' | 'B' | 'C'

/** One note in an AY sequencer pattern. */
export interface AYNote {
  /** Frequency in Hz. 0 = rest (silence). */
  freq: number
  /** Duration in milliseconds. */
  dur: number
  /** Amplitude 0–15.  Default 15.  Ignored when envShape is set. */
  vol?: number
  /** Mix LFSR noise alongside the tone. Default false. */
  noise?: boolean
  /** Noise period 1–31 (maps to R6). Higher = darker texture. Default 8. */
  noisePeriod?: number
  /** Envelope shape 0–15 (R13). When set, vol is ignored. */
  envShape?: number
  /** Envelope cycle duration in ms (one ramp: 0→15 or 15→0). Default = note duration. */
  envCycleDurMs?: number
}

/** Real-time AY chip handle returned by `createAY()`. */
export interface AYChip {
  /** Set channel tone + volume (vol 0–15). freq ≤ 0 silences the tone generator. */
  tone(ch: AYChannel, freq: number, vol?: number): void
  /** Enable LFSR noise on a channel.  period 1–31 (R6): higher = darker texture. */
  enableNoise(ch: AYChannel, period?: number): void
  /** Disable noise on a channel. */
  disableNoise(ch: AYChannel): void
  /**
   * Apply an AY envelope to a channel's amplitude.
   * shape 0–15 maps to the 16 AY-3-8912 envelope shapes (see `AY_ENVELOPE_SHAPES`).
   * cycleDurMs: time in ms for one ramp (15→0 or 0→15).
   * Repeating shapes are pre-scheduled for 32 cycles — call again to extend.
   */
  envelope(ch: AYChannel, shape: number, cycleDurMs: number): void
  /** Fade out a channel (tone + noise). */
  mute(ch: AYChannel): void
  /** Fade out all three channels. */
  muteAll(): void
  /** Stop all oscillators / sources and release Web Audio nodes. */
  stop(): void
}

/**
 * Human-readable names for the 16 AY envelope shapes.
 * Index = R13 value.  Useful for documentation and tooling.
 */
export const AY_ENVELOPE_SHAPES = [
  '\\_ ', '\\_ ', '\\_ ', '\\_ ',  // 0-3  decay, hold low
  '/_ ', '/_ ', '/_ ', '/_ ',       // 4-7  attack, hold low
  '\\\\',                            // 8    repeat decay (sawtooth down)
  '\\_',                             // 9    decay, hold low
  '\\/\\/',                          // 10   alternate down/up (triangle)
  '\\‾',                             // 11   decay, hold high
  '//',                              // 12   repeat attack (sawtooth up)
  '/‾',                              // 13   attack, hold high
  '/\\/\\',                          // 14   alternate up/down (triangle)
  '/_',                              // 15   attack, hold low
] as const

// ─── LFSR noise buffer ─────────────────────────────────────────────────────────

// 17-bit LFSR: feedback = bit0 XOR bit2  (matches AY-3-8910 datasheet)
function makeLFSRBuffer(actx: AudioContext): AudioBuffer {
  const len  = Math.ceil(actx.sampleRate * 1.5)  // 1.5 s loop
  const buf  = actx.createBuffer(1, len, actx.sampleRate)
  const data = buf.getChannelData(0)
  let lfsr = 0x1FFFF
  for (let i = 0; i < len; i++) {
    const bit = (lfsr ^ (lfsr >> 2)) & 1
    lfsr = (lfsr >> 1) | (bit << 16)
    data[i] = (lfsr & 1) ? 1.0 : -1.0
  }
  return buf
}

/** Convert AY noise period register (R6, 1–31) to Hz cutoff for the LFSR filter. */
function noiseCutoffHz(period: number): number {
  return AY_CLOCK / (16 * Math.max(1, Math.min(31, period)))
}

// ─── Envelope scheduling ──────────────────────────────────────────────────────

/**
 * Schedules AY envelope automation on an `AudioParam`.
 *
 * R13 bit layout:  bit3=CONT  bit2=ATT  bit1=ALT  bit0=HOLD
 *
 * cycleDur: seconds for one ramp (15→0 or 0→15).
 * numCycles: how many cycles to pre-schedule for repeating shapes.
 */
function scheduleEnvelope(
  param: AudioParam,
  shape: number,
  cycleDur: number,
  startTime: number,
  numCycles = 32,
): void {
  const CONT = (shape >> 3) & 1
  const ATT  = (shape >> 2) & 1
  const ALT  = (shape >> 1) & 1
  const HOLD =  shape       & 1

  const lo = 0
  const hi = ayVol(15)

  // Cancel any automation already scheduled from startTime onward.
  param.cancelScheduledValues(startTime)

  const ramp = (from: number, to: number, t: number) => {
    param.setValueAtTime(from, t)
    param.linearRampToValueAtTime(to, t + cycleDur)
  }

  if (!CONT) {
    // Shapes 0-7: one-shot, hold at 0 after
    ramp(ATT ? lo : hi, ATT ? hi : lo, startTime)
    param.setValueAtTime(lo, startTime + cycleDur)
    return
  }

  if (HOLD) {
    // Single cycle, then hold at final level
    if (!ATT) {
      ramp(hi, lo, startTime)
      // Shape 11 (\‾): hold HIGH after decay; Shape 9 (\_): hold LOW
      param.setValueAtTime(ALT ? hi : lo, startTime + cycleDur)
    } else {
      ramp(lo, hi, startTime)
      // Shape 15 (/_): hold LOW after attack; Shape 13 (/‾): hold HIGH
      param.setValueAtTime(ALT ? lo : hi, startTime + cycleDur)
    }
    return
  }

  // Repeating shapes 8, 10, 12, 14 — pre-schedule numCycles ramps
  for (let i = 0; i < numCycles; i++) {
    const t = startTime + i * cycleDur
    // ATT=base direction; ALT=flip each odd cycle
    const goUp = ALT ? (ATT ? i % 2 === 0 : i % 2 === 1) : ATT === 1
    ramp(goUp ? lo : hi, goUp ? hi : lo, t)
  }
}

// ─── Real-time chip ───────────────────────────────────────────────────────────

/**
 * Creates three persistent AY channels wired to the zx-kit master gain.
 * Each channel has independent tone (square wave), noise (LFSR), and envelope.
 *
 * Must be called inside a user-gesture handler due to browser autoplay policy.
 *
 * @example
 * button.addEventListener('click', () => {
 *   const ay = createAY()
 *   ay.tone('A', 440, 12)
 *   ay.enableNoise('B', 16)
 *   ay.envelope('C', 10, 400)  // shape 10 = \/\/ triangle
 *   ay.tone('C', 220, 0)       // tone silent; only envelope-modulated noise
 * })
 */
export function createAY(): AYChip {
  initAudio()
  const master = getMasterGain()!
  const actx   = master.context as AudioContext

  const noiseBuf = makeLFSRBuffer(actx)

  const makeChannel = () => {
    const osc      = actx.createOscillator()
    const toneGain = actx.createGain()
    osc.type = 'square'
    osc.frequency.value = 440
    toneGain.gain.value = 0
    osc.connect(toneGain)
    toneGain.connect(master)
    osc.start()

    const noiseFilter = actx.createBiquadFilter()
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.value = noiseCutoffHz(8)
    const noiseGain = actx.createGain()
    noiseGain.gain.value = 0
    noiseFilter.connect(noiseGain)
    noiseGain.connect(master)

    return { osc, toneGain, noiseFilter, noiseGain }
  }

  type Ch = ReturnType<typeof makeChannel>
  const chs: Record<AYChannel, Ch> = {
    A: makeChannel(), B: makeChannel(), C: makeChannel(),
  }

  // One shared LFSR source feeds all three channel noise filters.
  const noiseSrc = actx.createBufferSource()
  noiseSrc.buffer = noiseBuf
  noiseSrc.loop   = true
  noiseSrc.connect(chs.A.noiseFilter)
  noiseSrc.connect(chs.B.noiseFilter)
  noiseSrc.connect(chs.C.noiseFilter)
  noiseSrc.start()

  return {
    tone(ch, freq, vol = 15) {
      const { osc, toneGain } = chs[ch]
      const now = actx.currentTime
      toneGain.gain.cancelScheduledValues(now)
      if (freq <= 0) {
        toneGain.gain.setTargetAtTime(0, now, 0.003)
      } else {
        osc.frequency.setValueAtTime(freq, now)
        toneGain.gain.setTargetAtTime(ayVol(vol), now, 0.003)
      }
    },

    enableNoise(ch, period = 8) {
      const { noiseFilter, noiseGain } = chs[ch]
      const now = actx.currentTime
      noiseFilter.frequency.setValueAtTime(noiseCutoffHz(period), now)
      noiseGain.gain.setTargetAtTime(ayVol(15), now, 0.003)
    },

    disableNoise(ch) {
      chs[ch].noiseGain.gain.setTargetAtTime(0, actx.currentTime, 0.003)
    },

    envelope(ch, shape, cycleDurMs) {
      scheduleEnvelope(
        chs[ch].toneGain.gain,
        shape,
        cycleDurMs / 1000,
        actx.currentTime,
      )
    },

    mute(ch) {
      const { toneGain, noiseGain } = chs[ch]
      const now = actx.currentTime
      toneGain.gain.cancelScheduledValues(now)
      noiseGain.gain.cancelScheduledValues(now)
      toneGain.gain.setTargetAtTime(0, now, 0.005)
      noiseGain.gain.setTargetAtTime(0, now, 0.005)
    },

    muteAll() {
      const now = actx.currentTime
      for (const { toneGain, noiseGain } of Object.values(chs)) {
        toneGain.gain.cancelScheduledValues(now)
        noiseGain.gain.cancelScheduledValues(now)
        toneGain.gain.setTargetAtTime(0, now, 0.005)
        noiseGain.gain.setTargetAtTime(0, now, 0.005)
      }
    },

    stop() {
      const now = actx.currentTime
      noiseSrc.stop(now + 0.01)
      noiseSrc.disconnect()
      for (const { osc, toneGain, noiseFilter, noiseGain } of Object.values(chs)) {
        toneGain.gain.setValueAtTime(0, now)
        noiseGain.gain.setValueAtTime(0, now)
        osc.stop(now + 0.01)
        osc.disconnect()
        toneGain.disconnect()
        noiseFilter.disconnect()
        noiseGain.disconnect()
      }
    },
  }
}

// ─── Sequencer ────────────────────────────────────────────────────────────────

/**
 * Pre-schedules up to three independent AY note arrays on the shared AudioContext.
 * All channels start at the same wall-clock time; shorter channels finish earlier.
 * Fire-and-forget — no handle returned.
 *
 * Each `AYNote` may optionally mix in LFSR noise and/or apply an envelope shape.
 *
 * @example
 * playAY({
 *   a: [{ freq: 440, dur: 300 }, { freq: 523, dur: 300, envShape: 12, envCycleDurMs: 150 }],
 *   b: [{ freq: 110, dur: 200, noise: true, noisePeriod: 16 }],
 *   c: [{ freq: 0,   dur: 600, noise: true, noisePeriod: 4, envShape: 8, envCycleDurMs: 100 }],
 * })
 */
export function playAY(
  pattern: { a?: AYNote[]; b?: AYNote[]; c?: AYNote[] },
  startDelay = 0,
): void {
  initAudio()
  const master = getMasterGain()
  if (!master) return
  const actx   = master.context as AudioContext
  const noiseBuf = makeLFSRBuffer(actx)

  const scheduleChannel = (notes: AYNote[] | undefined): void => {
    if (!notes?.length) return
    let t = actx.currentTime + startDelay / 1000

    for (const note of notes) {
      const { freq, dur, vol = 15, noise = false, noisePeriod = 8, envShape, envCycleDurMs } = note
      const durS = dur / 1000

      if (freq > 0) {
        const osc      = actx.createOscillator()
        const toneGain = actx.createGain()
        osc.type = 'square'
        osc.frequency.value = freq
        osc.connect(toneGain)
        toneGain.connect(master)

        if (envShape !== undefined) {
          const cycleDur = (envCycleDurMs ?? dur) / 1000
          const numCycles = Math.ceil(durS / cycleDur) + 4
          scheduleEnvelope(toneGain.gain, envShape, cycleDur, t, numCycles)
          toneGain.gain.setValueAtTime(0, t + durS)
        } else {
          const att = 0.005
          const rel = Math.min(0.015, durS * 0.12)
          toneGain.gain.setValueAtTime(0, t)
          toneGain.gain.linearRampToValueAtTime(ayVol(vol), t + att)
          toneGain.gain.setValueAtTime(ayVol(vol), t + durS - rel)
          toneGain.gain.linearRampToValueAtTime(0, t + durS)
        }

        osc.start(t)
        osc.stop(t + durS + 0.01)
      }

      if (noise) {
        const noiseSrc    = actx.createBufferSource()
        const noiseFilter = actx.createBiquadFilter()
        const noiseGain   = actx.createGain()
        noiseSrc.buffer        = noiseBuf
        noiseSrc.loop          = true
        noiseFilter.type       = 'lowpass'
        noiseFilter.frequency.value = noiseCutoffHz(noisePeriod)

        if (envShape !== undefined) {
          const cycleDur = (envCycleDurMs ?? dur) / 1000
          const numCycles = Math.ceil(durS / cycleDur) + 4
          scheduleEnvelope(noiseGain.gain, envShape, cycleDur, t, numCycles)
          noiseGain.gain.setValueAtTime(0, t + durS)
        } else {
          const att = 0.005
          const rel = Math.min(0.015, durS * 0.12)
          const nv  = ayVol(vol) * 0.6
          noiseGain.gain.setValueAtTime(0, t)
          noiseGain.gain.linearRampToValueAtTime(nv, t + att)
          noiseGain.gain.setValueAtTime(nv, t + durS - rel)
          noiseGain.gain.linearRampToValueAtTime(0, t + durS)
        }

        noiseSrc.connect(noiseFilter)
        noiseFilter.connect(noiseGain)
        noiseGain.connect(master)
        noiseSrc.start(t)
        noiseSrc.stop(t + durS + 0.01)
      }

      t += durS
    }
  }

  scheduleChannel(pattern.a)
  scheduleChannel(pattern.b)
  scheduleChannel(pattern.c)
}
