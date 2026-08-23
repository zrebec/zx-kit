import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import {
  initAudio, getAudioContext, getMasterGain, getMasterVolume,
  setMasterVolume, increaseVolume, decreaseVolume,
  resumeAudio, beep, playPattern, stopBeep, BEEP_VOLUME,
  setVolumeBarStyle, drawVolumeBar,
} from '../src/audio.js'
import { resetUI } from '../src/ui.js'
import { C } from '../src/palette.js'

// ── Web Audio mock ─────────────────────────────────────────────────────────────

function makeParam() {
  return {
    value: 0,
    setValueAtTime:          vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues:   vi.fn(),
    cancelAndHoldAtTime:     vi.fn(),
  }
}

class MockAudioContext {
  readonly destination = {}
  readonly currentTime = 0
  state = 'running'
  resume = vi.fn()

  createGain() {
    return { gain: makeParam(), connect: vi.fn(), disconnect: vi.fn(), context: this }
  }

  createOscillator() {
    return {
      type: 'sine' as OscillatorType,
      frequency: makeParam(),
      connect: vi.fn(),
      start:   vi.fn(),
      stop:    vi.fn(),
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

// ── Before initAudio() ────────────────────────────────────────────────────────

describe('audio — before initAudio()', () => {
  it('getAudioContext returns null', () => {
    expect(getAudioContext()).toBeNull()
  })

  it('getMasterGain returns null', () => {
    expect(getMasterGain()).toBeNull()
  })

  it('getMasterVolume returns 0', () => {
    expect(getMasterVolume()).toBe(0)
  })

  it('setMasterVolume is a no-op — does not throw', () => {
    expect(() => setMasterVolume(0.5)).not.toThrow()
  })

  it('increaseVolume is a no-op — does not throw', () => {
    expect(() => increaseVolume()).not.toThrow()
  })

  it('decreaseVolume is a no-op — does not throw', () => {
    expect(() => decreaseVolume()).not.toThrow()
  })

  it('resumeAudio is a no-op — does not throw', () => {
    expect(() => resumeAudio()).not.toThrow()
  })

  it('beep is a no-op — does not throw', () => {
    expect(() => beep(440, 100, 0)).not.toThrow()
  })

  it('playPattern returns a safe no-op handle', () => {
    const handle = playPattern([{ freq: 440, dur: 100 }])
    expect(typeof handle.stop).toBe('function')
    expect(typeof handle.setGain).toBe('function')
    expect(() => {
      handle.setGain(0.5)
      handle.stop()
    }).not.toThrow()
  })

  it('stopBeep is a no-op — does not throw', () => {
    expect(() => stopBeep()).not.toThrow()
  })
})

// ── After initAudio() ─────────────────────────────────────────────────────────

describe('audio — after initAudio()', () => {
  beforeAll(() => {
    vi.stubGlobal('AudioContext', MockAudioContext)
    initAudio()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  // ── Context accessors ────────────────────────────────────────────────────────

  it('getAudioContext returns a non-null instance', () => {
    expect(getAudioContext()).not.toBeNull()
  })

  it('getMasterGain returns a non-null gain node', () => {
    expect(getMasterGain()).not.toBeNull()
  })

  it('getMasterVolume returns 0.3 (default)', () => {
    expect(getMasterVolume()).toBeCloseTo(0.3)
  })

  it('initAudio() is idempotent — second call returns same context', () => {
    const before = getAudioContext()
    initAudio()
    expect(getAudioContext()).toBe(before)
  })

  // ── Volume control ───────────────────────────────────────────────────────────

  it('setMasterVolume(0.7) sets gain to 0.7', () => {
    setMasterVolume(0.7)
    expect(getMasterVolume()).toBeCloseTo(0.7)
  })

  it('setMasterVolume clamps value above 1.0 to 1.0', () => {
    setMasterVolume(1.9)
    expect(getMasterVolume()).toBeCloseTo(1.0)
  })

  it('setMasterVolume clamps value below 0.0 to 0.0', () => {
    setMasterVolume(-0.5)
    expect(getMasterVolume()).toBeCloseTo(0.0)
  })

  it('increaseVolume adds 0.1', () => {
    setMasterVolume(0.3)
    increaseVolume()
    expect(getMasterVolume()).toBeCloseTo(0.4)
  })

  it('increaseVolume clamps at 1.0', () => {
    setMasterVolume(0.95)
    increaseVolume()
    expect(getMasterVolume()).toBeCloseTo(1.0)
  })

  it('decreaseVolume subtracts 0.1', () => {
    setMasterVolume(0.4)
    decreaseVolume()
    expect(getMasterVolume()).toBeCloseTo(0.3)
  })

  it('decreaseVolume clamps at 0.0', () => {
    setMasterVolume(0.05)
    decreaseVolume()
    expect(getMasterVolume()).toBeCloseTo(0.0)
  })

  // ── resumeAudio ──────────────────────────────────────────────────────────────

  it('resumeAudio does NOT call ctx.resume() when state is "running"', () => {
    const ctx = getAudioContext() as any
    ctx.state = 'running'
    ctx.resume = vi.fn()
    resumeAudio()
    expect(ctx.resume).not.toHaveBeenCalled()
  })

  it('resumeAudio calls ctx.resume() when state is "suspended"', () => {
    const ctx = getAudioContext() as any
    ctx.state = 'suspended'
    ctx.resume = vi.fn()
    resumeAudio()
    expect(ctx.resume).toHaveBeenCalledOnce()
    ctx.state = 'running'
  })

  it('a rest-only playPattern still unlocks a suspended context', () => {
    const ctx = getAudioContext() as any
    ctx.state = 'suspended'
    ctx.resume = vi.fn()
    // Returns a no-op handle, but the unlock is the whole point of the call.
    const handle = playPattern([{ freq: 0, dur: 40 }])
    expect(ctx.resume).toHaveBeenCalledOnce()
    expect(() => { handle.setGain(0.5); handle.stop() }).not.toThrow()
    ctx.state = 'running'
  })

  // ── beep ─────────────────────────────────────────────────────────────────────

  it('beep — does not throw', () => {
    expect(() => beep(440, 100, 0)).not.toThrow()
  })

  it('beep — sets oscillator type to "square"', () => {
    const actx = getAudioContext() as any
    let capturedOsc: any
    vi.spyOn(actx, 'createOscillator').mockReturnValueOnce(
      (capturedOsc = { type: 'sine', frequency: makeParam(), connect: vi.fn(), start: vi.fn(), stop: vi.fn() }),
    )
    beep(440, 100, 0)
    expect(capturedOsc.type).toBe('square')
    vi.restoreAllMocks()
  })

  it('beep — calls osc.start(startTime)', () => {
    const actx = getAudioContext() as any
    const startSpy = vi.fn()
    vi.spyOn(actx, 'createOscillator').mockReturnValueOnce({
      type: 'sine', frequency: makeParam(), connect: vi.fn(), start: startSpy, stop: vi.fn(),
    })
    beep(440, 100, 1.5)
    expect(startSpy).toHaveBeenCalledWith(1.5)
    vi.restoreAllMocks()
  })

  it('beep — calls osc.stop(startTime + durationMs/1000 + 0.01)', () => {
    const actx = getAudioContext() as any
    const stopSpy = vi.fn()
    vi.spyOn(actx, 'createOscillator').mockReturnValueOnce({
      type: 'sine', frequency: makeParam(), connect: vi.fn(), start: vi.fn(), stop: stopSpy,
    })
    beep(440, 200, 0)
    // 200ms = 0.2s; stop at 0 + 0.2 + 0.01 = 0.21
    expect(stopSpy).toHaveBeenCalledWith(expect.closeTo(0.21, 5))
    vi.restoreAllMocks()
  })

  // ── playPattern ───────────────────────────────────────────────────────────────

  it('playPattern — does not throw with tone notes', () => {
    expect(() => playPattern([{ freq: 440, dur: 100 }, { freq: 523, dur: 100 }])).not.toThrow()
  })

  it('playPattern — empty array does not throw', () => {
    expect(() => playPattern([])).not.toThrow()
  })

  it('playPattern — freq=0 (rest) is a no-op — does not throw', () => {
    expect(() => playPattern([{ freq: 0, dur: 50 }])).not.toThrow()
  })

  it('playPattern — startDelay > 0 does not throw', () => {
    expect(() => playPattern([{ freq: 440, dur: 100 }], 500)).not.toThrow()
  })

  it('playPattern — rest advances offset so next tone starts later', () => {
    const actx = getAudioContext() as any
    actx.state = 'running'
    const starts: number[] = []
    vi.spyOn(actx, 'createOscillator').mockImplementation(() => ({
      type: 'sine', frequency: makeParam(), connect: vi.fn(),
      start: vi.fn((t: number) => starts.push(t)),
      stop:  vi.fn(),
    }))
    // rest 50ms then tone — currentTime is 0 in mock → tone at 0.05s
    playPattern([{ freq: 0, dur: 50 }, { freq: 440, dur: 100 }], 0)
    expect(starts).toHaveLength(1)
    expect(starts[0]).toBeCloseTo(0.05)
    vi.restoreAllMocks()
  })

  it('playPattern — freq>0 notes all produce oscillators', () => {
    const actx = getAudioContext() as any
    actx.state = 'running'
    const starts: number[] = []
    vi.spyOn(actx, 'createOscillator').mockImplementation(() => ({
      type: 'sine', frequency: makeParam(), connect: vi.fn(),
      start: vi.fn((t: number) => starts.push(t)),
      stop:  vi.fn(),
    }))
    playPattern([{ freq: 262, dur: 100 }, { freq: 330, dur: 100 }, { freq: 392, dur: 100 }])
    expect(starts).toHaveLength(3)
    vi.restoreAllMocks()
  })

  // ── stopBeep ──────────────────────────────────────────────────────────────────

  it('stopBeep — releases a sounding tone over 5ms instead of cutting it dead', () => {
    const actx = getAudioContext() as any
    stopBeep()  // flush voices left behind by earlier tests
    const stopSpy = vi.fn()
    const gainParam = makeParam()
    vi.spyOn(actx, 'createOscillator').mockReturnValueOnce({
      type: 'sine', frequency: makeParam(), connect: vi.fn(), start: vi.fn(), stop: stopSpy,
    })
    vi.spyOn(actx, 'createGain').mockReturnValueOnce({
      gain: gainParam, connect: vi.fn(), disconnect: vi.fn(), context: actx,
    })
    beep(440, 200, 0)  // mock currentTime is 0 → this voice is already sounding
    gainParam.linearRampToValueAtTime.mockClear()
    stopSpy.mockClear()

    stopBeep()

    expect(gainParam.cancelAndHoldAtTime).toHaveBeenCalledWith(0)
    expect(gainParam.cancelScheduledValues).not.toHaveBeenCalled()
    expect(gainParam.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.closeTo(0.005, 5))
    expect(stopSpy).toHaveBeenCalledWith(expect.closeTo(0.005, 5))
    vi.restoreAllMocks()
  })

  it('stopBeep — drops a note still queued in the future without a ramp', () => {
    const actx = getAudioContext() as any
    stopBeep()
    const stopSpy = vi.fn()
    const gainParam = makeParam()
    vi.spyOn(actx, 'createOscillator').mockReturnValueOnce({
      type: 'sine', frequency: makeParam(), connect: vi.fn(), start: vi.fn(), stop: stopSpy,
    })
    vi.spyOn(actx, 'createGain').mockReturnValueOnce({
      gain: gainParam, connect: vi.fn(), disconnect: vi.fn(), context: actx,
    })
    beep(440, 200, 1.5)  // starts at 1.5s, currentTime is 0 → never sounded
    gainParam.linearRampToValueAtTime.mockClear()
    gainParam.setValueAtTime.mockClear()
    stopSpy.mockClear()

    stopBeep()

    expect(gainParam.setValueAtTime).toHaveBeenCalledWith(0, 0)
    expect(gainParam.linearRampToValueAtTime).not.toHaveBeenCalled()
    expect(stopSpy).toHaveBeenCalledWith(0)
    vi.restoreAllMocks()
  })

  it('stopBeep — kills every note of a pattern, not only the one sounding', () => {
    const actx = getAudioContext() as any
    stopBeep()
    const stops: number[] = []
    vi.spyOn(actx, 'createOscillator').mockImplementation(() => ({
      type: 'sine', frequency: makeParam(), connect: vi.fn(), start: vi.fn(),
      stop: vi.fn((t: number) => stops.push(t)),
    }))
    playPattern([{ freq: 262, dur: 100 }, { freq: 330, dur: 100 }, { freq: 392, dur: 100 }])
    stops.length = 0  // discard the stop times scheduled by beep() itself

    stopBeep()

    expect(stops).toHaveLength(3)
    vi.restoreAllMocks()
  })

  it('stopBeep — a second call is a no-op, the registry is already empty', () => {
    const actx = getAudioContext() as any
    stopBeep()
    const stops: number[] = []
    vi.spyOn(actx, 'createOscillator').mockImplementation(() => ({
      type: 'sine', frequency: makeParam(), connect: vi.fn(), start: vi.fn(),
      stop: vi.fn((t: number) => stops.push(t)),
    }))
    beep(440, 100, 0)
    stopBeep()
    stops.length = 0

    stopBeep()

    expect(stops).toHaveLength(0)
    vi.restoreAllMocks()
  })

  it('a finished tone unregisters itself — stopBeep does not touch dead voices', () => {
    const actx = getAudioContext() as any
    stopBeep()
    let captured: any
    vi.spyOn(actx, 'createOscillator').mockImplementation(() => (captured = {
      type: 'sine', frequency: makeParam(), connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
    }))
    beep(440, 50, 0)
    captured.onended()  // the tone ends on its own
    captured.stop.mockClear()

    stopBeep()

    expect(captured.stop).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})

// ── BeeperPatternHandle ─────────────────────────────────────────────────────────

describe('audio — BeeperPatternHandle', () => {
  beforeAll(() => {
    vi.stubGlobal('AudioContext', MockAudioContext)
    initAudio()
  })
  afterAll(() => { vi.unstubAllGlobals() })

  it('returns isolated stop and gain controls for an audible pattern', () => {
    const handle = playPattern([{ freq: 440, dur: 100 }])
    expect(typeof handle.stop).toBe('function')
    expect(typeof handle.setGain).toBe('function')
    handle.stop()
  })

  it('empty and all-rest patterns return no-op handles without allocating a bus', () => {
    const actx = getAudioContext() as unknown as MockAudioContext
    stopBeep()
    const gainSpy = vi.spyOn(actx, 'createGain')
    try {
      const empty = playPattern([])
      const rests = playPattern([{ freq: 0, dur: 100 }])
      expect(() => {
        empty.setGain(0.5)
        empty.stop()
        rests.setGain(0.5)
        rests.stop()
      }).not.toThrow()
      expect(gainSpy).not.toHaveBeenCalled()
    } finally {
      gainSpy.mockRestore()
    }
  })

  it('setGain controls only the unity pattern bus, clamps values, and supports explicit ramps', () => {
    const actx = getAudioContext() as unknown as MockAudioContext
    stopBeep()
    const gains: Array<ReturnType<MockAudioContext['createGain']>> = []
    const gainSpy = vi.spyOn(actx, 'createGain').mockImplementation(() => {
      const node = { gain: makeParam(), connect: vi.fn(), disconnect: vi.fn(), context: actx }
      gains.push(node)
      return node
    })
    try {
      const handle = playPattern([{ freq: 440, dur: 100 }])
      expect(gains).toHaveLength(2) // pattern bus, then note envelope
      const bus = gains[0].gain
      const note = gains[1].gain
      expect(bus.value).toBe(1)

      handle.setGain(0.25)
      expect(bus.cancelAndHoldAtTime).toHaveBeenCalledWith(0)
      expect(bus.setValueAtTime).not.toHaveBeenCalled()
      expect(bus.linearRampToValueAtTime).toHaveBeenCalledWith(0.25, 0.005)
      handle.setGain(0.5, 50)
      expect(bus.cancelAndHoldAtTime).toHaveBeenCalledTimes(2)
      expect(bus.linearRampToValueAtTime).toHaveBeenCalledWith(0.5, 0.05)
      expect(note.cancelScheduledValues).not.toHaveBeenCalled()
      expect(note.cancelAndHoldAtTime).not.toHaveBeenCalled()

      handle.setGain(4, 20)
      expect(bus.linearRampToValueAtTime).toHaveBeenCalledWith(1, 0.02)
      handle.setGain(-2, 0)
      expect(bus.setValueAtTime).toHaveBeenLastCalledWith(0, 0)

      const callCount = bus.cancelAndHoldAtTime.mock.calls.length
      handle.setGain(Number.NaN)
      handle.setGain(0.5, Number.POSITIVE_INFINITY)
      expect(bus.cancelAndHoldAtTime).toHaveBeenCalledTimes(callCount)
      handle.stop()
    } finally {
      stopBeep()
      gainSpy.mockRestore()
    }
  })

  it('holds the pre-cancel gain value in browsers without cancelAndHoldAtTime', () => {
    const actx = getAudioContext() as unknown as MockAudioContext
    stopBeep()
    const gains: Array<ReturnType<MockAudioContext['createGain']>> = []
    const gainSpy = vi.spyOn(actx, 'createGain').mockImplementation(() => {
      const node = { gain: makeParam(), connect: vi.fn(), disconnect: vi.fn(), context: actx }
      gains.push(node)
      return node
    })
    try {
      const handle = playPattern([{ freq: 440, dur: 100 }])
      const bus = gains[0].gain
      bus.value = 0.35
      ;(bus as { cancelAndHoldAtTime?: ReturnType<typeof vi.fn> }).cancelAndHoldAtTime = undefined
      bus.cancelScheduledValues.mockImplementation(() => { bus.value = 1 })

      handle.setGain(0.2)

      expect(bus.cancelScheduledValues).toHaveBeenCalledWith(0)
      expect(bus.setValueAtTime).toHaveBeenCalledWith(0.35, 0)
      handle.stop()
    } finally {
      stopBeep()
      gainSpy.mockRestore()
    }
  })

  it('keeps gain automation isolated between concurrent patterns', () => {
    const actx = getAudioContext() as unknown as MockAudioContext
    stopBeep()
    const gains: Array<ReturnType<MockAudioContext['createGain']>> = []
    const gainSpy = vi.spyOn(actx, 'createGain').mockImplementation(() => {
      const node = { gain: makeParam(), connect: vi.fn(), disconnect: vi.fn(), context: actx }
      gains.push(node)
      return node
    })
    try {
      const first = playPattern([{ freq: 440, dur: 100 }])
      const second = playPattern([{ freq: 660, dur: 100 }])
      expect(gains).toHaveLength(4) // first bus/note, second bus/note

      first.setGain(0.2, 25)
      expect(gains[0].gain.cancelAndHoldAtTime).toHaveBeenCalledWith(0)
      expect(gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.2, 0.025)
      expect(gains[1].gain.cancelAndHoldAtTime).not.toHaveBeenCalled()
      expect(gains[2].gain.cancelAndHoldAtTime).not.toHaveBeenCalled()
      expect(gains[3].gain.cancelAndHoldAtTime).not.toHaveBeenCalled()

      first.stop()
      second.stop()
    } finally {
      stopBeep()
      gainSpy.mockRestore()
    }
  })

  it('ignores non-finite fades without consuming the handle and clamps a negative fade to immediate', () => {
    const actx = getAudioContext() as unknown as MockAudioContext
    stopBeep()
    const oscillators: Array<ReturnType<MockAudioContext['createOscillator']>> = []
    const oscSpy = vi.spyOn(actx, 'createOscillator').mockImplementation(() => {
      const node = {
        type: 'sine' as OscillatorType,
        frequency: makeParam(),
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      oscillators.push(node)
      return node
    })
    try {
      const handle = playPattern([{ freq: 440, dur: 100 }])
      oscillators[0].stop.mockClear()

      handle.stop(Number.NaN)
      handle.stop(Number.POSITIVE_INFINITY)
      handle.stop(Number.NEGATIVE_INFINITY)
      expect(oscillators[0].stop).not.toHaveBeenCalled()

      handle.stop(-10)
      expect(oscillators[0].stop).toHaveBeenCalledWith(0)
    } finally {
      stopBeep()
      oscSpy.mockRestore()
    }
  })

  it('rolls back scheduled voices and disconnects the bus if pattern scheduling throws', () => {
    const actx = getAudioContext() as unknown as MockAudioContext
    stopBeep()
    const gains: Array<ReturnType<MockAudioContext['createGain']>> = []
    const gainSpy = vi.spyOn(actx, 'createGain').mockImplementation(() => {
      const node = { gain: makeParam(), connect: vi.fn(), disconnect: vi.fn(), context: actx }
      gains.push(node)
      return node
    })
    const firstOscillator = {
      type: 'sine' as OscillatorType,
      frequency: makeParam(),
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: undefined as (() => void) | undefined,
    }
    const oscSpy = vi.spyOn(actx, 'createOscillator')
      .mockReturnValueOnce(firstOscillator)
      .mockImplementationOnce(() => { throw new Error('mock scheduling failure') })
    try {
      expect(() => playPattern([{ freq: 440, dur: 100 }, { freq: 660, dur: 100 }])).toThrow(
        'mock scheduling failure',
      )
      expect(firstOscillator.stop).toHaveBeenLastCalledWith(0)
      expect(gains[0].disconnect).toHaveBeenCalledTimes(1)

      firstOscillator.onended?.()
      expect(gains[0].disconnect).toHaveBeenCalledTimes(1)
    } finally {
      stopBeep()
      oscSpy.mockRestore()
      gainSpy.mockRestore()
    }
  })

  it('stops current and queued notes from one pattern without touching siblings or direct beeps', () => {
    const actx = getAudioContext() as unknown as MockAudioContext
    stopBeep()
    const oscillators: Array<ReturnType<MockAudioContext['createOscillator']>> = []
    const oscSpy = vi.spyOn(actx, 'createOscillator').mockImplementation(() => {
      const node = {
        type: 'sine' as OscillatorType,
        frequency: makeParam(),
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      oscillators.push(node)
      return node
    })
    try {
      const first = playPattern([{ freq: 440, dur: 100 }, { freq: 550, dur: 100 }])
      const sibling = playPattern([{ freq: 660, dur: 100 }])
      beep(880, 100, 0)
      expect(oscillators).toHaveLength(4)
      for (const osc of oscillators) osc.stop.mockClear()

      first.stop(20)
      expect(oscillators[0].stop).toHaveBeenCalledWith(0.02)
      expect(oscillators[1].stop).toHaveBeenCalledWith(0)
      expect(oscillators[2].stop).not.toHaveBeenCalled()
      expect(oscillators[3].stop).not.toHaveBeenCalled()

      first.stop()
      expect(oscillators[0].stop).toHaveBeenCalledTimes(1)
      expect(oscillators[1].stop).toHaveBeenCalledTimes(1)

      sibling.stop()
      expect(oscillators[2].stop).toHaveBeenCalledWith(0.005)
      expect(oscillators[3].stop).not.toHaveBeenCalled()
      stopBeep()
      expect(oscillators[3].stop).toHaveBeenCalledWith(0.005)
    } finally {
      stopBeep()
      oscSpy.mockRestore()
    }
  })

  it('disconnects the pattern bus only after its final voice ends naturally', () => {
    const actx = getAudioContext() as unknown as MockAudioContext
    stopBeep()
    const gains: Array<ReturnType<MockAudioContext['createGain']>> = []
    const oscillators: Array<ReturnType<MockAudioContext['createOscillator']> & { onended?: () => void }> = []
    const gainSpy = vi.spyOn(actx, 'createGain').mockImplementation(() => {
      const node = { gain: makeParam(), connect: vi.fn(), disconnect: vi.fn(), context: actx }
      gains.push(node)
      return node
    })
    const oscSpy = vi.spyOn(actx, 'createOscillator').mockImplementation(() => {
      const node = {
        type: 'sine' as OscillatorType,
        frequency: makeParam(),
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: undefined as (() => void) | undefined,
      }
      oscillators.push(node)
      return node
    })
    try {
      const handle = playPattern([{ freq: 440, dur: 50 }, { freq: 550, dur: 50 }])
      const bus = gains[0]
      expect(bus.disconnect).not.toHaveBeenCalled()
      oscillators[0].onended?.()
      expect(bus.disconnect).not.toHaveBeenCalled()
      oscillators[1].onended?.()
      expect(bus.disconnect).toHaveBeenCalledTimes(1)

      const gainCalls = bus.gain.cancelAndHoldAtTime.mock.calls.length
      handle.setGain(0.2)
      handle.stop()
      expect(bus.gain.cancelAndHoldAtTime).toHaveBeenCalledTimes(gainCalls)
    } finally {
      stopBeep()
      oscSpy.mockRestore()
      gainSpy.mockRestore()
    }
  })

  it('remains safe when the global stop reaches the pattern first', () => {
    const handle = playPattern([{ freq: 440, dur: 100 }, { freq: 550, dur: 100 }])
    stopBeep()
    expect(() => {
      handle.setGain(0.4)
      handle.stop()
      handle.stop()
    }).not.toThrow()
  })

  it('lets global stop replace a long local fade with the canonical cut', () => {
    const actx = getAudioContext() as unknown as MockAudioContext
    stopBeep()
    const oscillators: Array<ReturnType<MockAudioContext['createOscillator']>> = []
    const oscSpy = vi.spyOn(actx, 'createOscillator').mockImplementation(() => {
      const node = {
        type: 'sine' as OscillatorType,
        frequency: makeParam(),
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      oscillators.push(node)
      return node
    })
    try {
      const handle = playPattern([{ freq: 440, dur: 100 }, { freq: 550, dur: 100 }])
      for (const oscillator of oscillators) oscillator.stop.mockClear()

      handle.stop(1000)
      for (const oscillator of oscillators) oscillator.stop.mockClear()
      stopBeep()

      expect(oscillators[0].stop).toHaveBeenCalledWith(0.005)
      expect(oscillators[1].stop).toHaveBeenCalledWith(0)
    } finally {
      stopBeep()
      oscSpy.mockRestore()
    }
  })
})

// ── Volume HUD bar ──────────────────────────────────────────────────────────────
// drawVolumeBar renders in game-pixel space via ui.ts drawProgressBar; the canvas
// backing store is SCALE× (256 → 1024). We record fillRect calls to assert geometry.

type FillCall = { style: string; x: number; y: number; w: number; h: number }

function makeMockCtx(canvasWidth = 1024, scale = 4) {
  let _fillStyle = ''
  const rects: FillCall[] = []
  return {
    get fillStyle() { return _fillStyle },
    set fillStyle(v: string) { _fillStyle = v },
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ style: _fillStyle, x, y, w, h })
    },
    getTransform: () => ({ a: scale }),       // setupCanvas applies ctx.scale(scale, scale)
    canvas: { width: canvasWidth, height: (canvasWidth / 4) * 3 },
    _rects: rects,
  } as unknown as CanvasRenderingContext2D & { _rects: FillCall[] }
}

describe('audio — volume HUD bar', () => {
  let nowSpy: ReturnType<typeof vi.spyOn>

  beforeAll(() => {
    vi.stubGlobal('AudioContext', MockAudioContext)
    initAudio()                       // idempotent; ensures masterGain exists
    nowSpy = vi.spyOn(performance, 'now')
  })

  afterAll(() => {
    nowSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    resetUI()
    // Reset style back to defaults for the next test (config-once module state).
    setVolumeBarStyle({ color: C.B_GREEN, segments: 10, y: 96 - 8 })
  })

  it('increaseVolume shows the bar within the 1.5s window', () => {
    setMasterVolume(0.5)
    nowSpy.mockReturnValue(1000)
    increaseVolume()                  // stamps _volumeChangedAt = 1000
    const ctx = makeMockCtx()
    nowSpy.mockReturnValue(1200)       // 200ms later — inside window
    drawVolumeBar(ctx)
    expect(ctx._rects.length).toBeGreaterThan(0)
  })

  it('decreaseVolume shows the bar within the window', () => {
    setMasterVolume(0.5)
    nowSpy.mockReturnValue(2000)
    decreaseVolume()
    const ctx = makeMockCtx()
    nowSpy.mockReturnValue(2000)
    drawVolumeBar(ctx)
    expect(ctx._rects.length).toBeGreaterThan(0)
  })

  it('draws nothing once more than 1.5s has passed', () => {
    setMasterVolume(0.5)
    nowSpy.mockReturnValue(1000)
    increaseVolume()
    const ctx = makeMockCtx()
    nowSpy.mockReturnValue(3000)       // 2000ms later — outside window
    drawVolumeBar(ctx)
    expect(ctx._rects).toHaveLength(0)
  })

  it('centres horizontally by default — (canvas.width/scale - width)/2', () => {
    setMasterVolume(0.5)
    nowSpy.mockReturnValue(1000)
    increaseVolume()
    const ctx = makeMockCtx(1024, 4)   // → screenW 256, width 80 → x = 88
    nowSpy.mockReturnValue(1000)
    drawVolumeBar(ctx)
    // The paper background spans the full bar width at the centred x.
    expect(ctx._rects.some(r => r.x === 88 && r.w === 80)).toBe(true)
  })

  it('centres correctly at a non-4 canvas scale (reads ctx.getTransform)', () => {
    setMasterVolume(0.5)
    nowSpy.mockReturnValue(1000)
    increaseVolume()
    const ctx = makeMockCtx(768, 3)    // scale 3 → screenW 256, width 80 → x = 88
    nowSpy.mockReturnValue(1000)
    drawVolumeBar(ctx)
    expect(ctx._rects.some(r => r.x === 88 && r.w === 80)).toBe(true)
  })

  it('honours setVolumeBarStyle({ x }) override', () => {
    setVolumeBarStyle({ x: 16 })
    setMasterVolume(0.5)
    nowSpy.mockReturnValue(1000)
    increaseVolume()
    const ctx = makeMockCtx(1024)
    nowSpy.mockReturnValue(1000)
    drawVolumeBar(ctx)
    expect(ctx._rects.some(r => r.x === 16 && r.w === 80)).toBe(true)
  })

  it('honours setVolumeBarStyle({ segments }) — width = segments * CELL', () => {
    setVolumeBarStyle({ segments: 16 })   // → width 128
    setMasterVolume(0.5)
    nowSpy.mockReturnValue(1000)
    increaseVolume()
    const ctx = makeMockCtx(1024)
    nowSpy.mockReturnValue(1000)
    drawVolumeBar(ctx)
    expect(ctx._rects.some(r => r.w === 128)).toBe(true)
  })

  it('honours setVolumeBarStyle({ color }) — filled blocks use the chosen ink', () => {
    setVolumeBarStyle({ color: C.B_CYAN })
    setMasterVolume(0.5)               // → at least one filled block after increase
    nowSpy.mockReturnValue(1000)
    increaseVolume()                   // 0.5 → 0.6
    const ctx = makeMockCtx(1024)
    nowSpy.mockReturnValue(1000)
    drawVolumeBar(ctx)
    expect(ctx._rects.some(r => r.style === C.B_CYAN)).toBe(true)
  })
})

// ── beep() — stereo pan ─────────────────────────────────────────────────────────

describe('audio — beep() stereo pan', () => {
  beforeAll(() => {
    vi.stubGlobal('AudioContext', MockAudioContext)
    initAudio()
  })
  afterAll(() => { vi.unstubAllGlobals() })

  it('beep with pan = 0 (default) does NOT create a StereoPanner (non-breaking)', () => {
    const actx = getAudioContext() as unknown as MockAudioContext
    const spy = vi.spyOn(actx, 'createStereoPanner')
    try {
      beep(440, 80, 0)
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  it('beep with a non-zero pan inserts a StereoPanner and sets its pan value', () => {
    const actx = getAudioContext() as unknown as MockAudioContext
    const spy = vi.spyOn(actx, 'createStereoPanner')
    try {
      beep(440, 80, 0, -1)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy.mock.results[0].value.pan.value).toBe(-1)
    } finally {
      spy.mockRestore()
    }
  })

  it('beep clamps pan to [-1, 1]', () => {
    const actx = getAudioContext() as unknown as MockAudioContext
    const spy = vi.spyOn(actx, 'createStereoPanner')
    try {
      beep(440, 80, 0, 9)
      expect(spy.mock.results[0].value.pan.value).toBe(1)
    } finally {
      spy.mockRestore()
    }
  })

  it('playPattern forwards Note.pan to beep (only non-zero pans create a panner)', () => {
    const actx = getAudioContext() as unknown as MockAudioContext
    const spy = vi.spyOn(actx, 'createStereoPanner')
    try {
      playPattern([{ freq: 440, dur: 40, pan: 1 }, { freq: 660, dur: 40 }])
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy.mock.results[0].value.pan.value).toBe(1)
    } finally {
      spy.mockRestore()
    }
  })
})

// ── beep() / playPattern() — per-call volume ───────────────────────────────────
// The point of the parameter is MIXING: a game must be able to put a frequent,
// low-information sound (a footstep) under an important one (a danger warning)
// without touching the master volume, which would move both together.

describe('audio — per-call volume', () => {
  beforeAll(() => {
    vi.stubGlobal('AudioContext', MockAudioContext)
    initAudio()
  })
  afterAll(() => { vi.unstubAllGlobals() })

  /** Peak value the voice ramps up to — the second arg of the attack ramp. */
  function peakOf(fn: () => void): number {
    const actx = getAudioContext() as unknown as MockAudioContext
    const gainParams: ReturnType<typeof makeParam>[] = []
    const spy = vi.spyOn(actx, 'createGain').mockImplementation(() => {
      const gain = makeParam()
      gainParams.push(gain)
      return { gain, connect: vi.fn(), disconnect: vi.fn(), context: actx }
    })
    try {
      fn()
      // playPattern adds a unity pattern bus before its note envelope. Find the
      // note attack ramp rather than assuming the first GainNode is the voice.
      const attack = gainParams.flatMap((param) => param.linearRampToValueAtTime.mock.calls)
        .find((call) => call[1] === 0.005)
      return attack?.[0] as number
    } finally {
      spy.mockRestore()
    }
  }

  it('omitting volume keeps the historical 0.8 peak (existing callers unchanged)', () => {
    expect(peakOf(() => beep(440, 80, 0))).toBe(0.8)
    expect(BEEP_VOLUME).toBe(0.8)
  })

  it('a quieter volume is honoured', () => {
    expect(peakOf(() => beep(440, 80, 0, 0, 0.25))).toBe(0.25)
  })

  it('volume is clamped to [0, 1]', () => {
    expect(peakOf(() => beep(440, 80, 0, 0, 4))).toBe(1)
    expect(peakOf(() => beep(440, 80, 0, 0, -2))).toBe(0)
  })

  it('playPattern applies its volume to every note', () => {
    expect(peakOf(() => playPattern([{ freq: 440, dur: 40 }], 0, 0.3))).toBe(0.3)
  })

  it("a note's own volume overrides the pattern volume", () => {
    expect(peakOf(() => playPattern([{ freq: 440, dur: 40, volume: 0.1 }], 0, 0.9))).toBe(0.1)
  })
})
