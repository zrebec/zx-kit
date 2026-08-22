/**
 * @module ay
 *
 * **AY-3-8912 chip emulator** — three independent square-wave channels, shared
 * LFSR noise generator, 16-shape hardware envelope generator. This is the chip
 * built into the ZX Spectrum 128K / +2 / +3 (and sold as the *Melodik* add-on
 * for the 48K) — the source of every 3-voice tune you remember from Robocop,
 * R-Type, Chase H.Q. and a thousand other 128K games.
 *
 * Use this module for **music** — title screens, in-game soundtracks,
 * multi-voice jingles, chord-based fanfares. For **sound effects** (single
 * blips, jumps, shots), pair this with the companion {@link "audio" | audio.ts}
 * module (the 1-bit beeper). That's the authentic 128K pattern: AY hums the
 * orchestral score, beeper still goes *pew pew*.
 *
 * Both modules share the same `AudioContext` and master `GainNode`:
 *
 * - `setMasterVolume()` (from audio.ts) controls AY and beeper together
 * - `initAudio()` initialises both — call once inside a user gesture
 * - Run AY music and beeper SFX in parallel without bus conflicts
 *
 * Accuracy notes: this is a *good approximation*, not a sample-accurate
 * AY emulator. Hardware-accurate logarithmic amplitudes (16 levels, ≈ √2
 * ratio) and all 16 envelope shapes are correct. Web Audio's `OscillatorNode`
 * is band-limited (no aliasing artefacts), so the sound is slightly cleaner
 * than the real chip's raw squares. Use `playAYDump()` from `aydump.ts` when a
 * PSG register dump needs the sample-accurate AudioWorklet chip core.
 *
 * @see {@link beep} and {@link playPattern} for single-voice SFX in `audio.ts`
 */

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

/** Demoscene-style stereo presets. mono = all centred; abc = A left / C right; acb = A left / B right. */
export type AYStereoMode = 'mono' | 'abc' | 'acb'

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
  /** Stereo position at this note's start: -1 left, 0 centre, +1 right. */
  pan?: number
  /** Linearly move the channel to this stereo position over the note's duration. */
  panTo?: number
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
  /** Pan a channel: -1 = full left, 0 = centre (default), +1 = full right. */
  pan(ch: AYChannel, value: number): void
  /** Apply a demoscene stereo preset (mono / abc / acb) to all three channels at once. */
  setStereoMode(mode: AYStereoMode): void
  /** Set a channel's independent volume immediately (level 0–15). Composes on top of note volume. */
  volume(ch: AYChannel, level: number): void
  /** Smoothly ramp a channel's independent volume to `toLevel` (0–15) over `durationMs`. */
  fade(ch: AYChannel, toLevel: number, durationMs: number): void
  /** Stop all oscillators / sources and release Web Audio nodes. */
  stop(): void
}

/** Handle to a single `playAY()` call — lets you stop those scheduled voices early. */
export interface AYHandle {
  /** Set a channel's post-note mix gain (0..1), optionally ramped over `rampMs`. */
  setChannelGain(ch: AYChannel, gain: number, rampMs?: number): void
  /** Override authored pan automation for a channel: -1 left, 0 centre, +1 right. */
  setChannelPan(ch: AYChannel, pan: number): void
  /** Apply a demoscene stereo preset to the scheduled channels. */
  setStereoMode(mode: AYStereoMode): void
  /**
   * Immediately stop every voice this `playAY()` call scheduled, with a short
   * anti-click fade (default 10 ms). Use it to mute or switch a looping track
   * without waiting for the current pattern to play out to its loop boundary.
   */
  stop(fadeMs?: number): void
}

/** Normalised post-note/post-chip gains for AY channels. Omitted channels default to full gain. */
export type AYChannelGains = Partial<Record<AYChannel, number>>

/**
 * Human-readable names for the 16 AY envelope shapes.
 * Index = R13 value. Display labels only — decode CONT/ATT/ALT/HOLD from the
 * numeric shape bits, not from these strings.
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

const AY_STEREO_PANS: Readonly<Record<AYStereoMode, Readonly<Record<AYChannel, number>>>> = {
  mono: { A: 0, B: 0, C: 0 },
  abc:  { A: -0.6, B: 0, C: 0.6 },
  acb:  { A: -0.6, B: 0.6, C: 0 },
}

function clampPan(value: number): number {
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0
}

function clampGain(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function holdAudioParam(param: AudioParam, time: number): void {
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(time)
  } else {
    const heldValue = param.value
    param.cancelScheduledValues(time)
    param.setValueAtTime(heldValue, time)
  }
}

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
    // Per-channel volume fader → per-channel stereo pan → master.
    const channelGain = actx.createGain()
    channelGain.gain.value = 1                 // independent volume (default = full)
    const panner = actx.createStereoPanner()   // independent pan (default = centre)
    channelGain.connect(panner)
    panner.connect(master)

    const osc      = actx.createOscillator()
    const toneGain = actx.createGain()
    osc.type = 'square'
    osc.frequency.value = 440
    toneGain.gain.value = 0
    osc.connect(toneGain)
    toneGain.connect(channelGain)
    osc.start()

    const noiseFilter = actx.createBiquadFilter()
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.value = noiseCutoffHz(8)
    const noiseGain = actx.createGain()
    noiseGain.gain.value = 0
    noiseFilter.connect(noiseGain)
    noiseGain.connect(channelGain)

    return { osc, toneGain, noiseFilter, noiseGain, channelGain, panner }
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

    pan(ch, value) {
      chs[ch].panner.pan.setValueAtTime(clampPan(value), actx.currentTime)
    },

    setStereoMode(mode) {
      const now = actx.currentTime
      chs.A.panner.pan.setValueAtTime(AY_STEREO_PANS[mode].A, now)
      chs.B.panner.pan.setValueAtTime(AY_STEREO_PANS[mode].B, now)
      chs.C.panner.pan.setValueAtTime(AY_STEREO_PANS[mode].C, now)
    },

    volume(ch, level) {
      const target = Math.max(0, Math.min(15, level)) / 15
      chs[ch].channelGain.gain.setTargetAtTime(target, actx.currentTime, 0.005)
    },

    fade(ch, toLevel, durationMs) {
      const g   = chs[ch].channelGain.gain
      const now = actx.currentTime
      const target = Math.max(0, Math.min(15, toLevel)) / 15
      g.cancelScheduledValues(now)
      g.setValueAtTime(g.value, now)
      g.linearRampToValueAtTime(target, now + durationMs / 1000)
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
      for (const { osc, toneGain, noiseFilter, noiseGain, channelGain, panner } of Object.values(chs)) {
        toneGain.gain.setValueAtTime(0, now)
        noiseGain.gain.setValueAtTime(0, now)
        osc.stop(now + 0.01)
        osc.disconnect()
        toneGain.disconnect()
        noiseFilter.disconnect()
        noiseGain.disconnect()
        channelGain.disconnect()
        panner.disconnect()
      }
    },
  }
}

// ─── Sequencer ────────────────────────────────────────────────────────────────

/**
 * Pre-schedules up to three independent AY note arrays on the shared
 * `AudioContext` — the canonical Spectrum 128K **music** primitive:
 * 3-voice harmony, envelope shaping, noise mixing, all in one call.
 *
 * All channels start at the same wall-clock time; shorter channels finish
 * earlier. Returns an {@link AYHandle} whose `stop()` silences these voices
 * immediately — e.g. to mute or switch a looping track mid-pattern.
 *
 * Each `AYNote` may optionally mix in LFSR noise, apply an envelope shape, set a
 * stereo position, or sweep that channel to `panTo` over the note duration.
 * The returned handle applies live gain and pan after note envelopes, so mixer
 * changes never rewrite the authored AY amplitude or envelope state.
 *
 * **When to reach for `playAY`:** title screen music, level themes,
 * game-over fanfares, multi-voice jingles. **For sound effects** (single
 * blips, jumps, hits), use `beep` from `audio.js` in parallel — the two
 * modules share the master gain and were designed to run together
 * (the authentic 128K pattern: AY music + beeper SFX).
 *
 * @example
 * const track = playAY({
 *   a: [{ freq: 440, dur: 300, pan: -1, panTo: 1 }, { freq: 523, dur: 300, envShape: 12, envCycleDurMs: 150 }],
 *   b: [{ freq: 110, dur: 200, noise: true, noisePeriod: 16 }],
 *   c: [{ freq: 0,   dur: 600, noise: true, noisePeriod: 4, envShape: 8, envCycleDurMs: 100 }],
 * })
 * track.setChannelGain('B', 0.5, 20)
 * track.setStereoMode('acb')
 */
export function playAY(
  pattern: { a?: AYNote[]; b?: AYNote[]; c?: AYNote[]; pan?: { a?: number; b?: number; c?: number } },
  startDelay = 0,
): AYHandle {
  initAudio()
  const master = getMasterGain()
  if (!master) {
    return {
      setChannelGain() {},
      setChannelPan() {},
      setStereoMode() {},
      stop() {},
    }
  }
  const actx   = master.context as AudioContext
  const noiseBuf = makeLFSRBuffer(actx)

  // Track every voice we schedule so the returned handle can silence them on demand.
  const voices: { src: AudioScheduledSourceNode; gain: GainNode }[] = []

  interface ChannelOutput {
    gain: GainNode
    panner: StereoPannerNode | null
    throughPanner: boolean
  }
  const outputs: Partial<Record<AYChannel, ChannelOutput>> = {}

  const scheduleChannel = (ch: AYChannel, notes: AYNote[] | undefined, panValue?: number): void => {
    if (!notes?.length) return
    let t = actx.currentTime + startDelay / 1000

    // One unity post-note gain is the controllable mixer strip. The panner stays
    // opt-in so an untouched centred pattern keeps the historical direct route.
    const channelGain = actx.createGain()
    channelGain.gain.value = 1
    const initialPan = clampPan(panValue ?? 0)
    const authoredPan = notes.some((note) => Number.isFinite(note.pan) || Number.isFinite(note.panTo))
    const needsPanner = authoredPan || initialPan !== 0
    let panner: StereoPannerNode | null = null
    if (needsPanner) {
      panner = actx.createStereoPanner()
      panner.pan.value = initialPan
      channelGain.connect(panner)
      panner.connect(master)
      outputs[ch] = { gain: channelGain, panner, throughPanner: true }
    } else {
      channelGain.connect(master)
      outputs[ch] = { gain: channelGain, panner: null, throughPanner: false }
    }

    let scheduledPan = initialPan

    for (const note of notes) {
      const { freq, dur, vol = 15, noise = false, noisePeriod = 8, envShape, envCycleDurMs, pan, panTo } = note
      const durS = dur / 1000

      if (panner) {
        const hasPan = typeof pan === 'number' && Number.isFinite(pan)
        const hasPanTo = typeof panTo === 'number' && Number.isFinite(panTo)
        if (hasPan) {
          scheduledPan = clampPan(pan)
          panner.pan.setValueAtTime(scheduledPan, t)
        }
        if (hasPanTo) {
          if (!hasPan) panner.pan.setValueAtTime(scheduledPan, t)
          scheduledPan = clampPan(panTo)
          panner.pan.linearRampToValueAtTime(scheduledPan, t + durS)
        }
      }

      if (freq > 0) {
        const osc      = actx.createOscillator()
        const toneGain = actx.createGain()
        osc.type = 'square'
        osc.frequency.value = freq
        osc.connect(toneGain)
        toneGain.connect(channelGain)

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
        voices.push({ src: osc, gain: toneGain })
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
        noiseGain.connect(channelGain)
        noiseSrc.start(t)
        noiseSrc.stop(t + durS + 0.01)
        voices.push({ src: noiseSrc, gain: noiseGain })
      }

      t += durS
    }
  }

  scheduleChannel('A', pattern.a, pattern.pan?.a)
  scheduleChannel('B', pattern.b, pattern.pan?.b)
  scheduleChannel('C', pattern.c, pattern.pan?.c)

  let stopped = false

  const setChannelPan = (ch: AYChannel, value: number, ensurePanner = false): void => {
    if (stopped || !Number.isFinite(value)) return
    const output = outputs[ch]
    if (!output) return
    const target = clampPan(value)
    const now = actx.currentTime

    if (!output.panner) {
      if (target === 0 && !ensurePanner) return
      output.panner = actx.createStereoPanner()
      output.panner.pan.value = 0
    }
    if (!output.throughPanner) {
      output.gain.disconnect()
      output.gain.connect(output.panner)
      output.panner.connect(master)
      output.throughPanner = true
    }
    holdAudioParam(output.panner.pan, now)
    output.panner.pan.setTargetAtTime(target, now, 0.005)
  }

  return {
    setChannelGain(ch, gain, rampMs = 5) {
      if (stopped || !Number.isFinite(gain) || !Number.isFinite(rampMs)) return
      const output = outputs[ch]
      if (!output) return
      const param = output.gain.gain
      const now = actx.currentTime
      const target = clampGain(gain)
      const ramp = Math.max(0, rampMs) / 1000
      holdAudioParam(param, now)
      if (ramp > 0) {
        param.linearRampToValueAtTime(target, now + ramp)
      } else {
        param.setValueAtTime(target, now)
      }
    },
    setChannelPan,
    setStereoMode(mode) {
      const preset = AY_STEREO_PANS[mode]
      const ensurePanners = mode !== 'mono' || Object.values(outputs).some((output) => output.panner !== null)
      setChannelPan('A', preset.A, ensurePanners)
      setChannelPan('B', preset.B, ensurePanners)
      setChannelPan('C', preset.C, ensurePanners)
    },
    stop(fadeMs = 10) {
      if (stopped) return
      stopped = true
      const now  = actx.currentTime
      const fade = Math.max(0.005, fadeMs / 1000)
      for (const { src, gain } of voices) {
        // Click-free fade to silence (same idiom as createAY().mute()), then free the node.
        gain.gain.cancelScheduledValues(now)
        gain.gain.setTargetAtTime(0, now, fade / 4)
        try {
          src.stop(now + fade + 0.02)
        } catch {
          // Voice already ended (or never started) — nothing to stop.
        }
      }
    },
  }
}
