import { describe, it, expect } from 'vitest'
import { C, CELL } from '../src/palette.js'
import { createSprite } from '../src/sprite.js'
import { createBitmap } from '../src/renderer.js'
import {
  rectsOverlap, spritesOverlap, isSolidAt, resolveX, resolveY, spriteRect,
  bitmapRect, bitmapPixelMask, masksOverlap, pixelSolidCount,
} from '../src/collision.js'
import { createTileMap } from '../src/tilemap.js'
import type { Tile } from '../src/tilemap.js'

const BM = new Uint8Array(8)

const WALL: Tile = { sprite: BM, ink: C.B_WHITE, paper: C.BLACK, solid: true,  id: 'wall'  }
const OPEN: Tile = { sprite: BM, ink: C.GREEN,   paper: C.BLACK, solid: false, id: 'floor' }

// ── spriteRect ────────────────────────────────────────────────────────────────

describe('spriteRect', () => {
  it('returns CELL×CELL rect at sprite position', () => {
    const s = createSprite(BM, C.B_CYAN)
    s.x = 16; s.y = 24
    const r = spriteRect(s)
    expect(r).toEqual({ x: 16, y: 24, w: CELL, h: CELL })
  })
})

// ── bitmapRect ───────────────────────────────────────────────────────────────

describe('bitmapRect', () => {
  it('returns correct rect for a bitmap at given position', () => {
    const bmp = createBitmap(new Uint8Array(48), 16, 24)
    const r = bitmapRect(bmp, 10, 20)
    expect(r).toEqual({ x: 10, y: 20, w: 16, h: 24 })
  })
})

// ── rectsOverlap ──────────────────────────────────────────────────────────────

describe('rectsOverlap', () => {
  it('returns true for identical rects', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 8, h: 8 }, { x: 0, y: 0, w: 8, h: 8 })).toBe(true)
  })

  it('returns true for partial overlap (right side)', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 8, h: 8 }, { x: 4, y: 0, w: 8, h: 8 })).toBe(true)
  })

  it('returns true for partial overlap (bottom)', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 8, h: 8 }, { x: 0, y: 4, w: 8, h: 8 })).toBe(true)
  })

  it('returns true for contained rect', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 16, h: 16 }, { x: 4, y: 4, w: 4, h: 4 })).toBe(true)
  })

  it('returns false when separated horizontally', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 8, h: 8 }, { x: 10, y: 0, w: 8, h: 8 })).toBe(false)
  })

  it('returns false when separated vertically', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 8, h: 8 }, { x: 0, y: 10, w: 8, h: 8 })).toBe(false)
  })

  it('returns false for touching edges (shared border, no area)', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 8, h: 8 }, { x: 8, y: 0, w: 8, h: 8 })).toBe(false)
  })

  it('returns false when far apart', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 8, h: 8 }, { x: 100, y: 100, w: 8, h: 8 })).toBe(false)
  })
})

// ── spritesOverlap ────────────────────────────────────────────────────────────

describe('spritesOverlap', () => {
  it('returns true when sprites are at same position', () => {
    const a = createSprite(BM, C.B_CYAN); a.x = 16; a.y = 16
    const b = createSprite(BM, C.B_RED);  b.x = 16; b.y = 16
    expect(spritesOverlap(a, b)).toBe(true)
  })

  it('returns true for partial overlap', () => {
    const a = createSprite(BM, C.B_CYAN); a.x = 0; a.y = 0
    const b = createSprite(BM, C.B_RED);  b.x = 4; b.y = 4
    expect(spritesOverlap(a, b)).toBe(true)
  })

  it('returns false when sprites are not touching', () => {
    const a = createSprite(BM, C.B_CYAN); a.x = 0;  a.y = 0
    const b = createSprite(BM, C.B_RED);  b.x = 16; b.y = 0
    expect(spritesOverlap(a, b)).toBe(false)
  })

  it('returns false for adjacent sprites (touching edges)', () => {
    const a = createSprite(BM, C.B_CYAN); a.x = 0; a.y = 0
    const b = createSprite(BM, C.B_RED);  b.x = 8; b.y = 0
    expect(spritesOverlap(a, b)).toBe(false)
  })
})

// ── isSolidAt ─────────────────────────────────────────────────────────────────

describe('isSolidAt', () => {
  function makeMap() {
    const map = createTileMap(4, 4)
    map.fill(OPEN)
    map.setTile(2, 2, WALL)  // solid tile at (tile 2,2) = pixels 16–23, 16–23
    return map
  }

  it('returns false for open tile', () => {
    expect(isSolidAt(makeMap(), 0, 0)).toBe(false)
  })

  it('returns true for solid tile — top-left pixel', () => {
    expect(isSolidAt(makeMap(), 16, 16)).toBe(true)
  })

  it('returns true for solid tile — bottom-right pixel', () => {
    expect(isSolidAt(makeMap(), 23, 23)).toBe(true)
  })

  it('returns true for out-of-bounds pixel (map boundary is solid)', () => {
    expect(isSolidAt(makeMap(), -1, 0)).toBe(true)
    expect(isSolidAt(makeMap(), 0, -1)).toBe(true)
    expect(isSolidAt(makeMap(), 999, 0)).toBe(true)
  })
})

// ── resolveX ──────────────────────────────────────────────────────────────────

describe('resolveX — horizontal collision', () => {
  // Map: 5×3 tiles — wall columns at 0 and 4, open in between
  //  col:  0     1     2     3     4
  //       WALL  OPEN  OPEN  OPEN  WALL
  function makeHallway() {
    const map = createTileMap(5, 3)
    map.fill(OPEN)
    map.fillRect(0, 0, 1, 3, WALL)  // left wall
    map.fillRect(4, 0, 1, 3, WALL)  // right wall
    return map
  }

  it('passes through when no wall ahead (moving right)', () => {
    const s = createSprite(BM, C.B_CYAN)
    s.x = CELL; s.y = CELL   // tile (1,1)
    const result = resolveX(s, makeHallway(), s.x + 4)
    expect(result.x).toBe(s.x + 4)
    expect(result.hitRight).toBe(false)
  })

  it('stops at right wall', () => {
    const s = createSprite(BM, C.B_CYAN)
    s.x = 3 * CELL; s.y = CELL  // tile (3,1) — one tile left of right wall
    // Try to move to x=25 (right edge at 25+7=32 → tile col 4 = wall)
    const result = resolveX(s, makeHallway(), 25)
    expect(result.hitRight).toBe(true)
    // sprite must be pushed left of wall: tile 4 starts at px 32, sprite right edge at sprite.x+8
    expect(result.x + CELL).toBeLessThanOrEqual(4 * CELL)
  })

  it('stops at left wall', () => {
    const s = createSprite(BM, C.B_CYAN)
    s.x = CELL; s.y = CELL   // tile (1,1)
    const result = resolveX(s, makeHallway(), -2)  // would enter left wall
    expect(result.hitLeft).toBe(true)
    expect(result.x).toBeGreaterThanOrEqual(CELL)  // pushed right of wall
  })

  it('no hit when not moving', () => {
    const s = createSprite(BM, C.B_CYAN)
    s.x = CELL; s.y = CELL
    const result = resolveX(s, makeHallway(), s.x)
    expect(result.hitLeft).toBe(false)
    expect(result.hitRight).toBe(false)
    expect(result.x).toBe(s.x)
  })
})

// ── resolveY ──────────────────────────────────────────────────────────────────

describe('resolveY — vertical collision', () => {
  // Map: 3×5 tiles — ceiling at row 0, floor at row 4
  function makeShaft() {
    const map = createTileMap(3, 5)
    map.fill(OPEN)
    map.fillRect(0, 0, 3, 1, WALL)  // ceiling
    map.fillRect(0, 4, 3, 1, WALL)  // floor
    return map
  }

  it('falls freely when no floor below', () => {
    const s = createSprite(BM, C.B_CYAN)
    s.x = CELL; s.y = CELL    // tile (1,1)
    const result = resolveY(s, makeShaft(), s.y + 4)
    expect(result.y).toBe(s.y + 4)
    expect(result.hitBottom).toBe(false)
  })

  it('lands on floor — hitBottom true', () => {
    const s = createSprite(BM, C.B_CYAN)
    s.x = CELL; s.y = 3 * CELL  // tile (1,3) — one tile above floor
    // Move down so bottom edge enters floor tile (row 4, starts at py 32)
    const result = resolveY(s, makeShaft(), s.y + 6)
    expect(result.hitBottom).toBe(true)
    expect(result.y + CELL).toBeLessThanOrEqual(4 * CELL)
  })

  it('hits ceiling — hitTop true', () => {
    const s = createSprite(BM, C.B_CYAN)
    s.x = CELL; s.y = CELL    // tile (1,1)
    const result = resolveY(s, makeShaft(), -2)  // would enter ceiling
    expect(result.hitTop).toBe(true)
    expect(result.y).toBeGreaterThanOrEqual(CELL)
  })

  it('no hit when stationary', () => {
    const s = createSprite(BM, C.B_CYAN)
    s.x = CELL; s.y = CELL
    const result = resolveY(s, makeShaft(), s.y)
    expect(result.hitTop).toBe(false)
    expect(result.hitBottom).toBe(false)
    expect(result.y).toBe(s.y)
  })

  it('sprite rests exactly on floor after landing', () => {
    const s = createSprite(BM, C.B_CYAN)
    s.x = CELL; s.y = 3 * CELL
    const result = resolveY(s, makeShaft(), s.y + 20)  // overshoot
    // Bottom edge must be flush with floor tile top: sprite.y + CELL = 4 * CELL
    expect(result.y + CELL).toBe(4 * CELL)
  })

  it('sprite rests exactly on ceiling after bump', () => {
    const s = createSprite(BM, C.B_CYAN)
    s.x = CELL; s.y = CELL
    const result = resolveY(s, makeShaft(), -20)  // overshoot upward
    // Top edge must be flush below ceiling: sprite.y = 1 * CELL
    expect(result.y).toBe(CELL)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Pixel-precise collision — bitmapPixelMask, masksOverlap, pixelSolidCount
// ═══════════════════════════════════════════════════════════════════════════════

// 8×8 solid square (all bits set)
const SOLID_8x8 = createBitmap(new Uint8Array([
  0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
]), 8, 8)

// 8×8 empty (no bits set)
const EMPTY_8x8 = createBitmap(new Uint8Array(8), 8, 8)

// 8×8 with centre 4px per row: 0x3C = 0011 1100 → columns 2,3,4,5
const NARROW_8x8 = createBitmap(new Uint8Array([
  0x3C, 0x3C, 0x3C, 0x3C, 0x3C, 0x3C, 0x3C, 0x3C,
]), 8, 8)

// 16×4 T-shape — full top row, narrow stem below
const T_SHAPE = createBitmap(new Uint8Array([
  0xFF, 0xFF,   // row 0: all 16 columns
  0x03, 0xC0,   // row 1: cols 6-9  (0000 0011 1100 0000)
  0x03, 0xC0,   // row 2
  0x03, 0xC0,   // row 3
]), 16, 4)

// 8×4 L-shape — bottom-left corner only
const L_SHAPE = createBitmap(new Uint8Array([
  0x80,   // row 0: col 0 only (1000 0000)
  0x80,   // row 1: col 0 only
  0x80,   // row 2: col 0 only
  0xF0,   // row 3: cols 0-3  (1111 0000)
]), 8, 4)

// ── bitmapPixelMask ──────────────────────────────────────────────────────────

describe('bitmapPixelMask', () => {
  it('solid 8×8 has 64 total pixels', () => {
    const mask = bitmapPixelMask(SOLID_8x8)
    expect(mask.totalPixels).toBe(64)
    expect(mask.width).toBe(8)
    expect(mask.height).toBe(8)
  })

  it('each row of solid 8×8 lists columns 0–7', () => {
    const mask = bitmapPixelMask(SOLID_8x8)
    for (let row = 0; row < 8; row++) {
      expect(mask.rows[row]).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    }
  })

  it('empty bitmap has 0 total pixels and empty rows', () => {
    const mask = bitmapPixelMask(EMPTY_8x8)
    expect(mask.totalPixels).toBe(0)
    for (let row = 0; row < 8; row++) {
      expect(mask.rows[row]).toEqual([])
    }
  })

  it('narrow bitmap has only centre columns 2–5', () => {
    const mask = bitmapPixelMask(NARROW_8x8)
    expect(mask.totalPixels).toBe(32)
    for (let row = 0; row < 8; row++) {
      expect(mask.rows[row]).toEqual([2, 3, 4, 5])
    }
  })

  it('T-shape has wide top row and narrow body', () => {
    const mask = bitmapPixelMask(T_SHAPE)
    expect(mask.rows[0]!.length).toBe(16)
    expect(mask.rows[1]).toEqual([6, 7, 8, 9])
    expect(mask.totalPixels).toBe(16 + 3 * 4)
  })

  it('L-shape has correct asymmetric pixel layout', () => {
    const mask = bitmapPixelMask(L_SHAPE)
    expect(mask.rows[0]).toEqual([0])
    expect(mask.rows[1]).toEqual([0])
    expect(mask.rows[2]).toEqual([0])
    expect(mask.rows[3]).toEqual([0, 1, 2, 3])
    expect(mask.totalPixels).toBe(7)
  })

  it('rows are sorted ascending', () => {
    const mask = bitmapPixelMask(T_SHAPE)
    for (const row of mask.rows) {
      for (let i = 1; i < row.length; i++) {
        expect(row[i]).toBeGreaterThan(row[i - 1]!)
      }
    }
  })

  it('preserves bitmap dimensions', () => {
    const mask = bitmapPixelMask(T_SHAPE)
    expect(mask.width).toBe(16)
    expect(mask.height).toBe(4)
  })
})

// ── masksOverlap ─────────────────────────────────────────────────────────────

describe('masksOverlap', () => {
  const solidMask = bitmapPixelMask(SOLID_8x8)
  const narrowMask = bitmapPixelMask(NARROW_8x8)
  const emptyMask = bitmapPixelMask(EMPTY_8x8)
  const lMask = bitmapPixelMask(L_SHAPE)

  it('identical position → full overlap', () => {
    expect(masksOverlap(solidMask, 0, 0, solidMask, 0, 0)).toBe(64)
  })

  it('no horizontal overlap → 0', () => {
    expect(masksOverlap(solidMask, 0, 0, solidMask, 8, 0)).toBe(0)
  })

  it('no vertical overlap → 0', () => {
    expect(masksOverlap(solidMask, 0, 0, solidMask, 0, 8)).toBe(0)
  })

  it('one column of horizontal overlap', () => {
    // solidMask at x=0 (cols 0–7), solidMask at x=7 (cols 7–14)
    // overlap: column 7 on 8 rows = 8 pixels
    expect(masksOverlap(solidMask, 0, 0, solidMask, 7, 0)).toBe(8)
  })

  it('empty mask always returns 0', () => {
    expect(masksOverlap(solidMask, 0, 0, emptyMask, 0, 0)).toBe(0)
    expect(masksOverlap(emptyMask, 0, 0, solidMask, 0, 0)).toBe(0)
    expect(masksOverlap(emptyMask, 0, 0, emptyMask, 0, 0)).toBe(0)
  })

  it('narrow vs solid — only centre columns overlap', () => {
    // narrowMask cols [2,3,4,5], 8 rows → 32 pixels in overlap
    expect(masksOverlap(narrowMask, 0, 0, solidMask, 0, 0)).toBe(32)
  })

  it('offset narrow so only 2 columns overlap', () => {
    // narrowMask at x=0: world cols 2,3,4,5
    // solidMask at x=4: world cols 4–11
    // overlap: world cols 4,5 → 2 cols × 8 rows = 16
    expect(masksOverlap(narrowMask, 0, 0, solidMask, 4, 0)).toBe(16)
  })

  it('partial vertical overlap', () => {
    // solidMask at y=0 (rows 0–7), solidMask at y=4 (rows 4–11)
    // overlapping rows: 4–7 → 4 rows × 8 cols = 32
    expect(masksOverlap(solidMask, 0, 0, solidMask, 0, 4)).toBe(32)
  })

  it('is commutative', () => {
    const ab = masksOverlap(narrowMask, 10, 5, solidMask, 12, 3)
    const ba = masksOverlap(solidMask, 12, 3, narrowMask, 10, 5)
    expect(ab).toBe(ba)
  })

  it('L-shape overlaps only at matching pixels', () => {
    // lMask at (0,0): row0=[0], row1=[0], row2=[0], row3=[0,1,2,3]
    // solidMask at (0,0): all pixels → overlap = 7 (all of L)
    expect(masksOverlap(lMask, 0, 0, solidMask, 0, 0)).toBe(7)
  })

  it('returns 0 for diagonal miss', () => {
    expect(masksOverlap(solidMask, 0, 0, solidMask, 8, 8)).toBe(0)
  })

  it('handles negative positions', () => {
    // solidMask at (-4, 0): world cols -4..3
    // solidMask at (0, 0): world cols 0..7
    // overlap: cols 0–3 → 4 cols × 8 rows = 32
    expect(masksOverlap(solidMask, -4, 0, solidMask, 0, 0)).toBe(32)
  })
})

// ── pixelSolidCount ──────────────────────────────────────────────────────────

describe('pixelSolidCount', () => {
  const solidMask = bitmapPixelMask(SOLID_8x8)
  const narrowMask = bitmapPixelMask(NARROW_8x8)
  const emptyMask = bitmapPixelMask(EMPTY_8x8)
  const lMask = bitmapPixelMask(L_SHAPE)

  function solidMap(solidTiles: [number, number][]) {
    const map = createTileMap(8, 8)
    map.fill(OPEN)
    for (const [tx, ty] of solidTiles) map.setTile(tx, ty, WALL)
    return map
  }

  it('mask on solid tile → full pixel count', () => {
    expect(pixelSolidCount(solidMask, 0, 0, solidMap([[0, 0]]))).toBe(64)
  })

  it('mask on empty tile → 0', () => {
    expect(pixelSolidCount(solidMask, 0, 0, solidMap([]))).toBe(0)
  })

  it('empty mask → always 0', () => {
    expect(pixelSolidCount(emptyMask, 0, 0, solidMap([[0, 0]]))).toBe(0)
  })

  it('mask halfway on tile edge → half pixels solid', () => {
    // solidMask at x=4 on tile (0,0) which covers px 0–7
    // cols 0–7 of mask → world x 4–11
    // tile solid region: x 0–7, so world x 4–7 → 4 solid cols × 8 rows = 32
    expect(pixelSolidCount(solidMask, 4, 0, solidMap([[0, 0]]))).toBe(32)
  })

  it('narrow mask partly on tile — Dizzy left foot on platform', () => {
    // narrowMask (cols 2,3,4,5) at x=4 → world x 6,7,8,9
    // tile (0,0) solid: covers world x 0–7
    // overlap: world x 6,7 → 2 cols × 8 rows = 16
    expect(pixelSolidCount(narrowMask, 4, 0, solidMap([[0, 0]]))).toBe(16)
  })

  it('narrow mask past tile edge → 0 (Dizzy falls)', () => {
    // narrowMask (cols 2,3,4,5) at x=6 → world x 8,9,10,11
    // tile (0,0) solid: covers world x 0–7 only
    expect(pixelSolidCount(narrowMask, 6, 0, solidMap([[0, 0]]))).toBe(0)
  })

  it('AABB would say standing but pixel mask says falling', () => {
    // narrowMask is 8px wide → AABB rect (6, 0, 8, 8)
    // tile (0,0) = world x 0–7
    // AABB right edge = 14 > 7 and left edge = 6 < 8 → AABB overlaps!
    // But actual pixels (cols 2–5) → world x 8–11 → past tile → 0 solid
    const count = pixelSolidCount(narrowMask, 6, 0, solidMap([[0, 0]]))
    expect(count).toBe(0)
  })

  it('mask spanning two tiles counts pixels on both', () => {
    // solidMask at x=4: world x 4–11 → crosses tile (0,0) and (1,0)
    // tile (0,0) solid, tile (1,0) solid → all 64 pixels on solid ground
    expect(pixelSolidCount(solidMask, 4, 0, solidMap([[0, 0], [1, 0]]))).toBe(64)
  })

  it('mask spanning two tiles with gap counts only solid portion', () => {
    // solidMask at x=4: world x 4–11
    // tile (0,0) solid → x 4–7: 4 cols × 8 rows = 32
    // tile (1,0) empty → x 8–11: 0
    expect(pixelSolidCount(solidMask, 4, 0, solidMap([[0, 0]]))).toBe(32)
  })

  it('L-shape counts only pixels at solid tiles', () => {
    // lMask at (0,0): col 0 rows 0–2 + cols 0–3 row 3
    // tile (0,0) solid → all 7 L-pixels are on it
    expect(pixelSolidCount(lMask, 0, 0, solidMap([[0, 0]]))).toBe(7)
  })

  it('out-of-bounds world pixels treated as solid (map boundary)', () => {
    // solidMask at (-4, 0): some pixels at negative x → solid (OOB)
    const map = solidMap([])
    const count = pixelSolidCount(solidMask, -4, 0, map)
    // cols 0–3 of mask → world x -4 to -1 → OOB → solid → 4 cols × 8 rows = 32
    expect(count).toBe(32)
  })
})
