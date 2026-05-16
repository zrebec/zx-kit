import { describe, it, expect } from 'vitest'
import { SCALE, CELL, C } from '../src/palette.js'
import type { SpectrumColor } from '../src/palette.js'

// ── SCALE ─────────────────────────────────────────────────────────────────────

describe('SCALE', () => {
  it('is 4 (1 game pixel = 4 CSS pixels)', () => {
    expect(SCALE).toBe(4)
  })
})

// ── CELL ──────────────────────────────────────────────────────────────────────

describe('CELL', () => {
  it('is 8 (sprite / character grid size)', () => {
    expect(CELL).toBe(8)
  })
})

// ── C — structure ─────────────────────────────────────────────────────────────

describe('C — keys and count', () => {
  it('has exactly 16 color keys', () => {
    expect(Object.keys(C)).toHaveLength(16)
  })

  it('contains all 8 normal and 8 bright (B_) variants', () => {
    const base = ['BLACK', 'BLUE', 'RED', 'MAGENTA', 'GREEN', 'CYAN', 'YELLOW', 'WHITE']
    for (const k of base) {
      expect(C).toHaveProperty(k)
      expect(C).toHaveProperty(`B_${k}`)
    }
  })

  it('every value matches #RRGGBB format', () => {
    for (const v of Object.values(C)) {
      expect(v).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})

// ── C — exact palette values ───────────────────────────────────────────────────

describe('C — exact ZX Spectrum colour values', () => {
  it('BLACK   = #000000', () => { expect(C.BLACK).toBe('#000000') })
  it('BLUE    = #0000CD', () => { expect(C.BLUE).toBe('#0000CD') })
  it('RED     = #CD0000', () => { expect(C.RED).toBe('#CD0000') })
  it('MAGENTA = #CD00CD', () => { expect(C.MAGENTA).toBe('#CD00CD') })
  it('GREEN   = #00CD00', () => { expect(C.GREEN).toBe('#00CD00') })
  it('CYAN    = #00CDCD', () => { expect(C.CYAN).toBe('#00CDCD') })
  it('YELLOW  = #CDCD00', () => { expect(C.YELLOW).toBe('#CDCD00') })
  it('WHITE   = #CDCDCD  (dim white)', () => { expect(C.WHITE).toBe('#CDCDCD') })

  it('B_BLACK   = #000000  (same as BLACK)', () => { expect(C.B_BLACK).toBe(C.BLACK) })
  it('B_BLUE    = #0000FF', () => { expect(C.B_BLUE).toBe('#0000FF') })
  it('B_RED     = #FF0000', () => { expect(C.B_RED).toBe('#FF0000') })
  it('B_MAGENTA = #FF00FF', () => { expect(C.B_MAGENTA).toBe('#FF00FF') })
  it('B_GREEN   = #00FF00', () => { expect(C.B_GREEN).toBe('#00FF00') })
  it('B_CYAN    = #00FFFF', () => { expect(C.B_CYAN).toBe('#00FFFF') })
  it('B_YELLOW  = #FFFF00', () => { expect(C.B_YELLOW).toBe('#FFFF00') })
  it('B_WHITE   = #FFFFFF  (full white)', () => { expect(C.B_WHITE).toBe('#FFFFFF') })
})

// ── SpectrumColor type ─────────────────────────────────────────────────────────

describe('SpectrumColor', () => {
  it('is satisfied by any C value at compile time (runtime truism)', () => {
    const color: SpectrumColor = C.B_CYAN
    expect(color).toBe('#00FFFF')
  })
})
