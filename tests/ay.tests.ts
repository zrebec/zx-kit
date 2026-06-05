import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { AY_CLOCK, AY_VOL, AY_ENVELOPE_SHAPES, createAY, playAY } from '../src/ay.js'

// ── Web Audio mock ──────────────────────────────────────────────────────────────

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
    return {
      type: 'sine' as OscillatorType,
      frequency: makeParam(),
      connect:    vi.fn(),
      disconnect: vi.fn(),
      start:      vi.fn(),
      stop:       vi.fn(),
    }
  }

  createGain() {
    return {
      gain:       makeParam(),
      connect:    vi.fn(),
      disconnect: vi.fn(),
      context:    this,          // createAY: master.context as AudioContext
    }
  }

  createBiquadFilter() {
    return {
      type: 'lowpass' as BiquadFilterType,
      frequency: makeParam(),
      connect:    vi.fn(),
      disconnect: vi.fn(),
    }
  }

  createBuffer(_ch: number, len: number) {
    return { getChannelData: vi.fn(() => new Float32Array(len)) }
  }

  createBufferSource() {
    return {
      buffer:     null as unknown,
      loop:       false,
      connect:    vi.fn(),
      disconnect: vi.fn(),
      start:      vi.fn(),
      stop:       vi.fn(),
    }
  }
}

beforeAll(() => { vi.stubGlobal('AudioContext', MockAudioContext) })
afterAll(()  => { vi.unstubAllGlobals() })

// ── AY_CLOCK ───────────────────────────────────────────────────────────────────

describe('AY_CLOCK', () => {
  it('equals 1 773 400 Hz (ZX Spectrum 128K master clock)', () => {
    expect(AY_CLOCK).toBe(1_773_400)
  })
})

// ── AY_VOL ────────────────────────────────────────────────────────────────────

describe('AY_VOL', () => {
  it('has 16 entries', () => {
    expect(AY_VOL).toHaveLength(16)
  })

  it('index 0 is 0 (silence)', () => {
    expect(AY_VOL[0]).toBe(0)
  })

  it('index 15 is 1.0 (full amplitude)', () => {
    expect(AY_VOL[15]).toBe(1.0)
  })

  it('is monotonically non-decreasing', () => {
    for (let i = 1; i < 16; i++) {
      expect(AY_VOL[i]).toBeGreaterThanOrEqual(AY_VOL[i - 1])
    }
  })

  it('all values are in range [0, 1]', () => {
    for (const v of AY_VOL) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})

// ── AY_ENVELOPE_SHAPES ────────────────────────────────────────────────────────

describe('AY_ENVELOPE_SHAPES', () => {
  it('has 16 entries', () => {
    expect(AY_ENVELOPE_SHAPES).toHaveLength(16)
  })

  it('all entries are non-empty strings', () => {
    for (const s of AY_ENVELOPE_SHAPES) {
      expect(typeof s).toBe('string')
      expect(s.length).toBeGreaterThan(0)
    }
  })
})

// ── createAY — shape ──────────────────────────────────────────────────────────

describe('createAY — returns AYChip with all methods', () => {
  it('exposes tone, enableNoise, disableNoise, envelope, mute, muteAll, stop', () => {
    const ay = createAY()
    expect(typeof ay.tone).toBe('function')
    expect(typeof ay.enableNoise).toBe('function')
    expect(typeof ay.disableNoise).toBe('function')
    expect(typeof ay.envelope).toBe('function')
    expect(typeof ay.mute).toBe('function')
    expect(typeof ay.muteAll).toBe('function')
    expect(typeof ay.stop).toBe('function')
  })
})

// ── createAY — tone() ─────────────────────────────────────────────────────────

describe('createAY — tone()', () => {
  it('freq > 0, default vol — does not throw', () => {
    expect(() => createAY().tone('A', 440)).not.toThrow()
  })

  it('freq > 0, explicit vol — does not throw', () => {
    expect(() => createAY().tone('B', 523, 12)).not.toThrow()
  })

  it('freq = 0 (silence) — does not throw', () => {
    expect(() => createAY().tone('C', 0)).not.toThrow()
  })

  it('freq < 0 (also silences) — does not throw', () => {
    expect(() => createAY().tone('A', -1)).not.toThrow()
  })

  it('all three channels — no throw', () => {
    const ay = createAY()
    expect(() => { ay.tone('A', 262); ay.tone('B', 330); ay.tone('C', 392) }).not.toThrow()
  })
})

// ── createAY — enableNoise() ──────────────────────────────────────────────────

describe('createAY — enableNoise()', () => {
  it('default period — does not throw', () => {
    expect(() => createAY().enableNoise('A')).not.toThrow()
  })

  it('explicit period — does not throw', () => {
    expect(() => createAY().enableNoise('B', 16)).not.toThrow()
  })

  it('period at boundaries (1 and 31) — no throw', () => {
    const ay = createAY()
    expect(() => { ay.enableNoise('A', 1); ay.enableNoise('B', 31) }).not.toThrow()
  })

  it('all three channels — no throw', () => {
    const ay = createAY()
    expect(() => { ay.enableNoise('A'); ay.enableNoise('B'); ay.enableNoise('C') }).not.toThrow()
  })
})

// ── createAY — disableNoise() ─────────────────────────────────────────────────

describe('createAY — disableNoise()', () => {
  it('all three channels — no throw', () => {
    const ay = createAY()
    expect(() => { ay.disableNoise('A'); ay.disableNoise('B'); ay.disableNoise('C') }).not.toThrow()
  })
})

// ── createAY — envelope() ─────────────────────────────────────────────────────

describe('createAY — envelope()', () => {
  // Shapes 0–3: CONT=0, one-shot decay
  it('shape 0 (one-shot decay) — does not throw', () => {
    expect(() => createAY().envelope('A', 0, 400)).not.toThrow()
  })

  // Shapes 4–7: CONT=0, one-shot attack
  it('shape 4 (one-shot attack) — does not throw', () => {
    expect(() => createAY().envelope('B', 4, 200)).not.toThrow()
  })

  // Shape 8: CONT=1, ATT=0, ALT=0, HOLD=0 — repeat sawtooth down
  it('shape 8 (repeat sawtooth down) — does not throw', () => {
    expect(() => createAY().envelope('A', 8, 100)).not.toThrow()
  })

  // Shape 9: CONT=1, ATT=0, ALT=0, HOLD=1 — decay, hold low
  it('shape 9 (decay, hold low) — does not throw', () => {
    expect(() => createAY().envelope('B', 9, 200)).not.toThrow()
  })

  // Shape 10: CONT=1, ATT=0, ALT=1, HOLD=0 — triangle down/up
  it('shape 10 (triangle) — does not throw', () => {
    expect(() => createAY().envelope('C', 10, 150)).not.toThrow()
  })

  // Shape 11: CONT=1, ATT=0, ALT=1, HOLD=1 — decay, hold high
  it('shape 11 (decay, hold high) — does not throw', () => {
    expect(() => createAY().envelope('A', 11, 300)).not.toThrow()
  })

  // Shape 12: CONT=1, ATT=1, ALT=0, HOLD=0 — repeat sawtooth up
  it('shape 12 (repeat sawtooth up) — does not throw', () => {
    expect(() => createAY().envelope('B', 12, 50)).not.toThrow()
  })

  // Shape 13: CONT=1, ATT=1, ALT=0, HOLD=1 — attack, hold high
  it('shape 13 (attack, hold high) — does not throw', () => {
    expect(() => createAY().envelope('C', 13, 200)).not.toThrow()
  })

  // Shape 14: CONT=1, ATT=1, ALT=1, HOLD=0 — triangle up/down
  it('shape 14 (triangle up/down) — does not throw', () => {
    expect(() => createAY().envelope('A', 14, 100)).not.toThrow()
  })

  // Shape 15: CONT=1, ATT=1, ALT=1, HOLD=1 — attack, hold low
  it('shape 15 (attack, hold low) — does not throw', () => {
    expect(() => createAY().envelope('B', 15, 150)).not.toThrow()
  })
})

// ── createAY — mute() ─────────────────────────────────────────────────────────

describe('createAY — mute()', () => {
  it('all three channels — no throw', () => {
    const ay = createAY()
    expect(() => { ay.mute('A'); ay.mute('B'); ay.mute('C') }).not.toThrow()
  })
})

// ── createAY — muteAll() ──────────────────────────────────────────────────────

describe('createAY — muteAll()', () => {
  it('does not throw', () => {
    expect(() => createAY().muteAll()).not.toThrow()
  })
})

// ── createAY — stop() ─────────────────────────────────────────────────────────

describe('createAY — stop()', () => {
  it('does not throw', () => {
    expect(() => createAY().stop()).not.toThrow()
  })
})

// ── playAY — smoke tests ───────────────────────────────────────────────────────

describe('playAY — smoke tests', () => {
  it('empty pattern {} — does not throw', () => {
    expect(() => playAY({})).not.toThrow()
  })

  it('rest (freq=0, no noise) — does not throw', () => {
    expect(() => playAY({ a: [{ freq: 0, dur: 100 }] })).not.toThrow()
  })

  it('tone-only single note — does not throw', () => {
    expect(() => playAY({ a: [{ freq: 440, dur: 300 }] })).not.toThrow()
  })

  it('noise-only — does not throw', () => {
    expect(() => playAY({ a: [{ freq: 0, dur: 200, noise: true }] })).not.toThrow()
  })

  it('tone + noise — does not throw', () => {
    expect(() => playAY({ a: [{ freq: 440, dur: 300, noise: true, noisePeriod: 16 }] })).not.toThrow()
  })

  it('tone with envelope, no envCycleDurMs (defaults to dur) — does not throw', () => {
    expect(() => playAY({ a: [{ freq: 440, dur: 300, envShape: 12 }] })).not.toThrow()
  })

  it('tone with envelope + envCycleDurMs — does not throw', () => {
    expect(() => playAY({ a: [{ freq: 440, dur: 300, envShape: 12, envCycleDurMs: 100 }] })).not.toThrow()
  })

  it('noise with envelope — does not throw', () => {
    expect(() => playAY({ c: [{ freq: 0, dur: 300, noise: true, envShape: 8, envCycleDurMs: 50 }] })).not.toThrow()
  })

  it('vol = 0 — does not throw', () => {
    expect(() => playAY({ a: [{ freq: 440, dur: 100, vol: 0 }] })).not.toThrow()
  })

  it('vol = 15 (max) — does not throw', () => {
    expect(() => playAY({ a: [{ freq: 440, dur: 100, vol: 15 }] })).not.toThrow()
  })

  it('multiple sequential notes on channel a — does not throw', () => {
    expect(() => playAY({
      a: [
        { freq: 262, dur: 100 },
        { freq: 330, dur: 100 },
        { freq: 392, dur: 100 },
        { freq: 523, dur: 200 },
      ],
    })).not.toThrow()
  })

  it('multi-channel pattern — does not throw', () => {
    expect(() => playAY({
      a: [{ freq: 440, dur: 200 }, { freq: 523, dur: 200 }],
      b: [{ freq: 110, dur: 300, noise: true }],
      c: [{ freq: 0,   dur: 400, noise: true, envShape: 10, envCycleDurMs: 100 }],
    })).not.toThrow()
  })

  it('startDelay > 0 — does not throw', () => {
    expect(() => playAY({ a: [{ freq: 440, dur: 100 }] }, 200)).not.toThrow()
  })

  it('only b and c channels, a omitted — does not throw', () => {
    expect(() => playAY({
      b: [{ freq: 330, dur: 150 }],
      c: [{ freq: 165, dur: 150, noise: true }],
    })).not.toThrow()
  })
})

// ── playAY — handle / stop() ────────────────────────────────────────────────────

describe('playAY — returns an AYHandle', () => {
  it('returns an object with a stop() function', () => {
    const h = playAY({ a: [{ freq: 440, dur: 200 }] })
    expect(typeof h.stop).toBe('function')
  })

  it('stop() on a tone + noise multi-channel pattern — does not throw', () => {
    const h = playAY({
      a: [{ freq: 440, dur: 200 }, { freq: 523, dur: 200 }],
      b: [{ freq: 110, dur: 300, noise: true }],
      c: [{ freq: 0,   dur: 400, noise: true, envShape: 10, envCycleDurMs: 100 }],
    })
    expect(() => h.stop()).not.toThrow()
  })

  it('stop() on a noise-with-envelope voice — does not throw', () => {
    const h = playAY({ c: [{ freq: 0, dur: 300, noise: true, envShape: 8, envCycleDurMs: 50 }] })
    expect(() => h.stop()).not.toThrow()
  })

  it('stop(fadeMs) honours a custom fade — does not throw', () => {
    const h = playAY({ a: [{ freq: 440, dur: 200 }] })
    expect(() => h.stop(40)).not.toThrow()
  })

  it('stop() is safe to call more than once', () => {
    const h = playAY({ a: [{ freq: 440, dur: 200 }] })
    h.stop()
    expect(() => h.stop()).not.toThrow()
  })

  it('empty pattern still returns a handle whose stop() does not throw', () => {
    expect(() => playAY({}).stop()).not.toThrow()
  })
})
