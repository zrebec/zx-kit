/** CSS pixel scale factor: 1 game pixel = 4 CSS pixels. */
export const SCALE = 4

/** Sprite and character grid size in game pixels (8×8 cell). */
export const CELL = 8

/**
 * ZX Spectrum palette — exactly 15 colours as `#RRGGBB` hex strings.
 * Normal brightness: `BLACK` … `WHITE`. Bright variants: `B_BLACK` … `B_WHITE` (prefix `B_`).
 * **Never use any other hex values** — all game graphics must stay within this palette.
 *
 * @example
 * ctx.fillStyle = C.B_CYAN
 * ctx.fillRect(x, y, CELL, CELL)
 */
export const C = {
  BLACK:     '#000000',
  BLUE:      '#0000CD',
  RED:       '#CD0000',
  MAGENTA:   '#CD00CD',
  GREEN:     '#00CD00',
  CYAN:      '#00CDCD',
  YELLOW:    '#CDCD00',
  WHITE:     '#CDCDCD',
  B_BLACK:   '#000000',
  B_BLUE:    '#0000FF',
  B_RED:     '#FF0000',
  B_MAGENTA: '#FF00FF',
  B_GREEN:   '#00FF00',
  B_CYAN:    '#00FFFF',
  B_YELLOW:  '#FFFF00',
  B_WHITE:   '#FFFFFF',
} as const

/**
 * Union of every hex value in the Spectrum palette (`typeof C[keyof typeof C]`).
 * Use as the parameter type for `ink` / `paper` in your own drawing helpers
 * to get compile-time palette enforcement.
 *
 * @example
 * function highlight(ink: SpectrumColor) { ... }
 */
export type SpectrumColor = typeof C[keyof typeof C]
