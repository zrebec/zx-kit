import { C, CELL } from './palette.js'
import { getCharRow } from './font.js'

// Flip an 8×8 sprite horizontally
export function mirrorSprite(src: Uint8Array): Uint8Array {
  const out = new Uint8Array(8)
  for (let r = 0; r < 8; r++) {
    let b = src[r], m = 0
    for (let i = 0; i < 8; i++) {
      if (b & (1 << i)) m |= (1 << (7 - i))
    }
    out[r] = m
  }
  return out
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Uint8Array,
  x: number, y: number,
  ink: string, paper: string,
): void {
  ctx.fillStyle = paper
  ctx.fillRect(x, y, CELL, CELL)
  ctx.fillStyle = ink
  for (let row = 0; row < 8; row++) {
    const byte = sprite[row]
    for (let bit = 0; bit < 8; bit++) {
      if (byte & (0x80 >> bit)) ctx.fillRect(x + bit, y + row, 1, 1)
    }
  }
}

export function drawChar(
  ctx: CanvasRenderingContext2D,
  code: number,
  x: number, y: number,
  ink: string, paper?: string,
): void {
  if (paper !== undefined) {
    ctx.fillStyle = paper
    ctx.fillRect(x, y, CELL, CELL)
  }
  ctx.fillStyle = ink
  for (let row = 0; row < 8; row++) {
    const byte = getCharRow(code, row)
    for (let bit = 0; bit < 8; bit++) {
      if (byte & (0x80 >> bit)) ctx.fillRect(x + bit, y + row, 1, 1)
    }
  }
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  ink: string, paper?: string,
): void {
  for (let i = 0; i < text.length; i++) {
    drawChar(ctx, text.charCodeAt(i), x + i * CELL, y, ink, paper)
  }
}

/**
 * Flash document.body background between `color` and `resetColor`.
 * Fire-and-forget — does not block.
 *
 * @example
 * flashBorder(C.B_RED, 3, 150)           // explosion — 3 red flashes
 * flashBorder(C.B_GREEN, 2, 200)         // level complete
 * flashBorder(C.B_CYAN, 2, 120, C.BLUE)  // reset to blue border
 */
export function flashBorder(
  color: string,
  times: number,
  intervalMs: number,
  resetColor: string = C.BLACK,
): void {
  let step = 0
  const totalSteps = times * 2
  const id = setInterval(() => {
    document.body.style.backgroundColor = step % 2 === 0 ? color : resetColor
    step++
    if (step >= totalSteps) {
      clearInterval(id)
      document.body.style.backgroundColor = resetColor
    }
  }, intervalMs)
}

// cols = total character columns of the canvas (e.g. 32 for standard Spectrum)
export function drawTextCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  cols: number,
  ink: string, paper?: string,
): void {
  const x = Math.floor((cols - text.length) / 2) * CELL
  drawText(ctx, text, x, y, ink, paper)
}
