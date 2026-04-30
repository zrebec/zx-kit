let ctx: AudioContext | null = null
let masterGain: GainNode | null = null

/**
 * Creates the shared `AudioContext` and master `GainNode`. Idempotent — safe to call
 * multiple times (subsequent calls are no-ops).
 * Must be called inside a user-gesture handler (click or keydown) due to browser autoplay policy.
 *
 * @param volume - Master gain value (0.0–1.0, default `0.3`)
 *
 * @example
 * window.addEventListener('keydown', () => initAudio(), { once: true })
 */
export function initAudio(volume = 0.3): void {
  if (ctx) return
  ctx = new AudioContext()
  masterGain = ctx.createGain()
  masterGain.gain.value = volume
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

/** A single note in a melody pattern. Use `freq: 0` for a rest (silence). */
export interface Note {
  freq: number  // Hz; 0 = rest (silence)
  dur: number   // ms; duration of note or rest
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
    if (note.freq > 0) beep(note.freq, note.dur, audio.currentTime + offset / 1000)
    offset += note.dur
  }
}

/**
 * Schedules a single square-wave beep on the shared `AudioContext`.
 * Uses a 5ms linear ramp attack and release to avoid click artefacts.
 * Routed through the master gain node.
 * Prefer `playPattern` for sequences — use `beep` when you need precise timing control.
 *
 * @param freq       - Frequency in Hz
 * @param durationMs - Duration in milliseconds
 * @param startTime  - Absolute `AudioContext.currentTime` to start at
 *
 * @example
 * const audio = getAudioContext()!
 * resumeAudio()
 * beep(440, 80, audio.currentTime)
 * beep(880, 80, audio.currentTime + 0.15)  // second note 150ms later
 */
export function beep(freq: number, durationMs: number, startTime: number): void {
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
  gain.connect(masterGain)
  osc.start(startTime)
  osc.stop(startTime + durationMs / 1000 + 0.01)
}
