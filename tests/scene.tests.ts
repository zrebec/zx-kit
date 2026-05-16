import { describe, it, expect, vi } from 'vitest'
import {
  createSceneManager, pushScene, popScene, replaceScene,
  currentScene, updateScenes, renderScenes,
  type Scene,
} from '../src/scene.js'

// Helper: a scene with no-op default update/render and optional spies.
function makeScene(name: string, opts: Partial<Scene> = {}): Scene {
  return {
    name,
    update: opts.update ?? vi.fn(),
    render: opts.render ?? vi.fn(),
    onEnter: opts.onEnter,
    onExit: opts.onExit,
    onPause: opts.onPause,
    onResume: opts.onResume,
  }
}

// ── createSceneManager ────────────────────────────────────────────────────────

describe('createSceneManager', () => {
  it('starts with an empty stack', () => {
    const m = createSceneManager()
    expect(m.stack).toEqual([])
  })

  it('currentScene returns null when empty', () => {
    const m = createSceneManager()
    expect(currentScene(m)).toBeNull()
  })
})

// ── pushScene ─────────────────────────────────────────────────────────────────

describe('pushScene', () => {
  it('adds scene to stack', () => {
    const m = createSceneManager()
    const s = makeScene('a')
    pushScene(m, s)
    expect(m.stack).toEqual([s])
    expect(currentScene(m)).toBe(s)
  })

  it('calls onEnter on the pushed scene with prev=null when stack was empty', () => {
    const m = createSceneManager()
    const onEnter = vi.fn()
    const s = makeScene('a', { onEnter })
    pushScene(m, s)
    expect(onEnter).toHaveBeenCalledWith(null)
  })

  it('calls onPause on previous top and onEnter on new with prev', () => {
    const m = createSceneManager()
    const onPause = vi.fn()
    const onEnter = vi.fn()
    const a = makeScene('a', { onPause })
    const b = makeScene('b', { onEnter })
    pushScene(m, a)
    pushScene(m, b)
    expect(onPause).toHaveBeenCalledTimes(1)
    expect(onEnter).toHaveBeenCalledWith(a)
  })

  it('preserves stack order — new scene on top', () => {
    const m = createSceneManager()
    const a = makeScene('a')
    const b = makeScene('b')
    pushScene(m, a)
    pushScene(m, b)
    expect(currentScene(m)).toBe(b)
    expect(m.stack[0]).toBe(a)
    expect(m.stack[1]).toBe(b)
  })

  it('calls onPause before onEnter (pause before new scene activates)', () => {
    const m = createSceneManager()
    const calls: string[] = []
    const a = makeScene('a', { onPause: () => calls.push('pause-a') })
    const b = makeScene('b', { onEnter: () => calls.push('enter-b') })
    pushScene(m, a)
    pushScene(m, b)
    expect(calls).toEqual(['pause-a', 'enter-b'])
  })
})

// ── popScene ──────────────────────────────────────────────────────────────────

describe('popScene', () => {
  it('returns null when stack is empty', () => {
    const m = createSceneManager()
    expect(popScene(m)).toBeNull()
  })

  it('removes and returns the top scene', () => {
    const m = createSceneManager()
    const a = makeScene('a')
    pushScene(m, a)
    expect(popScene(m)).toBe(a)
    expect(m.stack).toEqual([])
  })

  it('calls onExit on popped scene with next=null when stack becomes empty', () => {
    const m = createSceneManager()
    const onExit = vi.fn()
    const a = makeScene('a', { onExit })
    pushScene(m, a)
    popScene(m)
    expect(onExit).toHaveBeenCalledWith(null)
  })

  it('calls onExit on top with next + onResume on uncovered scene', () => {
    const m = createSceneManager()
    const onExitB = vi.fn()
    const onResumeA = vi.fn()
    const a = makeScene('a', { onResume: onResumeA })
    const b = makeScene('b', { onExit: onExitB })
    pushScene(m, a)
    pushScene(m, b)
    popScene(m)
    expect(onExitB).toHaveBeenCalledWith(a)
    expect(onResumeA).toHaveBeenCalledTimes(1)
  })

  it('makes the previously-paused scene current again', () => {
    const m = createSceneManager()
    const a = makeScene('a')
    const b = makeScene('b')
    pushScene(m, a)
    pushScene(m, b)
    popScene(m)
    expect(currentScene(m)).toBe(a)
  })

  it('calls onExit before onResume (exit old before resuming below)', () => {
    const m = createSceneManager()
    const calls: string[] = []
    const a = makeScene('a', { onResume: () => calls.push('resume-a') })
    const b = makeScene('b', { onExit: () => calls.push('exit-b') })
    pushScene(m, a)
    pushScene(m, b)
    popScene(m)
    expect(calls).toEqual(['exit-b', 'resume-a'])
  })
})

// ── replaceScene ──────────────────────────────────────────────────────────────

describe('replaceScene', () => {
  it('swaps top scene without affecting scenes beneath', () => {
    const m = createSceneManager()
    const a = makeScene('a')
    const b = makeScene('b')
    const c = makeScene('c')
    pushScene(m, a)
    pushScene(m, b)
    replaceScene(m, c)
    expect(m.stack).toEqual([a, c])
    expect(currentScene(m)).toBe(c)
  })

  it('calls onExit on outgoing top with next=incoming', () => {
    const m = createSceneManager()
    const onExitA = vi.fn()
    const a = makeScene('a', { onExit: onExitA })
    const b = makeScene('b')
    pushScene(m, a)
    replaceScene(m, b)
    expect(onExitA).toHaveBeenCalledWith(b)
  })

  it('calls onEnter on incoming with prev=outgoing top', () => {
    const m = createSceneManager()
    const onEnterB = vi.fn()
    const a = makeScene('a')
    const b = makeScene('b', { onEnter: onEnterB })
    pushScene(m, a)
    replaceScene(m, b)
    expect(onEnterB).toHaveBeenCalledWith(a)
  })

  it('on empty manager behaves like pushScene', () => {
    const m = createSceneManager()
    const onEnter = vi.fn()
    const s = makeScene('a', { onEnter })
    replaceScene(m, s)
    expect(m.stack).toEqual([s])
    expect(onEnter).toHaveBeenCalledWith(null)
  })

  it('does NOT call onPause/onResume on the scene below', () => {
    const m = createSceneManager()
    const onPauseA = vi.fn()
    const onResumeA = vi.fn()
    const a = makeScene('a', { onPause: onPauseA, onResume: onResumeA })
    const b = makeScene('b')
    const c = makeScene('c')
    pushScene(m, a)
    pushScene(m, b)
    onPauseA.mockClear()
    onResumeA.mockClear()
    replaceScene(m, c)
    expect(onPauseA).not.toHaveBeenCalled()
    expect(onResumeA).not.toHaveBeenCalled()
  })
})

// ── updateScenes ──────────────────────────────────────────────────────────────

describe('updateScenes', () => {
  it('does nothing when stack is empty', () => {
    const m = createSceneManager()
    expect(() => updateScenes(m, 16)).not.toThrow()
  })

  it('updates only the top scene', () => {
    const m = createSceneManager()
    const updateA = vi.fn()
    const updateB = vi.fn()
    const a = makeScene('a', { update: updateA })
    const b = makeScene('b', { update: updateB })
    pushScene(m, a)
    pushScene(m, b)
    updateScenes(m, 16)
    expect(updateA).not.toHaveBeenCalled()
    expect(updateB).toHaveBeenCalledWith(16)
  })

  it('passes dt through to top scene', () => {
    const m = createSceneManager()
    const update = vi.fn()
    pushScene(m, makeScene('a', { update }))
    updateScenes(m, 33.5)
    expect(update).toHaveBeenCalledWith(33.5)
  })
})

// ── renderScenes ──────────────────────────────────────────────────────────────

describe('renderScenes', () => {
  it('does nothing when stack is empty', () => {
    const m = createSceneManager()
    const ctx = {} as CanvasRenderingContext2D
    expect(() => renderScenes(m, ctx)).not.toThrow()
  })

  it('renders all scenes bottom-up (paused beneath, active on top)', () => {
    const m = createSceneManager()
    const calls: string[] = []
    const a = makeScene('a', { render: () => { calls.push('a') } })
    const b = makeScene('b', { render: () => { calls.push('b') } })
    pushScene(m, a)
    pushScene(m, b)
    renderScenes(m, {} as CanvasRenderingContext2D)
    expect(calls).toEqual(['a', 'b'])
  })

  it('passes ctx to each scene', () => {
    const m = createSceneManager()
    const renderA = vi.fn()
    const ctx = { sentinel: true } as unknown as CanvasRenderingContext2D
    pushScene(m, makeScene('a', { render: renderA }))
    renderScenes(m, ctx)
    expect(renderA).toHaveBeenCalledWith(ctx)
  })
})
