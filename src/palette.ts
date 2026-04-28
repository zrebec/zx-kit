export const SCALE = 4
export const CELL = 8

// ZX Spectrum palette — exactly 15 colours, EXCLUSIVELY these hex values
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

export type SpectrumColor = typeof C[keyof typeof C]
