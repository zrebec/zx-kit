import { describe, it, expect } from 'vitest'
import { noteToFreq, seq, playAYLoop } from '../src/music.js'

// ── noteToFreq ──────────────────────────────────────────────────────────────

describe('noteToFreq', () => {
  it('A4 is 440 Hz', () => {
    expect(noteToFreq('A4')).toBeCloseTo(440, 5)
  })

  it('octaves double / halve the frequency', () => {
    expect(noteToFreq('A5')).toBeCloseTo(880, 5)
    expect(noteToFreq('A3')).toBeCloseTo(220, 5)
  })

  it('C4 (middle C) ≈ 261.63 Hz', () => {
    expect(noteToFreq('C4')).toBeCloseTo(261.626, 2)
  })

  it('sharps and flats are enharmonic; `s` == `#`', () => {
    expect(noteToFreq('C#4')).toBeCloseTo(noteToFreq('Db4'), 6)
    expect(noteToFreq('Fs5')).toBeCloseTo(noteToFreq('F#5'), 6)
  })

  it('is case-insensitive', () => {
    expect(noteToFreq('a4')).toBeCloseTo(noteToFreq('A4'), 6)
  })

  it('rests (`r`, `-`) are 0 Hz', () => {
    expect(noteToFreq('r')).toBe(0)
    expect(noteToFreq('-')).toBe(0)
  })

  it('throws on a malformed note', () => {
    expect(() => noteToFreq('H4')).toThrow(/bad note/)
    expect(() => noteToFreq('A')).toThrow(/bad note/)
    expect(() => noteToFreq('xyz')).toThrow(/bad note/)
  })
})

// ── seq ─────────────────────────────────────────────────────────────────────

describe('seq', () => {
  it('parses names into AY notes with a default duration', () => {
    const out = seq('A4 C5 E5', { dur: 240 })
    expect(out).toHaveLength(3)
    expect(out[0]).toMatchObject({ freq: expect.closeTo(440, 1), dur: 240 })
    expect(out.every((n) => n.dur === 240)).toBe(true)
  })

  it('honours per-token durations (Note:dur) and rests', () => {
    const out = seq('A4:300 r:150 E5')
    expect(out[0]!.dur).toBe(300)
    expect(out[1]).toMatchObject({ freq: 0, dur: 150 }) // rest
    expect(out[2]!.dur).toBe(200) // default
  })

  it('applies noise to every note when asked', () => {
    const out = seq('r r', { noise: true, noisePeriod: 8 })
    expect(out.every((n) => n.noise === true && n.noisePeriod === 8)).toBe(true)
  })

  it('ignores extra whitespace', () => {
    expect(seq('  A4   C5  ')).toHaveLength(2)
  })
})

// ── playAYLoop ──────────────────────────────────────────────────────────────

describe('playAYLoop', () => {
  it('no-ops without an audio context (headless) and returns a safe stop', () => {
    const loop = playAYLoop({ a: seq('A4 C5') })
    expect(typeof loop.stop).toBe('function')
    expect(() => loop.stop()).not.toThrow()
  })

  it('no-ops on an empty pattern', () => {
    expect(() => playAYLoop({}).stop()).not.toThrow()
  })
})
