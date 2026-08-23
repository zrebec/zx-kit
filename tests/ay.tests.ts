import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { AY_CLOCK, AY_VOL, AY_ENVELOPE_SHAPES, createAY, playAY } from '../src/ay.js'

// ── Web Audio mock ──────────────────────────────────────────────────────────────

function makeParam() {
  return {
    value: 0,
    cancelScheduledValues: vi.fn(),
    cancelAndHoldAtTime:   vi.fn(),
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

  createStereoPanner() {
    return {
      pan:        makeParam(),
      connect:    vi.fn(),
      disconnect: vi.fn(),
    }
  }
}

type MockParam = ReturnType<typeof makeParam>
type CapturedGain = {
  gain: MockParam
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  context: MockAudioContext
}
type CapturedPanner = {
  pan: MockParam
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}
type CapturedSource = {
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  onended?: () => void
}

function capturePlayAYNodes() {
  // The audio module owns a singleton context/master. Initialise it before the
  // spies so each captured gain belongs to playAY(), never to the master bus.
  createAY().stop()

  const gains: CapturedGain[] = []
  const panners: CapturedPanner[] = []
  // Sources carry the `onended` hook the node lifetime depends on, so tests can end
  // a voice on demand instead of waiting on a real audio clock.
  const sources: CapturedSource[] = []
  const oscSpy = vi.spyOn(MockAudioContext.prototype, 'createOscillator').mockImplementation(() => {
    const node = {
      type: 'sine' as OscillatorType,
      frequency: makeParam(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: undefined as (() => void) | undefined,
    }
    sources.push(node)
    return node as unknown as OscillatorNode
  })
  const bufferSpy = vi.spyOn(MockAudioContext.prototype, 'createBufferSource').mockImplementation(() => {
    const node = {
      buffer: null as unknown,
      loop: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: undefined as (() => void) | undefined,
    }
    sources.push(node)
    return node as unknown as AudioBufferSourceNode
  })
  const gainSpy = vi.spyOn(MockAudioContext.prototype, 'createGain').mockImplementation(function (
    this: MockAudioContext,
  ) {
    const node: CapturedGain = {
      gain: makeParam(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      context: this,
    }
    gains.push(node)
    return node as unknown as GainNode
  })
  const pannerSpy = vi.spyOn(MockAudioContext.prototype, 'createStereoPanner').mockImplementation(() => {
    const node: CapturedPanner = {
      pan: makeParam(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    }
    panners.push(node)
    return node as unknown as StereoPannerNode
  })

  return {
    gains,
    panners,
    sources,
    /** Ends every scheduled source, the way the audio clock eventually would. */
    endAllSources() {
      for (const source of sources) source.onended?.()
    },
    restore() {
      bufferSpy.mockRestore()
      oscSpy.mockRestore()
      pannerSpy.mockRestore()
      gainSpy.mockRestore()
    },
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

  it('exposes pan, setStereoMode, volume, fade', () => {
    const ay = createAY()
    expect(typeof ay.pan).toBe('function')
    expect(typeof ay.setStereoMode).toBe('function')
    expect(typeof ay.volume).toBe('function')
    expect(typeof ay.fade).toBe('function')
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

// ── createAY — pan() / setStereoMode() ────────────────────────────────────────

describe('createAY — pan() / setStereoMode()', () => {
  it('pan() on each channel — does not throw', () => {
    const ay = createAY()
    expect(() => { ay.pan('A', -1); ay.pan('B', 0); ay.pan('C', 1) }).not.toThrow()
  })

  it('pan() clamps out-of-range values to [-1, 1]', () => {
    const panners: { pan: ReturnType<typeof makeParam> }[] = []
    const spy = vi.spyOn(MockAudioContext.prototype, 'createStereoPanner').mockImplementation(() => {
      const node = { pan: makeParam(), connect: vi.fn(), disconnect: vi.fn() }
      panners.push(node)
      return node as unknown as StereoPannerNode
    })
    try {
      const ay = createAY()        // panners created in order A, B, C
      ay.pan('A', -5)
      ay.pan('C', 9)
      expect(panners[0].pan.setValueAtTime).toHaveBeenCalledWith(-1, expect.any(Number))
      expect(panners[2].pan.setValueAtTime).toHaveBeenCalledWith(1, expect.any(Number))
      ay.stop()
    } finally {
      spy.mockRestore()
    }
  })

  it('setStereoMode("abc") puts A left, B centre, C right', () => {
    const panners: { pan: ReturnType<typeof makeParam> }[] = []
    const spy = vi.spyOn(MockAudioContext.prototype, 'createStereoPanner').mockImplementation(() => {
      const node = { pan: makeParam(), connect: vi.fn(), disconnect: vi.fn() }
      panners.push(node)
      return node as unknown as StereoPannerNode
    })
    try {
      const ay = createAY()
      ay.setStereoMode('abc')
      expect(panners[0].pan.setValueAtTime).toHaveBeenCalledWith(-0.6, expect.any(Number))
      expect(panners[1].pan.setValueAtTime).toHaveBeenCalledWith(0, expect.any(Number))
      expect(panners[2].pan.setValueAtTime).toHaveBeenCalledWith(0.6, expect.any(Number))
      ay.stop()
    } finally {
      spy.mockRestore()
    }
  })

  it('setStereoMode — mono / abc / acb all run without throwing', () => {
    const ay = createAY()
    expect(() => { ay.setStereoMode('mono'); ay.setStereoMode('abc'); ay.setStereoMode('acb') }).not.toThrow()
  })
})

// ── createAY — volume() / fade() ──────────────────────────────────────────────

describe('createAY — volume() / fade()', () => {
  it('volume() on each channel — does not throw', () => {
    const ay = createAY()
    expect(() => { ay.volume('A', 0); ay.volume('B', 8); ay.volume('C', 15) }).not.toThrow()
  })

  it('fade() ramps the channel gain to toLevel/15 over the duration', () => {
    createAY().stop()              // ensure AudioContext + master already exist
    const gains: { gain: ReturnType<typeof makeParam> }[] = []
    const spy = vi.spyOn(MockAudioContext.prototype, 'createGain').mockImplementation(function (this: MockAudioContext) {
      const node = { gain: makeParam(), connect: vi.fn(), disconnect: vi.fn(), context: this }
      gains.push(node)
      return node as unknown as GainNode
    })
    try {
      const ay = createAY()        // makeChannel creates channelGain first → gains[0] = channel A
      ay.fade('A', 8, 2000)
      expect(gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(8 / 15, 2)
      ay.stop()
    } finally {
      spy.mockRestore()
    }
  })

  it('fade() clamps toLevel to [0, 15]', () => {
    const ay = createAY()
    expect(() => { ay.fade('A', -3, 500); ay.fade('B', 99, 500) }).not.toThrow()
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

// ── playAY — per-note pan automation ────────────────────────────────────────────

describe('playAY — AYNote pan / panTo', () => {
  it('schedules clamped pan positions and linear sweeps on the channel timeline', () => {
    const { panners, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({
        a: [
          { freq: 0, dur: 200, pan: -2, panTo: 0.5 },
          { freq: 0, dur: 300, panTo: 2 },
          { freq: 0, dur: 100, pan: -0.25 },
        ],
      }, 100)

      expect(panners).toHaveLength(1)
      expect(panners[0].pan.value).toBe(0)

      const setCalls = panners[0].pan.setValueAtTime.mock.calls
      expect(setCalls.map(([value]) => value)).toEqual([-1, 0.5, -0.25])
      expect(setCalls[0][1]).toBeCloseTo(0.1)
      expect(setCalls[1][1]).toBeCloseTo(0.3)
      expect(setCalls[2][1]).toBeCloseTo(0.6)

      const rampCalls = panners[0].pan.linearRampToValueAtTime.mock.calls
      expect(rampCalls.map(([value]) => value)).toEqual([0.5, 1])
      expect(rampCalls[0][1]).toBeCloseTo(0.3)
      expect(rampCalls[1][1]).toBeCloseTo(0.6)
      handle.stop()
    } finally {
      restore()
    }
  })

  it('inherits the previous pan when panTo is authored without pan', () => {
    const { panners, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({
        pan: { a: -0.4 },
        a: [
          { freq: 0, dur: 150, panTo: 0.75 },
          { freq: 0, dur: 150, panTo: -0.5 },
        ],
      })

      expect(panners).toHaveLength(1)
      expect(panners[0].pan.value).toBe(-0.4)
      expect(panners[0].pan.setValueAtTime.mock.calls.map(([value]) => value)).toEqual([-0.4, 0.75])
      expect(panners[0].pan.linearRampToValueAtTime.mock.calls.map(([value]) => value)).toEqual([0.75, -0.5])
      handle.stop()
    } finally {
      restore()
    }
  })

  it('treats non-finite authored pan values as centred and schedules no invalid automation', () => {
    const { panners, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({
        pan: { a: Number.NaN },
        a: [{ freq: 0, dur: 100, pan: Number.NaN, panTo: Number.POSITIVE_INFINITY }],
      })

      expect(panners).toHaveLength(0)
      handle.stop()
    } finally {
      restore()
    }
  })
})

// ── playAY — live channel controls ──────────────────────────────────────────────

describe('playAY — live channel controls', () => {
  it('keeps untouched centred channels on the historical direct route', () => {
    const { gains, panners, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({
        a: [{ freq: 0, dur: 100 }],
        b: [{ freq: 0, dur: 100 }],
        c: [{ freq: 0, dur: 100 }],
      })

      expect(gains).toHaveLength(3)
      expect(gains.map(({ gain }) => gain.value)).toEqual([1, 1, 1])
      expect(gains.every(({ connect }) => connect.mock.calls.length === 1)).toBe(true)
      expect(panners).toHaveLength(0)
      handle.stop()
    } finally {
      restore()
    }
  })

  it('uses a 5 ms default gain ramp and honours custom and immediate ramps', () => {
    const { gains, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({
        a: [{ freq: 0, dur: 100 }],
        b: [{ freq: 0, dur: 100 }],
      })

      handle.setChannelGain('A', 0.25)
      expect(gains[0].gain.cancelAndHoldAtTime).toHaveBeenCalledWith(0)
      expect(gains[0].gain.setValueAtTime).not.toHaveBeenCalled()
      expect(gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.25, 0.005)

      handle.setChannelGain('B', 0.4, 200)
      expect(gains[1].gain.cancelAndHoldAtTime).toHaveBeenCalledWith(0)
      expect(gains[1].gain.setValueAtTime).not.toHaveBeenCalled()
      expect(gains[1].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.4, 0.2)

      handle.setChannelGain('A', 2, 0)
      handle.setChannelGain('A', -2, 0)
      expect(gains[0].gain.setValueAtTime).toHaveBeenNthCalledWith(1, 1, 0)
      expect(gains[0].gain.setValueAtTime).toHaveBeenNthCalledWith(2, 0, 0)
      expect(gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledTimes(1)
      handle.stop()
    } finally {
      restore()
    }
  })

  it('ignores non-finite gains, non-finite ramps, and absent channels', () => {
    const { gains, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({ a: [{ freq: 0, dur: 100 }] })
      handle.setChannelGain('A', Number.NaN)
      handle.setChannelGain('A', 0.5, Number.POSITIVE_INFINITY)
      handle.setChannelGain('B', 0.5)

      expect(gains[0].gain.cancelAndHoldAtTime).not.toHaveBeenCalled()
      expect(gains[0].gain.cancelScheduledValues).not.toHaveBeenCalled()
      expect(gains[0].gain.setValueAtTime).not.toHaveBeenCalled()
      expect(gains[0].gain.linearRampToValueAtTime).not.toHaveBeenCalled()
      handle.stop()
    } finally {
      restore()
    }
  })

  it('holds the pre-cancel channel gain in browsers without cancelAndHoldAtTime', () => {
    const { gains, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({ a: [{ freq: 0, dur: 100 }] })
      const param = gains[0].gain
      param.value = 0.35
      ;(param as { cancelAndHoldAtTime?: ReturnType<typeof vi.fn> }).cancelAndHoldAtTime = undefined
      param.cancelScheduledValues.mockImplementation(() => { param.value = 1 })

      handle.setChannelGain('A', 0.2)

      expect(param.cancelScheduledValues).toHaveBeenCalledWith(0)
      expect(param.setValueAtTime).toHaveBeenCalledWith(0.35, 0)
      handle.stop()
    } finally {
      restore()
    }
  })

  it('lazily inserts and reuses a panner, including when returning to centre', () => {
    const { gains, panners, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({ a: [{ freq: 0, dur: 100 }] })
      const output = gains[0]
      expect(panners).toHaveLength(0)

      handle.setChannelPan('A', -2)
      expect(panners).toHaveLength(1)
      expect(panners[0].pan.value).toBe(0)
      expect(output.disconnect).toHaveBeenCalledTimes(1)
      expect(output.connect).toHaveBeenNthCalledWith(2, panners[0])
      expect(panners[0].connect).toHaveBeenCalledTimes(1)
      expect(panners[0].pan.cancelAndHoldAtTime).toHaveBeenCalledWith(0)
      expect(panners[0].pan.setTargetAtTime).toHaveBeenCalledWith(-1, 0, 0.005)

      handle.setChannelPan('A', 0.25)
      expect(panners).toHaveLength(1)
      expect(panners[0].pan.setTargetAtTime).toHaveBeenCalledWith(0.25, 0, 0.005)

      handle.setChannelPan('A', 0)
      expect(output.disconnect).toHaveBeenCalledTimes(1)
      expect(output.connect).toHaveBeenCalledTimes(2)
      expect(output.connect.mock.calls.at(-1)?.[0]).toBe(panners[0])
      expect(panners[0].disconnect).not.toHaveBeenCalled()
      expect(panners[0].pan.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.005)

      const disconnectCount = output.disconnect.mock.calls.length
      const panCancelCount = panners[0].pan.cancelAndHoldAtTime.mock.calls.length
      handle.setChannelPan('A', Number.NaN)
      handle.setChannelPan('B', 0.5)
      expect(output.disconnect).toHaveBeenCalledTimes(disconnectCount)
      expect(panners[0].pan.cancelAndHoldAtTime).toHaveBeenCalledTimes(panCancelCount)
      handle.stop()
    } finally {
      restore()
    }
  })

  it('applies abc, mono, and acb presets to the scheduled channels', () => {
    const { gains, panners, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({
        a: [{ freq: 0, dur: 100 }],
        b: [{ freq: 0, dur: 100 }],
        c: [{ freq: 0, dur: 100 }],
      })

      handle.setStereoMode('abc')
      expect(panners).toHaveLength(3)
      expect(gains[0].connect.mock.calls.at(-1)?.[0]).toBe(panners[0])
      expect(gains[1].connect.mock.calls.at(-1)?.[0]).toBe(panners[1])
      expect(gains[2].connect.mock.calls.at(-1)?.[0]).toBe(panners[2])
      expect(panners[0].pan.setTargetAtTime).toHaveBeenLastCalledWith(-0.6, 0, 0.005)
      expect(panners[1].pan.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.005)
      expect(panners[2].pan.setTargetAtTime).toHaveBeenLastCalledWith(0.6, 0, 0.005)

      handle.setStereoMode('mono')
      expect(panners).toHaveLength(3)
      expect(panners.every(({ disconnect }) => disconnect.mock.calls.length === 0)).toBe(true)
      expect(panners.every(({ pan }) => pan.setTargetAtTime.mock.calls.at(-1)?.[0] === 0)).toBe(true)

      handle.setStereoMode('acb')
      expect(panners).toHaveLength(3)
      expect(gains[0].connect.mock.calls.at(-1)?.[0]).toBe(panners[0])
      expect(gains[1].connect.mock.calls.at(-1)?.[0]).toBe(panners[1])
      expect(gains[2].connect.mock.calls.at(-1)?.[0]).toBe(panners[2])
      expect(panners[0].pan.setTargetAtTime).toHaveBeenLastCalledWith(-0.6, 0, 0.005)
      expect(panners[1].pan.setTargetAtTime).toHaveBeenLastCalledWith(0.6, 0, 0.005)
      expect(panners[2].pan.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.005)
      handle.stop()
    } finally {
      restore()
    }
  })

  it('keeps an initial mono preset on untouched direct routes', () => {
    const { gains, panners, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({
        a: [{ freq: 0, dur: 100 }],
        b: [{ freq: 0, dur: 100 }],
        c: [{ freq: 0, dur: 100 }],
      })

      handle.setStereoMode('mono')
      expect(panners).toHaveLength(0)
      expect(gains.every(({ connect }) => connect.mock.calls.length === 1)).toBe(true)
      handle.stop()
    } finally {
      restore()
    }
  })

  it('routes active tone and noise envelopes through the channel output gain', () => {
    const { gains, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({ a: [{ freq: 440, dur: 100, noise: true }] })

      expect(gains).toHaveLength(3) // channel output, tone envelope, noise envelope
      expect(gains[1].connect).toHaveBeenCalledWith(gains[0])
      expect(gains[2].connect).toHaveBeenCalledWith(gains[0])
      handle.stop()
    } finally {
      restore()
    }
  })
})

// ── playAY — handle / stop() ────────────────────────────────────────────────────

describe('playAY — returns an AYHandle', () => {
  it('returns an object with live mixer controls and stop()', () => {
    const handle = playAY({ a: [{ freq: 440, dur: 200 }] })
    expect(typeof handle.setChannelGain).toBe('function')
    expect(typeof handle.setChannelPan).toBe('function')
    expect(typeof handle.setStereoMode).toBe('function')
    expect(typeof handle.stop).toBe('function')
  })

  it('stop() on a tone + noise multi-channel pattern — does not throw', () => {
    const handle = playAY({
      a: [{ freq: 440, dur: 200 }, { freq: 523, dur: 200 }],
      b: [{ freq: 110, dur: 300, noise: true }],
      c: [{ freq: 0, dur: 400, noise: true, envShape: 10, envCycleDurMs: 100 }],
    })
    expect(() => handle.stop()).not.toThrow()
  })

  it('stop() on a noise-with-envelope voice — does not throw', () => {
    const handle = playAY({ c: [{ freq: 0, dur: 300, noise: true, envShape: 8, envCycleDurMs: 50 }] })
    expect(() => handle.stop()).not.toThrow()
  })

  it('stop(fadeMs) honours a custom fade — does not throw', () => {
    const handle = playAY({ a: [{ freq: 440, dur: 200 }] })
    expect(() => handle.stop(40)).not.toThrow()
  })

  it('stop() is safe to call more than once', () => {
    const handle = playAY({ a: [{ freq: 440, dur: 200 }] })
    handle.stop()
    expect(() => handle.stop()).not.toThrow()
  })

  it('empty patterns expose safe no-op controls', () => {
    const handle = playAY({})
    expect(() => {
      handle.setChannelGain('A', 0.5)
      handle.setChannelPan('B', -0.5)
      handle.setStereoMode('abc')
      handle.stop()
      handle.stop()
    }).not.toThrow()
  })

  it('all controls become no-ops after stop()', () => {
    const { gains, panners, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({ a: [{ freq: 0, dur: 100, pan: -0.5 }] })
      handle.stop()
      const gainCalls = gains[0].gain.cancelAndHoldAtTime.mock.calls.length
      const panCalls = panners[0].pan.cancelAndHoldAtTime.mock.calls.length
      const connectCalls = gains[0].connect.mock.calls.length

      handle.setChannelGain('A', 0.25)
      handle.setChannelPan('A', 0.75)
      handle.setStereoMode('mono')
      handle.stop()

      expect(gains[0].gain.cancelAndHoldAtTime).toHaveBeenCalledTimes(gainCalls)
      expect(panners[0].pan.cancelAndHoldAtTime).toHaveBeenCalledTimes(panCalls)
      expect(gains[0].connect).toHaveBeenCalledTimes(connectCalls)
    } finally {
      restore()
    }
  })
})

// ── playAY — initial mix (gains / stereo) ─────────────────────────────────────

describe('playAY — initial mix', () => {
  it('gives every channel unity gain when no mix is authored', () => {
    const { gains, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({ a: [{ freq: 0, dur: 100 }], b: [{ freq: 0, dur: 100 }] })
      expect(gains).toHaveLength(2)
      expect(gains[0].gain.value).toBe(1)
      expect(gains[1].gain.value).toBe(1)
      handle.stop()
    } finally {
      restore()
    }
  })

  it('starts a channel at its authored gain instead of correcting it afterwards', () => {
    const { gains, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({
        a: [{ freq: 0, dur: 100 }],
        b: [{ freq: 0, dur: 100 }],
        c: [{ freq: 0, dur: 100 }],
        gains: { B: 0, C: 0.25 },
      })
      expect(gains[0].gain.value).toBe(1)
      expect(gains[1].gain.value).toBe(0)
      expect(gains[2].gain.value).toBe(0.25)
      // Born at the target — no ramp had to run to get there.
      expect(gains[1].gain.linearRampToValueAtTime).not.toHaveBeenCalled()
      handle.stop()
    } finally {
      restore()
    }
  })

  it('clamps authored gains and treats non-finite ones as full level', () => {
    const { gains, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({
        a: [{ freq: 0, dur: 100 }],
        b: [{ freq: 0, dur: 100 }],
        c: [{ freq: 0, dur: 100 }],
        gains: { A: 4, B: -2, C: Number.NaN },
      })
      expect(gains[0].gain.value).toBe(1)
      expect(gains[1].gain.value).toBe(0)
      expect(gains[2].gain.value).toBe(1)
      handle.stop()
    } finally {
      restore()
    }
  })

  it('places channels from a stereo preset without any live call', () => {
    const { panners, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({
        a: [{ freq: 0, dur: 100 }],
        b: [{ freq: 0, dur: 100 }],
        c: [{ freq: 0, dur: 100 }],
        stereo: 'abc',
      })
      // B sits centred under `abc`, so it keeps the historical direct route.
      expect(panners).toHaveLength(2)
      expect(panners[0].pan.value).toBe(-0.6)
      expect(panners[1].pan.value).toBe(0.6)
      expect(panners[0].pan.setTargetAtTime).not.toHaveBeenCalled()
      handle.stop()
    } finally {
      restore()
    }
  })

  it('lets an explicit pan entry override the preset for that channel only', () => {
    const { panners, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({
        a: [{ freq: 0, dur: 100 }],
        c: [{ freq: 0, dur: 100 }],
        stereo: 'abc',
        pan: { a: 0.25 },
      })
      expect(panners).toHaveLength(2)
      expect(panners[0].pan.value).toBe(0.25)
      expect(panners[1].pan.value).toBe(0.6)
      handle.stop()
    } finally {
      restore()
    }
  })

  it('ignores an unknown preset and leaves the channels centred', () => {
    const { panners, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({
        a: [{ freq: 0, dur: 100 }],
        stereo: 'quadraphonic' as unknown as 'abc',
      })
      expect(panners).toHaveLength(0)
      handle.stop()
    } finally {
      restore()
    }
  })
})

// ── playAY — node lifetime ────────────────────────────────────────────────────

describe('playAY — node lifetime', () => {
  it('releases the channel strips once the last source ends naturally', () => {
    const { gains, sources, endAllSources, restore } = capturePlayAYNodes()
    try {
      playAY({ a: [{ freq: 440, dur: 100 }], b: [{ freq: 220, dur: 100, noise: true }] })
      // Two channel strips plus a tone gain for A and tone + noise gains for B.
      const strips = gains.filter((gain) => gain.gain.value === 1 && gain.connect.mock.calls.length > 0)
      expect(sources.length).toBe(3)
      expect(strips.some(({ disconnect }) => disconnect.mock.calls.length > 0)).toBe(false)

      endAllSources()
      // Every node playAY built for this call is now detached exactly once.
      const detached = gains.filter(({ disconnect }) => disconnect.mock.calls.length === 1)
      expect(detached.length).toBe(2)
    } finally {
      restore()
    }
  })

  it('keeps the strips connected until the last of several sources has ended', () => {
    const { gains, sources, restore } = capturePlayAYNodes()
    try {
      playAY({ a: [{ freq: 440, dur: 100 }, { freq: 550, dur: 100 }] })
      expect(sources).toHaveLength(2)

      sources[0].onended?.()
      expect(gains.every(({ disconnect }) => disconnect.mock.calls.length === 0)).toBe(true)

      sources[1].onended?.()
      expect(gains.some(({ disconnect }) => disconnect.mock.calls.length === 1)).toBe(true)
    } finally {
      restore()
    }
  })

  it('stop() leaves the strips alive so the anti-click fade can still run', () => {
    const { gains, sources, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({ a: [{ freq: 440, dur: 100 }] })
      handle.stop()
      // The fade was scheduled on the voice; detaching now would cut it short.
      expect(gains.every(({ disconnect }) => disconnect.mock.calls.length === 0)).toBe(true)
      expect(sources[0].stop).toHaveBeenCalled()

      sources[0].onended?.()
      expect(gains.some(({ disconnect }) => disconnect.mock.calls.length === 1)).toBe(true)
    } finally {
      restore()
    }
  })

  it('stop() detaches a rest-only pattern immediately — there is nothing to fade', () => {
    const { gains, sources, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({ a: [{ freq: 0, dur: 100 }] })
      expect(sources).toHaveLength(0)
      expect(gains[0].disconnect).not.toHaveBeenCalled()

      handle.stop()
      expect(gains[0].disconnect).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })

  it('detaches a panned channel’s panner as well, and only once', () => {
    const { gains, panners, sources, restore } = capturePlayAYNodes()
    try {
      playAY({ a: [{ freq: 440, dur: 100 }], pan: { a: -1 } })
      expect(panners).toHaveLength(1)

      sources[0].onended?.()
      expect(panners[0].disconnect).toHaveBeenCalledTimes(1)

      // A duplicate end event must not detach anything a second time.
      sources[0].onended?.()
      expect(panners[0].disconnect).toHaveBeenCalledTimes(1)
      expect(gains.every(({ disconnect }) => disconnect.mock.calls.length <= 1)).toBe(true)
    } finally {
      restore()
    }
  })

  it('mixer calls after release are safe no-ops', () => {
    const { gains, panners, sources, restore } = capturePlayAYNodes()
    try {
      const handle = playAY({ a: [{ freq: 440, dur: 100 }] })
      sources[0].onended?.()
      const disconnects = gains.map(({ disconnect }) => disconnect.mock.calls.length)

      handle.setChannelGain('A', 0)
      handle.setChannelPan('A', -1)
      handle.setStereoMode('abc')

      expect(panners).toHaveLength(0)
      expect(gains.map(({ disconnect }) => disconnect.mock.calls.length)).toEqual(disconnects)
    } finally {
      restore()
    }
  })
})
