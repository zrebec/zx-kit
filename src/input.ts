/** Movement direction returned by `tickMovement`. */
export type Direction = 'up' | 'down' | 'left' | 'right'

const DIR_KEYS: Record<string, Direction> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
}

const ARROW_KEYS: Record<Direction, string> = {
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
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
let inputInitialized = false

// ── Gamepad state ──────────────────────────────────────────────────────────────

const STICK_DEAD = 0.35

let padPrevDir: Direction | null = null
let padPrevBtnFlag  = false
let padPrevBtnPause = false
let padPrevBtnDebug = false
let padPrevAny      = false

function pollGamepad(): void {
  if (typeof navigator === 'undefined') return
  const pads = navigator.getGamepads?.()
  if (!pads) return

  for (const pad of pads) {
    if (!pad?.connected) continue

    // D-pad (standard mapping: buttons 12-15) takes priority over analog stick
    let dir: Direction | null = null
    if      (pad.buttons[12]?.pressed) dir = 'up'
    else if (pad.buttons[13]?.pressed) dir = 'down'
    else if (pad.buttons[14]?.pressed) dir = 'left'
    else if (pad.buttons[15]?.pressed) dir = 'right'

    // Left analog stick with deadzone — dominant axis wins
    if (dir === null) {
      const ax = pad.axes[0] ?? 0
      const ay = pad.axes[1] ?? 0
      if (Math.abs(ax) > STICK_DEAD || Math.abs(ay) > STICK_DEAD) {
        if (Math.abs(ax) >= Math.abs(ay)) dir = ax < 0 ? 'left' : 'right'
        else                              dir = ay < 0 ? 'up'   : 'down'
      }
    }

    // Synthesize direction changes into the existing keyboard repeat state machine
    if (dir !== padPrevDir) {
      if (padPrevDir !== null && repeatDir === padPrevDir && !held.has(ARROW_KEYS[padPrevDir])) {
        repeatDir   = null
        repeatPhase = 'idle'
      }
      if (dir !== null) {
        pendingImmediate = dir
        repeatDir        = dir
        repeatPhase      = 'delay'
        repeatTimer      = _repeatDelay
      }
    }
    padPrevDir = dir

    // Action buttons — rising-edge detection (A=flag, Start=pause, Y=debug)
    const btnFlag  = !!(pad.buttons[0]?.pressed)
    const btnPause = !!(pad.buttons[9]?.pressed)
    const btnDebug = !!(pad.buttons[3]?.pressed)
    const btnAny   = pad.buttons.some(b => b?.pressed)

    if (btnFlag  && !padPrevBtnFlag)  pendingFlag   = true
    if (btnPause && !padPrevBtnPause) pendingPause  = true
    if (btnDebug && !padPrevBtnDebug) pendingDebug  = true
    if (btnAny   && !padPrevAny)      pendingAnyKey = true

    padPrevBtnFlag  = btnFlag
    padPrevBtnPause = btnPause
    padPrevBtnDebug = btnDebug
    padPrevAny      = btnAny
    return  // first connected gamepad only
  }

  // No gamepad connected — release any direction that came from a pad
  if (padPrevDir !== null) {
    if (repeatDir === padPrevDir && !held.has(ARROW_KEYS[padPrevDir])) {
      repeatDir   = null
      repeatPhase = 'idle'
    }
    padPrevDir = null
  }
}

/**
 * Attaches global `keydown`/`keyup` listeners and configures key-repeat timing.
 * Idempotent — safe to call multiple times. Timing params are always updated;
 * listeners are only attached on the first call.
 * Arrow keys drive movement; `F`/`f` = flag; `P`/`p` = pause; `Ctrl+Shift+B` = debug toggle.
 * Gamepad support is automatic — `tickMovement` polls the Gamepad API each frame.
 * D-pad and left analog stick map to directions; A = flag, Start = pause, Y = debug.
 *
 * @param repeatDelay    - Milliseconds before auto-repeat starts after initial press (default `150`)
 * @param repeatInterval - Milliseconds between repeat ticks while key is held (default `80`)
 *
 * @example
 * initInput()         // defaults: 150ms delay, 80ms repeat
 * initInput(200, 60)  // custom timing; safe to call again to reconfigure
 */
export function initInput(repeatDelay = 150, repeatInterval = 80): void {
  _repeatDelay = repeatDelay
  _repeatInterval = repeatInterval
  if (inputInitialized) return
  inputInitialized = true

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

/**
 * Advances the key-repeat timer and returns the movement direction for this frame.
 * Call once per frame with the frame delta in milliseconds.
 * Returns a direction immediately on first press; repeats every `repeatInterval` ms while held.
 * Returns `null` when no movement should occur this frame.
 *
 * @param dtMs - Frame delta in milliseconds
 *
 * @example
 * function gameLoop(dt: number) {
 *   const dir = tickMovement(dt)
 *   if (dir) movePlayer(dir)
 * }
 */
export function tickMovement(dtMs: number): Direction | null {
  pollGamepad()
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

/** Consumes and returns the `F` key flag event (flag/unflag a cell). Resets to `false` after read. */
export function consumeFlag(): boolean   { const v = pendingFlag;   pendingFlag   = false; return v }

/** Consumes and returns the `Ctrl+Shift+B` debug toggle event. Resets to `false` after read. */
export function consumeDebug(): boolean  { const v = pendingDebug;  pendingDebug  = false; return v }

/** Consumes and returns the `P` key pause event. Resets to `false` after read. */
export function consumePause(): boolean  { const v = pendingPause;  pendingPause  = false; return v }

/**
 * Consumes and returns `true` if any key was pressed since the last call.
 * Use to dismiss intro screens or game-over overlays.
 */
export function consumeAnyKey(): boolean { const v = pendingAnyKey; pendingAnyKey = false; return v }

/**
 * Returns `true` if the given key is currently held down.
 *
 * @param key - `KeyboardEvent.key` string (e.g. `'ArrowUp'`, `' '`, `'Enter'`)
 *
 * @example
 * if (isHeld('ArrowUp')) { ... }
 */
export function isHeld(key: string): boolean { return held.has(key) }

/**
 * Clears all pending key state immediately.
 * Call when entering a new game phase (e.g. after game-over or menu transition)
 * to prevent stale inputs from carrying over.
 *
 * @example
 * appPhase = 'gameover'
 * resetInput()  // discard any queued keypresses from the previous phase
 */
export function resetInput(): void {
  held.clear()
  pendingFlag   = false
  pendingDebug  = false
  pendingPause  = false
  pendingAnyKey = false
  repeatDir     = null
  repeatPhase   = 'idle'
  pendingImmediate = null
  padPrevDir      = null
  padPrevBtnFlag  = false
  padPrevBtnPause = false
  padPrevBtnDebug = false
  padPrevAny      = false
}
