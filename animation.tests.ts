import { describe, it, expect, vi } from 'vitest'
import {
  createAnimation, tickAnimation, getAnimationFrame, resetAnimation,
  createTween, tickTween, Easings,
  createBlinker, tickBlinker,
} from './src/animation.js'

// ── Animation: looping ────────────────────────────────────────────────────────

describe('Animation — looping', () => {
  it('starts at frame 0', () => {
    const a = createAnimation(2, 100)
    expect(getAnimationFrame(a)).toBe(0)
  })

  it('stays on frame 0 before frameMs has elapsed', () => {
    const a = createAnimation(2, 100)
    expect(tickAnimation(a, 50)).toBe(0)
  })

  it('advances to frame 1 after frameMs elapses', () => {
    const a = createAnimation(2, 100)
    expect(tickAnimation(a, 100)).toBe(1)
  })

  it('wraps back to frame 0 after totalMs', () => {
    const a = createAnimation(2, 100)
    tickAnimation(a, 100)              // → frame 1
    expect(tickAnimation(a, 100)).toBe(0)  // wrap
  })

  it('handles 4-frame cycles', () => {
    const a = createAnimation(4, 50)
    expect(tickAnimation(a, 50)).toBe(1)
    expect(tickAnimation(a, 50)).toBe(2)
    expect(tickAnimation(a, 50)).toBe(3)
    expect(tickAnimation(a, 50)).toBe(0)  // wrap
  })

  it('never marks looping animation as done', () => {
    const a = createAnimation(2, 50)
    for (let i = 0; i < 10; i++) tickAnimation(a, 100)
    expect(a.done).toBe(false)
  })
})

// ── Animation: non-looping ────────────────────────────────────────────────────

describe('Animation — non-looping', () => {
  it('stops on the last frame', () => {
    const a = createAnimation(3, 50, { loop: false })
    tickAnimation(a, 50)   // → 1
    tickAnimation(a, 50)   // → 2
    tickAnimation(a, 50)   // → 2 (last; clamped)
    expect(getAnimationFrame(a)).toBe(2)
  })

  it('marks done when last frame ends', () => {
    const a = createAnimation(2, 50, { loop: false })
    tickAnimation(a, 100)  // both frames consumed
    expect(a.done).toBe(true)
  })

  it('subsequent ticks after done return last frame', () => {
    const a = createAnimation(2, 50, { loop: false })
    tickAnimation(a, 200)
    expect(tickAnimation(a, 100)).toBe(1)
  })

  it('fires onComplete exactly once', () => {
    const cb = vi.fn()
    const a = createAnimation(2, 50, { loop: false, onComplete: cb })
    tickAnimation(a, 100)
    tickAnimation(a, 100)
    tickAnimation(a, 100)
    expect(cb).toHaveBeenCalledTimes(1)
  })
})

// ── Animation: reset ──────────────────────────────────────────────────────────

describe('Animation — reset', () => {
  it('resets elapsed time', () => {
    const a = createAnimation(2, 100)
    tickAnimation(a, 100)
    resetAnimation(a)
    expect(getAnimationFrame(a)).toBe(0)
  })

  it('clears done flag on non-looping animation', () => {
    const a = createAnimation(2, 50, { loop: false })
    tickAnimation(a, 200)
    expect(a.done).toBe(true)
    resetAnimation(a)
    expect(a.done).toBe(false)
  })

  it('allows onComplete to fire again after reset', () => {
    const cb = vi.fn()
    const a = createAnimation(2, 50, { loop: false, onComplete: cb })
    tickAnimation(a, 200)
    resetAnimation(a)
    tickAnimation(a, 200)
    expect(cb).toHaveBeenCalledTimes(2)
  })
})

// ── Tween: linear interpolation ───────────────────────────────────────────────

describe('Tween — linear interpolation', () => {
  it('starts at fromX/fromY', () => {
    const t = createTween(0, 0, 100, 50, 200)
    expect(t.x).toBe(0)
    expect(t.y).toBe(0)
  })

  it('reaches midpoint at half duration', () => {
    const t = createTween(0, 0, 100, 50, 200)
    tickTween(t, 100)
    expect(t.x).toBeCloseTo(50)
    expect(t.y).toBeCloseTo(25)
  })

  it('snaps to toX/toY at completion', () => {
    const t = createTween(0, 0, 100, 50, 200)
    tickTween(t, 200)
    expect(t.x).toBe(100)
    expect(t.y).toBe(50)
  })

  it('clamps overshoot to end position', () => {
    const t = createTween(0, 0, 100, 50, 200)
    tickTween(t, 500)  // way past end
    expect(t.x).toBe(100)
    expect(t.y).toBe(50)
  })

  it('returns true once done', () => {
    const t = createTween(0, 0, 100, 50, 200)
    expect(tickTween(t, 100)).toBe(false)
    expect(tickTween(t, 100)).toBe(true)
  })

  it('handles negative deltas (right-to-left motion)', () => {
    const t = createTween(100, 0, 0, 0, 200)
    tickTween(t, 100)
    expect(t.x).toBeCloseTo(50)
  })
})

// ── Tween: easing ─────────────────────────────────────────────────────────────

describe('Tween — easing', () => {
  it('linear is the default', () => {
    const t = createTween(0, 0, 100, 0, 200)
    tickTween(t, 100)
    expect(t.x).toBeCloseTo(50)
  })

  it('easeOut decelerates near the end (>50% at midpoint)', () => {
    const t = createTween(0, 0, 100, 0, 200, { ease: Easings.easeOut })
    tickTween(t, 100)
    expect(t.x).toBeGreaterThan(50)
  })

  it('easeIn accelerates from the start (<50% at midpoint)', () => {
    const t = createTween(0, 0, 100, 0, 200, { ease: Easings.easeIn })
    tickTween(t, 100)
    expect(t.x).toBeLessThan(50)
  })
})

// ── Tween: onComplete ─────────────────────────────────────────────────────────

describe('Tween — onComplete', () => {
  it('fires onComplete exactly once', () => {
    const cb = vi.fn()
    const t = createTween(0, 0, 100, 0, 200, { onComplete: cb })
    tickTween(t, 100)
    tickTween(t, 100)
    tickTween(t, 100)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('subsequent ticks after done are no-ops', () => {
    const t = createTween(0, 0, 100, 0, 200)
    tickTween(t, 200)
    const before = t.x
    tickTween(t, 100)
    expect(t.x).toBe(before)
  })
})

// ── Blinker ───────────────────────────────────────────────────────────────────

describe('Blinker — initial state', () => {
  it('starts visible (true) by default', () => {
    const b = createBlinker(500)
    expect(b.state).toBe(true)
  })

  it('respects initialState: false', () => {
    const b = createBlinker(500, { initialState: false })
    expect(b.state).toBe(false)
  })

  it('returns initial state before first toggle', () => {
    const b = createBlinker(500)
    expect(tickBlinker(b, 0)).toBe(true)
    expect(tickBlinker(b, 100)).toBe(true)
  })
})

describe('Blinker — toggling', () => {
  it('toggles after intervalMs', () => {
    const b = createBlinker(500)
    expect(tickBlinker(b, 500)).toBe(false)
  })

  it('toggles back after two intervals', () => {
    const b = createBlinker(500)
    tickBlinker(b, 500)
    expect(tickBlinker(b, 500)).toBe(true)
  })

  it('does not toggle before intervalMs', () => {
    const b = createBlinker(500)
    expect(tickBlinker(b, 499)).toBe(true)
  })

  it('handles large dt spanning multiple intervals (even = same state)', () => {
    const b = createBlinker(100)
    expect(tickBlinker(b, 600)).toBe(true)  // 6 toggles → back to true
  })

  it('handles large dt spanning multiple intervals (odd = flipped state)', () => {
    const b = createBlinker(100)
    expect(tickBlinker(b, 500)).toBe(false)  // 5 toggles → false
  })

  it('accumulates elapsed correctly across multiple small ticks', () => {
    const b = createBlinker(500)
    for (let i = 0; i < 5; i++) tickBlinker(b, 100)  // 5 × 100 = 500ms
    expect(b.state).toBe(false)
  })

  it('carries remainder elapsed after toggle', () => {
    const b = createBlinker(500)
    tickBlinker(b, 600)  // toggle at 500, 100ms remainder
    expect(b.elapsed).toBeCloseTo(100)
  })
})
