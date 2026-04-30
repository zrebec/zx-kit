let ctx: AudioContext | null = null
let masterGain: GainNode | null = null

export function initAudio(volume = 0.3): void {
  if (ctx) return
  ctx = new AudioContext()
  masterGain = ctx.createGain()
  masterGain.gain.value = volume
  masterGain.connect(ctx.destination)
}

export function resumeAudio(): void {
  if (ctx && ctx.state === 'suspended') void ctx.resume()
}

export function getAudioContext(): AudioContext | null {
  return ctx
}

export function getMasterGain(): GainNode | null {
  return masterGain
}

/** A single note in a melody pattern. freq=0 is a rest (silence). */
export interface Note {
  freq: number  // Hz; 0 = rest (silence)
  dur: number   // ms; duration of note or rest
}

/**
 * Schedule a sequence of notes using the shared AudioContext.
 * Silently exits if audio has not been initialised yet.
 *
 * @example
 * // Intro jingle — three notes with rests
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

// Core primitive — schedule a square-wave beep on the shared AudioContext
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
