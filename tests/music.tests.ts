import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { noteToFreq, seq, playAYLoop } from '../src/music.js'
import { initAudio } from '../src/audio.js'

// ── Web Audio mock (mirrors tests/ay.tests.ts) ────────────────────────────────

function makeParam() {
  return {
    value: 0,
    cancelScheduledValues: vi.fn(),
    setTargetAtTime:       vi.fn(),
    setValueAtTime:        vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  }
}

class MockAudioContext {
  readonly sampleRate = 44100
  readonly currentTime = 0
  readonly destination = {}
  readonly state = 'running'
  createOscillator() {
    return { type: 'sine' as OscillatorType, frequency: makeParam(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }
  }
  createGain() {
    return { gain: makeParam(), connect: vi.fn(), disconnect: vi.fn(), context: this }
  }
  createBiquadFilter() {
    return { type: 'lowpass' as BiquadFilterType, frequency: makeParam(), connect: vi.fn(), disconnect: vi.fn() }
  }
  createBuffer(_ch: number, len: number) {
    return { getChannelData: vi.fn(() => new Float32Array(len)) }
  }
  createBufferSource() {
    return { buffer: null as unknown, loop: false, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }
  }
  createStereoPanner() {
    return { pan: makeParam(), connect: vi.fn(), disconnect: vi.fn() }
  }
}

/**
 * Captures the gain nodes playAY() builds, so a test can read the level a channel
 * was *born* with — the thing that decides whether a muted channel leaks at the seam.
 */
function captureLoopGains() {
  const gains: { gain: ReturnType<typeof makeParam>; connect: ReturnType<typeof vi.fn> }[] = []
  const spy = vi.spyOn(MockAudioContext.prototype, 'createGain').mockImplementation(function (
    this: MockAudioContext,
  ) {
    const node = { gain: makeParam(), connect: vi.fn(), disconnect: vi.fn(), context: this }
    gains.push(node)
    return node as unknown as GainNode
  })
  return { gains, restore: () => spy.mockRestore() }
}

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

// ── playAYLoop — with an audio context (immediate stop) ───────────────────────

describe('playAYLoop — with an audio context', () => {
  beforeAll(() => {
    vi.stubGlobal('AudioContext', MockAudioContext)
    initAudio() // populate the shared context so playAYLoop schedules instead of no-op
  })
  afterAll(() => { vi.unstubAllGlobals() })

  it('returns a handle whose stop() silences the in-flight loop without throwing', () => {
    vi.useFakeTimers()
    const loop = playAYLoop({ a: seq('A4 C5', { dur: 120 }), b: seq('A2:240') })
    expect(typeof loop.stop).toBe('function')
    expect(() => loop.stop()).not.toThrow() // clears the interval AND stops the current voices
    vi.useRealTimers()
  })

  it('reschedules on the interval until stopped', () => {
    vi.useFakeTimers()
    const loop = playAYLoop({ a: seq('A4', { dur: 100 }) })
    expect(() => vi.advanceTimersByTime(350)).not.toThrow() // fires the reschedule a few times
    loop.stop()
    expect(() => vi.advanceTimersByTime(350)).not.toThrow() // no more reschedules after stop
    vi.useRealTimers()
  })
})

// ── playAYLoop — mixer persists across the loop seam ──────────────────────────

describe('playAYLoop — mixer', () => {
  beforeAll(() => {
    vi.stubGlobal('AudioContext', MockAudioContext)
    initAudio()
  })
  afterAll(() => { vi.unstubAllGlobals() })

  it('exposes the full mixer surface', () => {
    vi.useFakeTimers()
    const loop = playAYLoop({ a: seq('A4', { dur: 100 }) })
    expect(typeof loop.setChannelGain).toBe('function')
    expect(typeof loop.setChannelPan).toBe('function')
    expect(typeof loop.setStereoMode).toBe('function')
    loop.stop()
    vi.useRealTimers()
  })

  it('no-op handles expose the mixer too, so callers need no null checks', () => {
    const empty = playAYLoop({})
    expect(() => {
      empty.setChannelGain('A', 0)
      empty.setChannelPan('A', -1)
      empty.setStereoMode('abc')
      empty.stop()
    }).not.toThrow()
  })

  it('a muted channel is born silent in every later iteration', () => {
    vi.useFakeTimers()
    const { gains, restore } = captureLoopGains()
    try {
      const loop = playAYLoop({ a: seq('A4', { dur: 100 }), b: seq('A2', { dur: 100 }) })
      loop.setChannelGain('B', 0)

      const before = gains.length
      vi.advanceTimersByTime(100) // cross one loop boundary
      const fresh = gains.slice(before)

      // Per channel playAY builds the strip first, then the note's tone gain:
      // [A strip, A tone, B strip, B tone].
      expect(fresh).toHaveLength(4)
      const aStrip = fresh[0]!
      const bStrip = fresh[2]!
      expect(aStrip.gain.value).toBe(1)
      expect(bStrip.gain.value).toBe(0)
      // Born at zero rather than ramped down to it — that is what stops the seam blip.
      expect(bStrip.gain.linearRampToValueAtTime).not.toHaveBeenCalled()

      loop.stop()
    } finally {
      restore()
      vi.useRealTimers()
    }
  })

  it('keeps the stereo preset across the seam', () => {
    vi.useFakeTimers()
    const panners: { pan: ReturnType<typeof makeParam> }[] = []
    const spy = vi.spyOn(MockAudioContext.prototype, 'createStereoPanner').mockImplementation(() => {
      const node = { pan: makeParam(), connect: vi.fn(), disconnect: vi.fn() }
      panners.push(node)
      return node as unknown as StereoPannerNode
    })
    try {
      const loop = playAYLoop({ a: seq('A4', { dur: 100 }), c: seq('E5', { dur: 100 }) })
      loop.setStereoMode('abc')
      const before = panners.length

      vi.advanceTimersByTime(100)
      const fresh = panners.slice(before)
      // Born already placed: A hard-ish left, C hard-ish right.
      expect(fresh.map(({ pan }) => pan.value).sort()).toEqual([-0.6, 0.6])

      loop.stop()
    } finally {
      spy.mockRestore()
      vi.useRealTimers()
    }
  })

  it('a stereo preset clears earlier per-channel pan overrides', () => {
    vi.useFakeTimers()
    const panners: { pan: ReturnType<typeof makeParam> }[] = []
    const spy = vi.spyOn(MockAudioContext.prototype, 'createStereoPanner').mockImplementation(() => {
      const node = { pan: makeParam(), connect: vi.fn(), disconnect: vi.fn() }
      panners.push(node)
      return node as unknown as StereoPannerNode
    })
    try {
      const loop = playAYLoop({ a: seq('A4', { dur: 100 }) })
      loop.setChannelPan('A', 1)
      loop.setStereoMode('abc')
      const before = panners.length

      vi.advanceTimersByTime(100)
      // `abc` puts A at -0.6; the stale +1 override must not win.
      expect(panners.slice(before).map(({ pan }) => pan.value)).toEqual([-0.6])

      loop.stop()
    } finally {
      spy.mockRestore()
      vi.useRealTimers()
    }
  })

  it('ignores non-finite mixer values instead of storing them', () => {
    vi.useFakeTimers()
    const { gains, restore } = captureLoopGains()
    try {
      const loop = playAYLoop({ a: seq('A4', { dur: 100 }) })
      loop.setChannelGain('A', Number.NaN)
      loop.setChannelGain('A', 0.5, Number.POSITIVE_INFINITY)
      loop.setChannelPan('A', Number.NaN)

      const before = gains.length
      vi.advanceTimersByTime(100)
      // Nothing was stored, so the fresh strip is still at full level.
      expect(gains.slice(before).map(({ gain }) => gain.value)).toContain(1)

      loop.stop()
    } finally {
      restore()
      vi.useRealTimers()
    }
  })

  it('re-asserts a live pan over authored panTo automation on each iteration', () => {
    vi.useFakeTimers()
    const panners: { pan: ReturnType<typeof makeParam> }[] = []
    const spy = vi.spyOn(MockAudioContext.prototype, 'createStereoPanner').mockImplementation(() => {
      const node = { pan: makeParam(), connect: vi.fn(), disconnect: vi.fn() }
      panners.push(node)
      return node as unknown as StereoPannerNode
    })
    try {
      const swept = seq('A4', { dur: 100 }).map((note) => ({ ...note, pan: -1, panTo: 1 }))
      const loop = playAYLoop({ a: swept })
      loop.setChannelPan('A', 0.5)
      const before = panners.length

      vi.advanceTimersByTime(100)
      const fresh = panners.slice(before)
      expect(fresh).toHaveLength(1)
      // The authored sweep was scheduled, then the live override took authority back.
      expect(fresh[0].pan.setTargetAtTime).toHaveBeenCalledWith(0.5, 0, 0.005)

      loop.stop()
    } finally {
      spy.mockRestore()
      vi.useRealTimers()
    }
  })
})
