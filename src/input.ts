export type Direction = 'up' | 'down' | 'left' | 'right'

const DIR_KEYS: Record<string, Direction> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
}

const held = new Set<string>()
let pendingFlag = false
let pendingDebug = false
let pendingPause = false
let pendingAnyKey = false

let repeatDir: Direction | null = null
let repeatTimer = 0
let repeatPhase: 'delay' | 'repeat' | 'idle' = 'idle'
let pendingImmediate: Direction | null = null
let _repeatDelay = 150
let _repeatInterval = 80

export function initInput(repeatDelay = 150, repeatInterval = 80): void {
  _repeatDelay = repeatDelay
  _repeatInterval = repeatInterval

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.repeat) return
    pendingAnyKey = true
    held.add(e.key)

    const dir = DIR_KEYS[e.key]
    if (dir) {
      repeatDir = dir
      repeatPhase = 'delay'
      repeatTimer = _repeatDelay
      pendingImmediate = dir
    }

    if (e.key === 'f' || e.key === 'F') pendingFlag = true
    if (e.key === 'p' || e.key === 'P') pendingPause = true

    if (e.ctrlKey && e.shiftKey && (e.key === 'b' || e.key === 'B')) {
      pendingDebug = true
      e.preventDefault()
    }
  })

  window.addEventListener('keyup', (e: KeyboardEvent) => {
    held.delete(e.key)
    const dir = DIR_KEYS[e.key]
    if (dir && repeatDir === dir) {
      repeatDir = null
      repeatPhase = 'idle'
    }
  })
}

export function tickMovement(dtMs: number): Direction | null {
  if (pendingImmediate !== null) {
    const d = pendingImmediate
    pendingImmediate = null
    return d
  }
  if (repeatDir !== null && repeatPhase !== 'idle') {
    repeatTimer -= dtMs
    if (repeatTimer <= 0) {
      repeatTimer += _repeatInterval
      if (repeatPhase === 'delay') repeatPhase = 'repeat'
      return repeatDir
    }
  }
  return null
}

export function consumeFlag(): boolean   { const v = pendingFlag;   pendingFlag   = false; return v }
export function consumeDebug(): boolean  { const v = pendingDebug;  pendingDebug  = false; return v }
export function consumePause(): boolean  { const v = pendingPause;  pendingPause  = false; return v }
export function consumeAnyKey(): boolean { const v = pendingAnyKey; pendingAnyKey = false; return v }
export function isHeld(key: string): boolean { return held.has(key) }
