import { describe, it, expect } from 'vitest'
import { FONT, getCharRow } from './src/font.js'

// ── FONT array ────────────────────────────────────────────────────────────────

describe('FONT — raw bitmap data', () => {
  it('is a Uint8Array', () => {
    expect(FONT).toBeInstanceOf(Uint8Array)
  })

  it('contains exactly 768 bytes (96 characters × 8 rows)', () => {
    expect(FONT.length).toBe(96 * 8)
  })

  it('space (32) is all zeros', () => {
    for (let row = 0; row < 8; row++) {
      expect(FONT[(32 - 32) * 8 + row]).toBe(0)
    }
  })

  it('solid block (127) is all 0xFF', () => {
    for (let row = 0; row < 8; row++) {
      expect(FONT[(127 - 32) * 8 + row]).toBe(0xFF)
    }
  })
})

// ── getCharRow ────────────────────────────────────────────────────────────────

describe('getCharRow — happy path', () => {
  it('returns 0 for all rows of space (32)', () => {
    for (let row = 0; row < 8; row++) {
      expect(getCharRow(32, row)).toBe(0)
    }
  })

  it('returns 0xFF for all rows of solid block (127)', () => {
    for (let row = 0; row < 8; row++) {
      expect(getCharRow(127, row)).toBe(0xFF)
    }
  })

  it("returns correct bitmap for 'A' (65) row 4 — 0x7E (horizontal bar)", () => {
    expect(getCharRow(65, 4)).toBe(0x7E)
  })

  it("returns correct bitmap for '0' (48) row 1 — 0x3C", () => {
    expect(getCharRow(48, 1)).toBe(0x3C)
  })

  it('returns correct value for row 0 (top)', () => {
    // 'A' row 0 is 0x00 — top row is blank in the ROM font
    expect(getCharRow(65, 0)).toBe(0x00)
  })

  it('returns correct value for row 7 (bottom)', () => {
    // 'A' row 7 is also 0x00 — bottom row blank
    expect(getCharRow(65, 7)).toBe(0x00)
    // solid block row 7 is 0xFF
    expect(getCharRow(127, 7)).toBe(0xFF)
  })

  it('result matches direct FONT array access for a range of chars and rows', () => {
    for (const code of [32, 48, 65, 90, 97, 126, 127]) {
      for (const row of [0, 3, 7]) {
        expect(getCharRow(code, row)).toBe(FONT[(code - 32) * 8 + row])
      }
    }
  })
})

describe('getCharRow — out-of-range inputs return 0', () => {
  it('returns 0 for charCode 31 (one below valid range)', () => {
    expect(getCharRow(31, 0)).toBe(0)
  })

  it('returns 0 for charCode 128 (one above valid range)', () => {
    expect(getCharRow(128, 0)).toBe(0)
  })

  it('returns 0 for negative charCode', () => {
    expect(getCharRow(-1, 0)).toBe(0)
  })

  it('returns 0 for charCode 0', () => {
    expect(getCharRow(0, 0)).toBe(0)
  })

  it('returns 0 for row -1 (below valid range)', () => {
    expect(getCharRow(65, -1)).toBe(0)
  })

  it('returns 0 for row 8 (above valid range)', () => {
    expect(getCharRow(65, 8)).toBe(0)
  })

  it('returns 0 for very large charCode', () => {
    expect(getCharRow(9999, 0)).toBe(0)
  })
})
