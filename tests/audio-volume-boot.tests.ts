import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { drawVolumeBar } from '../src/audio.js'

// A file of its own, and that is the whole point.
//
// `_volumeChangedAt` is module state, so any test that calls increaseVolume() or
// decreaseVolume() stamps it for good. The question here — *has the bar ever been
// asked to show?* — can only be answered by a module registry where nothing has
// touched the volume yet, and vitest gives each test file one of those.
//
// The bug this pins: the field was initialised to `0`, and `performance.now()`
// counts from page load, so "changed at 0" is a change 0 ms into the page's life.
// Every game drew the volume bar over its own first 1.5 seconds — a control the
// player never touched, on a title screen, in a game that had not yet made a
// sound. It showed up as a green rectangle across a loading screen in Minefield.

type FillCall = { x: number; y: number; w: number; h: number }

function makeMockCtx(canvasWidth = 1024, scale = 4) {
  const rects: FillCall[] = []
  return {
    fillStyle: '',
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h })
    },
    getTransform: () => ({ a: scale }),
    canvas: { width: canvasWidth, height: (canvasWidth / 4) * 3 },
    _rects: rects,
  } as unknown as CanvasRenderingContext2D & { _rects: FillCall[] }
}

describe('audio — the volume bar before any volume change', () => {
  let nowSpy: ReturnType<typeof vi.spyOn>

  beforeAll(() => {
    nowSpy = vi.spyOn(performance, 'now')
  })

  afterAll(() => {
    nowSpy.mockRestore()
  })

  it('draws nothing on the first frame of a fresh page', () => {
    nowSpy.mockReturnValue(0)
    const ctx = makeMockCtx()
    drawVolumeBar(ctx)
    expect(ctx._rects).toHaveLength(0)
  })

  it('draws nothing anywhere inside the window a zero stamp would have opened', () => {
    // 1499 ms is the last millisecond the old `0` initialiser would still have
    // been drawing. This is the assertion that actually fails without the fix.
    for (const t of [1, 250, 800, 1499]) {
      nowSpy.mockReturnValue(t)
      const ctx = makeMockCtx()
      drawVolumeBar(ctx)
      expect(ctx._rects, `at ${t} ms after load`).toHaveLength(0)
    }
  })

  it('stays quiet on a long-lived page, where a finite stamp would eventually pass', () => {
    // -Infinity is the only value that means *never* rather than "very early":
    // a large negative number is still a finite time that `performance.now()`
    // walks away from, and this is a game a player may leave open for hours.
    nowSpy.mockReturnValue(6 * 60 * 60 * 1000)
    const ctx = makeMockCtx()
    drawVolumeBar(ctx)
    expect(ctx._rects).toHaveLength(0)
  })
})
