import { CELL } from './palette.ts'
import { getCharRow } from './font.ts'

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
