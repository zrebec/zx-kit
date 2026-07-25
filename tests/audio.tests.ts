import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import {
  initAudio, getAudioContext, getMasterGain, getMasterVolume,
  setMasterVolume, increaseVolume, decreaseVolume,
  resumeAudio, beep, playPattern, stopBeep,
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

  it('playPattern is a no-op — does not throw', () => {
    expect(() => playPattern([{ freq: 440, dur: 100 }])).not.toThrow()
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

    expect(gainParam.cancelScheduledValues).toHaveBeenCalledWith(0)
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
