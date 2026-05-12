// ── Scene: stack-based scene manager with onEnter/onExit/onPause/onResume ───

/**
 * A single screen / game state — intro, gameplay, pause overlay, game over, etc.
 *
 * `update` is called on the **top** scene only (so pushing a pause scene freezes
 * everything beneath). `render` is called on **all** scenes bottom-up, so a paused
 * underlying scene remains visible behind a translucent overlay.
 *
 * **Lifecycle hooks (all optional):**
 * - `onEnter(prev)` — the scene becomes top of the stack (push / replace / initial)
 * - `onExit(next)`  — the scene is removed (pop / replace); `next` is what becomes top
 * - `onPause()`     — another scene is pushed on top of this one
 * - `onResume()`    — the scene above this one is popped, this becomes top again
 *
 * Manage scenes via {@link createSceneManager}, {@link pushScene}, {@link popScene}, {@link replaceScene}.
 */
export interface Scene {
  /** Human-readable identifier, useful for logging and debugging. */
  name: string
  /** Called once per frame on the top scene only. */
  update(dt: number): void
  /** Called once per frame on all scenes, bottom-up. */
  render(ctx: CanvasRenderingContext2D): void
  /** Optional: fired when this scene becomes the top of the stack. `prev` is the previously-top scene, or `null` if the stack was empty. */
  onEnter?(prev: Scene | null): void
  /** Optional: fired when this scene is removed. `next` is the scene that becomes top (or `null` if the stack becomes empty). */
  onExit?(next: Scene | null): void
  /** Optional: fired when another scene is pushed on top of this one. */
  onPause?(): void
  /** Optional: fired when the scene above this one is popped, restoring this scene to top. */
  onResume?(): void
}

/**
 * Holds the scene stack. Mutated by `pushScene`, `popScene`, `replaceScene`.
 * Create via {@link createSceneManager}.
 */
export interface SceneManager {
  /** Bottom-up scene stack. `stack[stack.length - 1]` is the current top. */
  stack: Scene[]
}

/**
 * Creates an empty SceneManager.
 *
 * @example
 * const mgr = createSceneManager()
 * pushScene(mgr, introScene)
 *
 * // In game loop:
 * updateScenes(mgr, dt)
 * renderScenes(mgr, ctx)
 */
export function createSceneManager(): SceneManager {
  return { stack: [] }
}

/**
 * Returns the top scene, or `null` if the stack is empty.
 */
export function currentScene(mgr: SceneManager): Scene | null {
  return mgr.stack.length === 0 ? null : mgr.stack[mgr.stack.length - 1]
}

/**
 * Pushes a scene onto the stack. Fires `onPause` on the previous top (if any),
 * then `onEnter(prev)` on the new scene.
 *
 * @example
 * pushScene(mgr, pauseOverlayScene)   // freezes underlying game, draws on top
 */
export function pushScene(mgr: SceneManager, scene: Scene): void {
  const prev = currentScene(mgr)
  if (prev) prev.onPause?.()
  mgr.stack.push(scene)
  scene.onEnter?.(prev)
}

/**
 * Pops the top scene and returns it (or `null` if the stack was empty).
 * Fires `onExit(below)` on the popped scene, then `onResume` on the uncovered scene below (if any).
 */
export function popScene(mgr: SceneManager): Scene | null {
  if (mgr.stack.length === 0) return null
  const top = mgr.stack.pop()!
  const below = currentScene(mgr)
  top.onExit?.(below)
  if (below) below.onResume?.()
  return top
}

/**
 * Replaces the top scene with a new one without affecting scenes beneath.
 * Fires `onExit(incoming)` on the outgoing top, then `onEnter(outgoing)` on the incoming scene.
 * **Does not** fire `onPause` / `onResume` on any scene below — they were never paused by this call.
 *
 * On an empty manager, behaves like `pushScene` (outgoing is `null`).
 *
 * @example
 * replaceScene(mgr, gameOverScene)   // swap gameplay → game over, leave intro on bottom
 */
export function replaceScene(mgr: SceneManager, scene: Scene): void {
  const outgoing = mgr.stack.length > 0 ? mgr.stack.pop()! : null
  outgoing?.onExit?.(scene)
  mgr.stack.push(scene)
  scene.onEnter?.(outgoing)
}

/**
 * Updates the top scene only. No-op on an empty manager.
 * Scenes beneath the top remain frozen — this is what makes pause overlays work.
 */
export function updateScenes(mgr: SceneManager, dt: number): void {
  const top = currentScene(mgr)
  if (top) top.update(dt)
}

/**
 * Renders every scene from bottom to top. No-op on an empty manager.
 * Bottom-up order means a paused scene stays visible behind a translucent overlay.
 */
export function renderScenes(mgr: SceneManager, ctx: CanvasRenderingContext2D): void {
  for (const scene of mgr.stack) scene.render(ctx)
}
