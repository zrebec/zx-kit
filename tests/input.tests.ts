import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import {
  initInput, tickMovement, resetInput,
  consumeFlag, consumeDebug, consumePause, consumeAnyKey,
  isHeld, setVolumeKeys,
} from '../src/input.js'
import { initAudio, getMasterVolume, setMasterVolume } from '../src/audio.js'

// ── Keyboard listener capture ──────────────────────────────────────────────────
// initInput() calls window.addEventListener once (idempotent via module flag).
// We stub window before calling initInput so our listeners dict receives the handlers.

const listeners: Record<string, (e: any) => void> = {}

function keydown(key: string, extra: Record<string, unknown> = {}): void {
  listeners['keydown']?.({
    key,
    repeat:    false,
    ctrlKey:   false,
    shiftKey:  false,
    preventDefault: vi.fn(),
    ...extra,
  })
}

function keyup(key: string): void {
  listeners['keyup']?.({ key })
}

// ── Pre-init state ─────────────────────────────────────────────────────────────

describe('input — initial state (before initInput)', () => {
  it('consumeFlag returns false', () => {
    expect(consumeFlag()).toBe(false)
  })

  it('consumeDebug returns false', () => {
    expect(consumeDebug()).toBe(false)
  })

  it('consumePause returns false', () => {
    expect(consumePause()).toBe(false)
  })

  it('consumeAnyKey returns false', () => {
    expect(consumeAnyKey()).toBe(false)
  })

  it('isHeld returns false for any key', () => {
    expect(isHeld('ArrowUp')).toBe(false)
    expect(isHeld(' ')).toBe(false)
  })

  it('tickMovement returns null when no input', () => {
    expect(tickMovement(16)).toBeNull()
  })

  it('resetInput does not throw', () => {
    expect(() => resetInput()).not.toThrow()
  })
})

// ── Keyboard — post-init ───────────────────────────────────────────────────────

describe('input — keyboard (after initInput)', () => {
  beforeAll(() => {
    vi.stubGlobal('window', {
      addEventListener: vi.fn((type: string, fn: (e: any) => void) => {
        listeners[type] = fn
      }),
    })
    initInput()        // attaches keydown/keyup to our mock window
    vi.unstubAllGlobals()  // listeners captured — window stub no longer needed
  })

  afterEach(() => {
    resetInput()
  })

  // ── Arrow key → direction ──────────────────────────────────────────────────

  it('ArrowUp → tickMovement returns "up"', () => {
    keydown('ArrowUp')
    expect(tickMovement(0)).toBe('up')
  })

  it('ArrowDown → tickMovement returns "down"', () => {
    keydown('ArrowDown')
    expect(tickMovement(0)).toBe('down')
  })

  it('ArrowLeft → tickMovement returns "left"', () => {
    keydown('ArrowLeft')
    expect(tickMovement(0)).toBe('left')
  })

  it('ArrowRight → tickMovement returns "right"', () => {
    keydown('ArrowRight')
    expect(tickMovement(0)).toBe('right')
  })

  it('no input → tickMovement returns null', () => {
    expect(tickMovement(16)).toBeNull()
  })

  // ── e.repeat=true is ignored ───────────────────────────────────────────────

  it('e.repeat=true keydown is ignored — direction not set', () => {
    keydown('ArrowUp', { repeat: true })
    expect(tickMovement(0)).toBeNull()
  })

  it('e.repeat=true keydown does not set anyKey', () => {
    keydown('ArrowUp', { repeat: true })
    expect(consumeAnyKey()).toBe(false)
  })

  // ── isHeld ─────────────────────────────────────────────────────────────────

  it('isHeld returns true after keydown', () => {
    keydown('ArrowUp')
    expect(isHeld('ArrowUp')).toBe(true)
  })

  it('isHeld returns false after matching keyup', () => {
    keydown('ArrowUp')
    keyup('ArrowUp')
    expect(isHeld('ArrowUp')).toBe(false)
  })

  // ── Pending flags ─────────────────────────────────────────────────────────

  it('F key sets pendingFlag — consumeFlag returns true, then false', () => {
    keydown('F')
    expect(consumeFlag()).toBe(true)
    expect(consumeFlag()).toBe(false)
  })

  it('f (lowercase) also sets pendingFlag', () => {
    keydown('f')
    expect(consumeFlag()).toBe(true)
  })

  it('P key sets pendingPause — consumePause returns true, then false', () => {
    keydown('P')
    expect(consumePause()).toBe(true)
    expect(consumePause()).toBe(false)
  })

  it('p (lowercase) also sets pendingPause', () => {
    keydown('p')
    expect(consumePause()).toBe(true)
  })

  it('Ctrl+Shift+B sets pendingDebug and calls preventDefault', () => {
    const preventDefault = vi.fn()
    listeners['keydown']({
      key: 'B', repeat: false, ctrlKey: true, shiftKey: true, preventDefault,
    })
    expect(consumeDebug()).toBe(true)
    expect(preventDefault).toHaveBeenCalled()
  })

  it('B without modifiers does NOT set pendingDebug', () => {
    keydown('B')
    expect(consumeDebug()).toBe(false)
  })

  it('any keydown sets anyKey — consumeAnyKey returns true, then false', () => {
    keydown('z')
    expect(consumeAnyKey()).toBe(true)
    expect(consumeAnyKey()).toBe(false)
  })

  // ── keyup clears repeat ────────────────────────────────────────────────────

  it('keyup stops repetition — tickMovement returns null after keyup', () => {
    keydown('ArrowUp')
    tickMovement(0)    // consume pendingImmediate
    keyup('ArrowUp')
    expect(tickMovement(300)).toBeNull()
  })

  it('keyup for a non-direction key does not affect repeat state', () => {
    keydown('ArrowLeft')
    tickMovement(0)
    keyup('F')         // irrelevant key
    expect(tickMovement(10)).toBeNull()  // still within delay period
  })

  // ── Key repeat timing ─────────────────────────────────────────────────────

  it('direction is returned immediately on first press (pendingImmediate)', () => {
    keydown('ArrowRight')
    expect(tickMovement(0)).toBe('right')
  })

  it('no repeat before repeatDelay elapses', () => {
    keydown('ArrowRight')
    tickMovement(0)     // consume immediate
    expect(tickMovement(100)).toBeNull()  // 100ms < 150ms delay
  })

  it('repeat fires once repeatDelay is exceeded', () => {
    keydown('ArrowLeft')
    tickMovement(0)     // consume immediate (timer = 150)
    expect(tickMovement(160)).toBe('left')  // 160 > 150 → fires, timer reset to interval
  })

  it('repeat fires again after repeatInterval', () => {
    keydown('ArrowDown')
    tickMovement(0)    // consume immediate
    tickMovement(160)  // first repeat (past delay)
    expect(tickMovement(80)).toBe('down')  // interval (80ms) elapsed
  })

  // ── resetInput ────────────────────────────────────────────────────────────

  it('resetInput clears pending flags', () => {
    keydown('F')
    keydown('P')
    keydown('ArrowUp')
    resetInput()
    expect(consumeFlag()).toBe(false)
    expect(consumePause()).toBe(false)
    expect(consumeAnyKey()).toBe(false)
    expect(tickMovement(0)).toBeNull()
  })

  it('resetInput clears isHeld state', () => {
    keydown('ArrowUp')
    resetInput()
    expect(isHeld('ArrowUp')).toBe(false)
  })

  // ── initInput reconfigures timing ─────────────────────────────────────────

  it('initInput reconfigures repeat timing without re-attaching listeners', () => {
    initInput(200, 100)   // new timing — should not throw or duplicate listeners
    keydown('ArrowUp')
    tickMovement(0)
    // With 200ms delay, 160ms is not enough to fire
    expect(tickMovement(160)).toBeNull()
    initInput()   // restore defaults
  })
})

// ── Gamepad ───────────────────────────────────────────────────────────────────

describe('input — gamepad D-pad and buttons', () => {
  const mockPad = {
    connected: true,
    buttons: Array.from({ length: 16 }, () => ({ pressed: false })) as Array<{ pressed: boolean }>,
    axes: [0, 0, 0, 0],
  }

  beforeAll(() => {
    vi.stubGlobal('navigator', { getGamepads: () => [mockPad] })
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    // Reset pad state and input module state
    for (const btn of mockPad.buttons) btn.pressed = false
    mockPad.axes[0] = 0
    mockPad.axes[1] = 0
    resetInput()
  })

  // ── D-pad ─────────────────────────────────────────────────────────────────

  it('D-pad up (button 12) → tickMovement returns "up"', () => {
    mockPad.buttons[12].pressed = true
    expect(tickMovement(0)).toBe('up')
  })

  it('D-pad down (button 13) → tickMovement returns "down"', () => {
    mockPad.buttons[13].pressed = true
    expect(tickMovement(0)).toBe('down')
  })

  it('D-pad left (button 14) → tickMovement returns "left"', () => {
    mockPad.buttons[14].pressed = true
    expect(tickMovement(0)).toBe('left')
  })

  it('D-pad right (button 15) → tickMovement returns "right"', () => {
    mockPad.buttons[15].pressed = true
    expect(tickMovement(0)).toBe('right')
  })

  it('no button pressed → tickMovement returns null', () => {
    expect(tickMovement(0)).toBeNull()
  })

  // ── Analog stick ─────────────────────────────────────────────────────────

  it('analog stick right (ax > STICK_DEAD) → returns "right"', () => {
    mockPad.axes[0] = 0.9
    expect(tickMovement(0)).toBe('right')
  })

  it('analog stick left (ax < -STICK_DEAD) → returns "left"', () => {
    mockPad.axes[0] = -0.9
    expect(tickMovement(0)).toBe('left')
  })

  it('analog stick within dead zone → returns null', () => {
    mockPad.axes[0] = 0.2  // < STICK_DEAD (0.35)
    mockPad.axes[1] = 0.1
    expect(tickMovement(0)).toBeNull()
  })

  it('analog stick Y dominant → vertical direction wins', () => {
    mockPad.axes[0] = 0.4   // both beyond dead zone
    mockPad.axes[1] = -0.8  // Y is larger abs value → up
    expect(tickMovement(0)).toBe('up')
  })

  // ── Action buttons ────────────────────────────────────────────────────────

  it('button A (0) rising edge → consumeFlag returns true', () => {
    mockPad.buttons[0].pressed = true
    tickMovement(0)  // polls gamepad → rising edge → pendingFlag
    expect(consumeFlag()).toBe(true)
  })

  it('button Start (9) rising edge → consumePause returns true', () => {
    mockPad.buttons[9].pressed = true
    tickMovement(0)
    expect(consumePause()).toBe(true)
  })

  it('button Y (3) rising edge → consumeDebug returns true', () => {
    mockPad.buttons[3].pressed = true
    tickMovement(0)
    expect(consumeDebug()).toBe(true)
  })

  it('any button press → consumeAnyKey returns true', () => {
    mockPad.buttons[2].pressed = true
    tickMovement(0)
    expect(consumeAnyKey()).toBe(true)
  })
})

// ── Volume keys ──────────────────────────────────────────────────────────────────
// initInput wires +/- to audio's increaseVolume/decreaseVolume by default. We init a
// mocked AudioContext so the volume actually moves and can be observed.

class MockAudioContext {
  readonly destination = {}
  createGain() {
    return { gain: { value: 0 }, connect: () => {} }
  }
}

describe('input — volume keys', () => {
  beforeAll(() => {
    vi.stubGlobal('AudioContext', MockAudioContext)
    initAudio()                // sets up masterGain so volume changes are observable
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    resetInput()
    setVolumeKeys(['+', '='], ['-', '_'])  // restore defaults (module state)
  })

  it("'+' raises master volume by default", () => {
    setMasterVolume(0.5)
    keydown('+')
    expect(getMasterVolume()).toBeCloseTo(0.6)
  })

  it("'=' also raises volume (shift-less +)", () => {
    setMasterVolume(0.5)
    keydown('=')
    expect(getMasterVolume()).toBeCloseTo(0.6)
  })

  it("'-' lowers master volume by default", () => {
    setMasterVolume(0.5)
    keydown('-')
    expect(getMasterVolume()).toBeCloseTo(0.4)
  })

  it("'_' also lowers volume", () => {
    setMasterVolume(0.5)
    keydown('_')
    expect(getMasterVolume()).toBeCloseTo(0.4)
  })

  it('setVolumeKeys remaps the keys — 9 raises, 8 lowers', () => {
    setVolumeKeys('9', '8')
    setMasterVolume(0.5)
    keydown('9')
    expect(getMasterVolume()).toBeCloseTo(0.6)
    setMasterVolume(0.5)
    keydown('8')
    expect(getMasterVolume()).toBeCloseTo(0.4)
  })

  it('after remap, +/- no longer change volume', () => {
    setVolumeKeys('9', '8')
    setMasterVolume(0.5)
    keydown('+')
    keydown('-')
    expect(getMasterVolume()).toBeCloseTo(0.5)
  })

  it('setVolumeKeys([], []) disables volume keys', () => {
    setVolumeKeys([], [])
    setMasterVolume(0.5)
    keydown('+')
    keydown('-')
    expect(getMasterVolume()).toBeCloseTo(0.5)
  })
})
