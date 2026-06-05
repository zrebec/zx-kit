/**
 * @module music
 *
 * Write AY music by **note name** instead of raw frequencies, and **loop** it for
 * background tracks. A thin, friendly layer over {@link playAY} (the AY chip
 * already plays three channels of {@link AYNote}s — this just lets you author and
 * repeat them without doing the maths).
 *
 * @example
 * ```ts
 * import { seq, playAYLoop, noteToFreq } from 'zx-kit'
 *
 * const loop = playAYLoop({
 *   a: seq('A4 C5 E5 C5', { dur: 240 }),          // melody by name
 *   b: seq('A2:480 E2:480', { dur: 480 }),         // slow bass drone
 *   c: seq('r r r r', { dur: 240, noise: true }),  // a little texture
 * })
 * // later: loop.stop()
 * ```
 */
import { playAY, type AYNote } from './ay.js'
import { getAudioContext } from './audio.js'

const SEMITONE: Readonly<Record<string, number>> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }

/**
 * Note name → frequency (Hz), equal temperament, A4 = 440. Accepts `A5`, `C#4`,
 * `Db3`, `Fs5` (`s` = sharp); `r` / `-` is a rest → `0` (a silent {@link AYNote}).
 * Throws on a malformed name.
 */
export function noteToFreq(name: string): number {
  const n = name.trim().toLowerCase()
  if (n === 'r' || n === '-' || n === '') return 0
  const m = /^([a-g])([#sb]?)(-?\d)$/.exec(n)
  if (!m) throw new Error(`noteToFreq: bad note "${name}" (expected e.g. A5, C#4, Bb3, or r)`)
  let semis = SEMITONE[m[1]!]!
  if (m[2] === '#' || m[2] === 's') semis += 1
  else if (m[2] === 'b') semis -= 1
  const octave = parseInt(m[3]!, 10)
  const midi = (octave + 1) * 12 + semis // C4 = MIDI 60, A4 = 69
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** Options for {@link seq}. */
export interface SeqOptions {
  /** Default note duration in ms when a token doesn't specify one (default 200). */
  dur?: number
  /** Mix LFSR noise into every note (e.g. for a percussive/texture channel). */
  noise?: boolean
  /** Noise period when `noise` is set. */
  noisePeriod?: number
}

/**
 * Parses a compact note string into an {@link AYNote} array for one channel.
 * Tokens are whitespace-separated `Note` or `Note:durMs`; `r` (or `-`) is a rest.
 *
 * @example
 * seq('A4 C5:400 r:200 E5')  // A4 @default, C5 @400ms, rest @200ms, E5 @default
 */
export function seq(spec: string, opts: SeqOptions = {}): AYNote[] {
  const defDur = opts.dur ?? 200
  const out: AYNote[] = []
  for (const tok of spec.split(/\s+/).filter(Boolean)) {
    const [name, durStr] = tok.split(':')
    const note: AYNote = { freq: noteToFreq(name!), dur: durStr ? Number(durStr) : defDur }
    if (opts.noise) {
      note.noise = true
      if (opts.noisePeriod !== undefined) note.noisePeriod = opts.noisePeriod
    }
    out.push(note)
  }
  return out
}

/** A running looped track. Call {@link LoopHandle.stop} to end it. */
export interface LoopHandle {
  stop(): void
}

/**
 * Plays a 3-channel AY pattern on repeat — background music. Re-schedules each
 * loop after the pattern's length (the longest channel). No-ops (returns a stop
 * that does nothing) when there is no audio context yet or the pattern is empty.
 *
 * Call after the audio context is unlocked by a user gesture.
 */
export function playAYLoop(pattern: { a?: AYNote[]; b?: AYNote[]; c?: AYNote[] }): LoopHandle {
  if (!getAudioContext()) return { stop() {} }
  const total = (ns?: AYNote[]) => (ns ? ns.reduce((s, n) => s + n.dur, 0) : 0)
  const loopMs = Math.max(total(pattern.a), total(pattern.b), total(pattern.c))
  if (loopMs <= 0) return { stop() {} }

  let current = playAY(pattern)
  const id: ReturnType<typeof setInterval> = setInterval(() => {
    current = playAY(pattern)
  }, loopMs)
  return {
    stop() {
      clearInterval(id)
      current.stop() // silence the in-flight loop immediately, not at the next boundary
    },
  }
}
