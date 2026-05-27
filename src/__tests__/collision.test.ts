/**
 * Pixel-perfect collision — visual ground truth test.
 *
 * Two bitmaps: 8×8 px each, but only a 2×2 px region is lit
 * (rows 0–1, cols 0–1). The effective sprite shape is 2×2 — a size that
 * is intentionally NOT a multiple of the ZX tile size (8 px).
 *
 *   col: 01234567
 *   row 0: ██......   (0xC0)
 *   row 1: ██......   (0xC0)
 *   rows 2–7: empty
 *
 * Ground truth: a brute-force Set-of-pixel-coords intersection.
 * Both sprites are projected to absolute (x,y) coordinates, all lit pixels
 * are collected into a flat Set, and any shared coordinate counts as overlap.
 * No formulas, no assumptions — just "which pixels are painted and do any
 * coordinates match?"
 *
 * Every assertion compares masksOverlap against this ground truth, sweeping
 * sprite B toward sprite A one pixel at a time in all four directions and
 * diagonally. A separate block shows that AABB (8×8 bounding-box) fires
 * 6 pixels earlier than pixel-perfect — the gap the ground truth exposes.
 */

import { describe, it, expect } from 'vitest'
import { bitmapPixelMask, masksOverlap, rectsOverlap, type PixelMask } from '../collision.ts'
import { createBitmap } from '../renderer.ts'

// ── Fixture ───────────────────────────────────────────────────────────────────
// width=8 (minimum for Bitmap: 1 byte per row). height=8.
// Lit region: rows 0–1, cols 0–1. All other bytes 0x00.

const BMP = createBitmap(
  new Uint8Array([
    0xC0,                           // row 0: bits 7,6 set → cols 0,1
    0xC0,                           // row 1: bits 7,6 set → cols 0,1
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // rows 2–7: empty
  ]),
  8, 8,
)

const MASK = bitmapPixelMask(BMP)

// ── Brute-force ground truth ──────────────────────────────────────────────────
// Project every lit pixel of a mask to world (x,y). Put them in a Set.
// Check if any pixel of B appears in the Set of A. Completely explicit —
// no clever algorithm, just coordinate comparison.

function litPixels(mask: PixelMask, ox: number, oy: number): Set<string> {
  const s = new Set<string>()
  for (let row = 0; row < mask.height; row++) {
    for (const col of mask.rows[row]!) {
      s.add(`${ox + col},${oy + row}`)
    }
  }
  return s
}

function bruteForce(
  maskA: PixelMask, ax: number, ay: number,
  maskB: PixelMask, bx: number, by: number,
): boolean {
  const setA = litPixels(maskA, ax, ay)
  for (let row = 0; row < maskB.height; row++) {
    for (const col of maskB.rows[row]!) {
      if (setA.has(`${bx + col},${by + row}`)) return true
    }
  }
  return false
}

// ─────────────────────────────────────────────────────────────────────────────

describe('masksOverlap — 2×2 lit region, visual ground truth', () => {

  // ── Sanity-check the mask ─────────────────────────────────────────────────

  describe('mask shape', () => {
    it('has exactly 4 lit pixels (the 2×2 region)', () => {
      expect(MASK.totalPixels).toBe(4)
    })

    it('rows 0–1 contain columns [0, 1]; rows 2–7 are empty', () => {
      expect(MASK.rows[0]).toEqual([0, 1])
      expect(MASK.rows[1]).toEqual([0, 1])
      for (let r = 2; r < MASK.height; r++) {
        expect(MASK.rows[r]).toEqual([])
      }
    })
  })

  // ── Horizontal sweep ──────────────────────────────────────────────────────
  // A is fixed at (20,20). B sweeps from right (x=30) to left (x=17), same y.
  // A's lit pixels: x∈[20,21], y∈[20,21].
  // First contact: bx=21 — B column 0 (x=21) meets A column 1 (x=21).
  // AABB first contact: bx=27 — 8×8 boxes share one column.  Gap = 6 px.

  describe('horizontal sweep: B approaches A from the right', () => {
    const AX = 20, AY = 20

    it('masksOverlap matches brute-force at every pixel step', () => {
      for (let bx = AX + 10; bx >= AX - 3; bx--) {
        const expected = bruteForce(MASK, AX, AY, MASK, bx, AY)
        const actual   = masksOverlap(MASK, AX, AY, MASK, bx, AY) > 0
        if (actual !== expected) {
          throw new Error(
            `bx=${bx}: masksOverlap=${actual} but brute-force says ${expected}`,
          )
        }
      }
    })

    it('no collision at bx = AX+2 — 1-pixel gap between lit edges', () => {
      // A's rightmost lit column is AX+1=21. B's leftmost at bx=AX+2=22. Gap 1 px.
      expect(masksOverlap(MASK, AX, AY, MASK, AX + 2, AY)).toBe(0)
      expect(bruteForce(MASK, AX, AY, MASK, AX + 2, AY)).toBe(false)
    })

    it('collision fires at bx = AX+1 — lit edges share column AX+1', () => {
      expect(masksOverlap(MASK, AX, AY, MASK, AX + 1, AY)).toBeGreaterThan(0)
      expect(bruteForce(MASK, AX, AY, MASK, AX + 1, AY)).toBe(true)
    })

    it('AABB (8×8 box) fires 6 pixels before pixel-perfect', () => {
      const boxA = { x: AX, y: AY, w: 8, h: 8 }

      // AABB says: first overlap at bx=AX+7 (right edge of A box = left edge of B box)
      expect(rectsOverlap(boxA, { x: AX + 8, y: AY, w: 8, h: 8 })).toBe(false)
      expect(rectsOverlap(boxA, { x: AX + 7, y: AY, w: 8, h: 8 })).toBe(true)

      // Pixel-perfect: no lit pixels near each other at bx=AX+7 — false positive
      expect(masksOverlap(MASK, AX, AY, MASK, AX + 7, AY)).toBe(0)
      expect(bruteForce(MASK, AX, AY, MASK, AX + 7, AY)).toBe(false)
    })
  })

  // ── Vertical sweep ────────────────────────────────────────────────────────
  // A fixed at (20,20). B sweeps from below (y=30) upward (y=17), same x.
  // First contact: by=21 — B row 0 (y=21) meets A row 1 (y=21).
  // AABB first contact: by=27.  Gap = 6 px.

  describe('vertical sweep: B approaches A from below', () => {
    const AX = 20, AY = 20

    it('masksOverlap matches brute-force at every pixel step', () => {
      for (let by = AY + 10; by >= AY - 3; by--) {
        const expected = bruteForce(MASK, AX, AY, MASK, AX, by)
        const actual   = masksOverlap(MASK, AX, AY, MASK, AX, by) > 0
        if (actual !== expected) {
          throw new Error(
            `by=${by}: masksOverlap=${actual} but brute-force says ${expected}`,
          )
        }
      }
    })

    it('no collision at by = AY+2 — 1-pixel gap between lit rows', () => {
      expect(masksOverlap(MASK, AX, AY, MASK, AX, AY + 2)).toBe(0)
      expect(bruteForce(MASK, AX, AY, MASK, AX, AY + 2)).toBe(false)
    })

    it('collision fires at by = AY+1 — lit rows share row AY+1', () => {
      expect(masksOverlap(MASK, AX, AY, MASK, AX, AY + 1)).toBeGreaterThan(0)
      expect(bruteForce(MASK, AX, AY, MASK, AX, AY + 1)).toBe(true)
    })

    it('AABB fires 6 pixels before pixel-perfect', () => {
      const boxA = { x: AX, y: AY, w: 8, h: 8 }
      expect(rectsOverlap(boxA, { x: AX, y: AY + 8, w: 8, h: 8 })).toBe(false)
      expect(rectsOverlap(boxA, { x: AX, y: AY + 7, w: 8, h: 8 })).toBe(true)
      expect(masksOverlap(MASK, AX, AY, MASK, AX, AY + 7)).toBe(0)
      expect(bruteForce(MASK, AX, AY, MASK, AX, AY + 7)).toBe(false)
    })
  })

  // ── Diagonal sweep ────────────────────────────────────────────────────────
  // A fixed at (20,20). B sweeps along the main diagonal: bx=by=AX+d, d=10→-3.
  // First contact: d=1 — corner pixel (AX+1, AY+1) is shared by both sprites.
  // At d=2: B's nearest pixel is (AX+2, AY+2) — corner of A is (AX+1, AY+1). Gap.

  describe('diagonal sweep: B approaches A from bottom-right', () => {
    const AX = 20, AY = 20

    it('masksOverlap matches brute-force at every diagonal step', () => {
      for (let d = 10; d >= -3; d--) {
        const bx = AX + d, by = AY + d
        const expected = bruteForce(MASK, AX, AY, MASK, bx, by)
        const actual   = masksOverlap(MASK, AX, AY, MASK, bx, by) > 0
        if (actual !== expected) {
          throw new Error(
            `d=${d} (bx=${bx}, by=${by}): masksOverlap=${actual} but brute-force says ${expected}`,
          )
        }
      }
    })

    it('no collision at d=2 — corner pixels are 1 diagonal step apart', () => {
      expect(masksOverlap(MASK, AX, AY, MASK, AX + 2, AY + 2)).toBe(0)
      expect(bruteForce(MASK, AX, AY, MASK, AX + 2, AY + 2)).toBe(false)
    })

    it('collision fires at d=1 — single corner pixel (AX+1, AY+1) coincides', () => {
      expect(masksOverlap(MASK, AX, AY, MASK, AX + 1, AY + 1)).toBeGreaterThan(0)
      expect(bruteForce(MASK, AX, AY, MASK, AX + 1, AY + 1)).toBe(true)
    })
  })

  // ── Overlap count ─────────────────────────────────────────────────────────
  // masksOverlap returns a count, not just a boolean. Verify it grows as the
  // sprites move deeper into each other.

  describe('overlap pixel count increases with penetration depth', () => {
    const AX = 20, AY = 20

    it('1 overlapping pixel at first horizontal contact (bx = AX+1)', () => {
      // Only column AX+1 is shared (both rows): 2 pixels
      expect(masksOverlap(MASK, AX, AY, MASK, AX + 1, AY)).toBe(2)
    })

    it('4 overlapping pixels when fully aligned (bx = AX)', () => {
      // Complete overlap of the 2×2 regions
      expect(masksOverlap(MASK, AX, AY, MASK, AX, AY)).toBe(4)
    })

    it('single corner pixel at diagonal first contact (d=1)', () => {
      // Only (AX+1, AY+1) is shared
      expect(masksOverlap(MASK, AX, AY, MASK, AX + 1, AY + 1)).toBe(1)
    })
  })

  // ── Symmetry ──────────────────────────────────────────────────────────────
  // masksOverlap(A, B) must equal masksOverlap(B, A) — no directional bias.

  describe('symmetry: collision count is order-independent', () => {
    it('A→B count equals B→A count for all horizontal positions', () => {
      const AX = 20, AY = 20
      for (let bx = AX + 5; bx >= AX - 3; bx--) {
        const ab = masksOverlap(MASK, AX, AY, MASK, bx, AY)
        const ba = masksOverlap(MASK, bx, AY, MASK, AX, AY)
        if (ab !== ba) {
          throw new Error(`Asymmetry at bx=${bx}: A→B=${ab}, B→A=${ba}`)
        }
      }
    })
  })
})
