import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import {
  initAudio, getAudioContext, getMasterGain, getMasterVolume,
  setMasterVolume, increaseVolume, decreaseVolume,
  resumeAudio, beep, playPattern,
} from '../src/audio.js'

// ── Web Audio mock ─────────────────────────────────────────────────────────────

function makeParam() {
  return {
    value: 0,
    setValueAtTime:          vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues:   vi.fn(),
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

  it('playPattern is a no-op — does not throw', () => {
    expect(() => playPattern([{ freq: 440, dur: 100 }])).not.toThrow()
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
})
