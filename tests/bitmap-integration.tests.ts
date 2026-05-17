import { describe, it, expect } from 'vitest'
import { C, CELL } from '../src/palette.js'
import {
  createBitmap, drawBitmap, mirrorBitmap,
  createAttrMap, drawBitmapAttrs, mirrorAttrMap,
  type Bitmap,
} from '../src/renderer.js'
import {
  bitmapRect, rectsOverlap,
  resolveRectX, resolveRectY,
} from '../src/collision.js'
import { createTileMap } from '../src/tilemap.js'
import type { Tile } from '../src/tilemap.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

type FillCall = { style: string; x: number; y: number; w: number; h: number }

function makeMockCtx() {
  let _fillStyle = ''
  const rects: FillCall[] = []
  return {
    get fillStyle() { return _fillStyle },
    set fillStyle(v: string) { _fillStyle = v },
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ style: _fillStyle, x, y, w, h })
    },
    _rects: rects,
  } as unknown as CanvasRenderingContext2D & { _rects: FillCall[] }
}

const WALL: Tile = {
  sprite: new Uint8Array(8).fill(0xFF),
  ink: C.B_WHITE, paper: C.BLACK, solid: true, id: 'wall',
}

const FLOOR: Tile = {
  sprite: new Uint8Array(8), ink: C.WHITE, paper: C.BLACK, solid: false, id: 'floor',
}

// ── Non-square / asymmetric dimensions ────────────────────────────────────────

describe('createBitmap — non-square dimensions are first-class', () => {
  const cases: Array<[number, number, number]> = [
    [16,  48,  96],  // tall narrow — totem / column enemy
    [48,  16,  96],  // wide short — train carriage
    [8,   64,  64],  // super-thin tall
    [64,   8,  64],  // super-thin wide
    [96, 128, 1536], // boss-class — user-requested
    [24,  40, 120],  // odd asymmetric — never multiple of 16
    [32,  24,  96],  // wider than tall
    [40,  56, 280],  // both non-power-of-two
  ]

  for (const [w, h, bytes] of cases) {
    it(`accepts ${w}×${h} (${bytes} bytes)`, () => {
      const bm = createBitmap(new Uint8Array(bytes), w, h)
      expect(bm.width).toBe(w)
      expect(bm.height).toBe(h)
      expect(bm.data.length).toBe(bytes)
    })
  }
})

describe('drawBitmap — pixel addressing works at extreme aspect ratios', () => {
  it('96×128 boss: leftmost pixel of last row lands at (x, y+127)', () => {
    const ctx = makeMockCtx()
    const data = new Uint8Array(96 / 8 * 128)
    // Row 127, byte 0, bit 7 → pixel at (0, 127) within the bitmap
    data[127 * 12 + 0] = 0x80
    const boss = createBitmap(data, 96, 128)
    drawBitmap(ctx, boss, 50, 30, C.B_MAGENTA)
    expect(ctx._rects).toHaveLength(1)
    expect(ctx._rects[0]).toMatchObject({ x: 50, y: 30 + 127 })
  })

  it('96×128 boss: rightmost pixel of first row lands at (x+95, y)', () => {
    const ctx = makeMockCtx()
    const data = new Uint8Array(96 / 8 * 128)
    // Row 0, byte 11 (last byte of row), bit 0 → pixel at (95, 0)
    data[11] = 0x01
    const boss = createBitmap(data, 96, 128)
    drawBitmap(ctx, boss, 0, 0, C.B_MAGENTA)
    expect(ctx._rects[0]).toMatchObject({ x: 95, y: 0 })
  })

  it('16×48 vertical sprite: paper rect spans full 16×48', () => {
    const ctx = makeMockCtx()
    const totem = createBitmap(new Uint8Array(96), 16, 48)
    drawBitmap(ctx, totem, 0, 0, C.B_GREEN, C.BLACK)
    expect(ctx._rects[0]).toMatchObject({ style: C.BLACK, w: 16, h: 48 })
  })
})

describe('mirrorBitmap — preserves bounding box for asymmetric sizes', () => {
  it('16×48 mirror keeps width=16, height=48', () => {
    const src = createBitmap(new Uint8Array(96), 16, 48)
    const m = mirrorBitmap(src)
    expect(m.width).toBe(16)
    expect(m.height).toBe(48)
  })

  it('96×128 boss mirror preserves all dimensions', () => {
    const src = createBitmap(new Uint8Array(1536), 96, 128)
    const m = mirrorBitmap(src)
    expect(m.width).toBe(96)
    expect(m.height).toBe(128)
    expect(m.data.length).toBe(1536)
  })

  it('asymmetric 48×16: leftmost pixel mirrors to rightmost across 6 bytes', () => {
    const data = new Uint8Array(48 / 8 * 16)
    data[0] = 0x80   // row 0, far-left pixel
    const src = createBitmap(data, 48, 16)
    const m = mirrorBitmap(src)
    // Mirrored: row 0, byte 5 (rightmost), bit 0
    expect(m.data[5]).toBe(0x01)
    expect(m.data[0]).toBe(0)
  })
})

// ── bitmapRect — bounding rect for any sized bitmap ──────────────────────────

describe('bitmapRect', () => {
  it('returns rect with bitmap dimensions', () => {
    const bm = createBitmap(new Uint8Array(48), 16, 24)
    const r = bitmapRect(bm, 10, 20)
    expect(r).toEqual({ x: 10, y: 20, w: 16, h: 24 })
  })

  it('handles 96×128 boss', () => {
    const bm = createBitmap(new Uint8Array(1536), 96, 128)
    expect(bitmapRect(bm, 0, 0)).toEqual({ x: 0, y: 0, w: 96, h: 128 })
  })

  it('handles non-integer positions (sub-pixel sprites)', () => {
    const bm = createBitmap(new Uint8Array(32), 16, 16)
    expect(bitmapRect(bm, 5.5, 10.25)).toEqual({ x: 5.5, y: 10.25, w: 16, h: 16 })
  })
})

// ── Entity-vs-entity collision ───────────────────────────────────────────────

describe('hero (16×24) vs enemy (16×24) — symmetric AABB overlap', () => {
  const HERO  = createBitmap(new Uint8Array(48), 16, 24)
  const ENEMY = createBitmap(new Uint8Array(48), 16, 24)

  it('exact overlap at same position', () => {
    expect(rectsOverlap(bitmapRect(HERO, 0, 0), bitmapRect(ENEMY, 0, 0))).toBe(true)
  })

  it('shifted by 8 px right: still overlapping (8 px common width)', () => {
    expect(rectsOverlap(bitmapRect(HERO, 0, 0), bitmapRect(ENEMY, 8, 0))).toBe(true)
  })

  it('shifted by 15 px right: still overlapping (1 px common width)', () => {
    expect(rectsOverlap(bitmapRect(HERO, 0, 0), bitmapRect(ENEMY, 15, 0))).toBe(true)
  })

  it('shifted by 16 px right: edges touch — NO overlap', () => {
    expect(rectsOverlap(bitmapRect(HERO, 0, 0), bitmapRect(ENEMY, 16, 0))).toBe(false)
  })

  it('shifted by 23 px down: still overlapping vertically (1 px)', () => {
    expect(rectsOverlap(bitmapRect(HERO, 0, 0), bitmapRect(ENEMY, 0, 23))).toBe(true)
  })

  it('shifted by 24 px down: edges touch — NO overlap', () => {
    expect(rectsOverlap(bitmapRect(HERO, 0, 0), bitmapRect(ENEMY, 0, 24))).toBe(false)
  })

  it('far apart (100 px) — NO overlap', () => {
    expect(rectsOverlap(bitmapRect(HERO, 0, 0), bitmapRect(ENEMY, 100, 100))).toBe(false)
  })
})

describe('boss (96×128) vs hero (16×32) — big vs small', () => {
  const BOSS = createBitmap(new Uint8Array(1536), 96, 128)
  const HERO = createBitmap(new Uint8Array(64), 16, 32)

  it('hero fully inside boss bounding box', () => {
    expect(rectsOverlap(bitmapRect(BOSS, 0, 0), bitmapRect(HERO, 40, 50))).toBe(true)
  })

  it('hero just touching boss left edge — NO overlap', () => {
    // Hero right edge at x=95, boss left edge at x=96 → no overlap
    expect(rectsOverlap(bitmapRect(BOSS, 96, 0), bitmapRect(HERO, 80, 0))).toBe(false)
  })

  it('hero one pixel into boss left side — overlap', () => {
    // Boss at x=80, hero right edge at x=80 (just touches) — no overlap
    // Hero right edge at x=81 → overlap by 1px
    expect(rectsOverlap(bitmapRect(BOSS, 80, 0), bitmapRect(HERO, 80 - 16 + 1, 0))).toBe(true)
  })

  it('hero below boss with vertical gap — NO overlap', () => {
    expect(rectsOverlap(bitmapRect(BOSS, 0, 0), bitmapRect(HERO, 0, 130))).toBe(false)
  })

  it('hero above boss touching top — NO overlap (touching edges)', () => {
    expect(rectsOverlap(bitmapRect(BOSS, 0, 32), bitmapRect(HERO, 0, 0))).toBe(false)
  })
})

describe('hero vs small collectible (8×8 Bitmap)', () => {
  const HERO = createBitmap(new Uint8Array(64), 16, 32)
  const COIN = createBitmap(new Uint8Array(8),  8,  8)

  it('coin inside hero bounding box — pickup detected', () => {
    expect(rectsOverlap(bitmapRect(HERO, 0, 0), bitmapRect(COIN, 4, 12))).toBe(true)
  })

  it('coin to the right of hero — no pickup', () => {
    expect(rectsOverlap(bitmapRect(HERO, 0, 0), bitmapRect(COIN, 16, 0))).toBe(false)
  })
})

// ── Mirror preserves collision bounding box ──────────────────────────────────

describe('mirrorBitmap — collision invariance', () => {
  const HERO_RIGHT = createBitmap((() => {
    const d = new Uint8Array(48)
    d[0] = 0x80    // asymmetric: pixel on far-left of row 0
    return d
  })(), 16, 24)
  const HERO_LEFT = mirrorBitmap(HERO_RIGHT)

  it('mirrored sprite has same width/height — same bounding rect', () => {
    expect(bitmapRect(HERO_LEFT, 5, 7)).toEqual(bitmapRect(HERO_RIGHT, 5, 7))
  })

  it('overlap detection identical for mirrored and original', () => {
    const enemy = createBitmap(new Uint8Array(48), 16, 24)
    const a = rectsOverlap(bitmapRect(HERO_RIGHT, 10, 10), bitmapRect(enemy, 20, 10))
    const b = rectsOverlap(bitmapRect(HERO_LEFT,  10, 10), bitmapRect(enemy, 20, 10))
    expect(a).toBe(b)
  })
})

// ── Tilemap collision: tall sprites across multiple tile rows ────────────────

function makeWallRowMap(rows: number, cols: number, wallRow: number) {
  const map = createTileMap(cols, rows)
  map.fill(FLOOR)
  for (let x = 0; x < cols; x++) map.setTile(x, wallRow, WALL)
  return map
}

function makeWallColMap(rows: number, cols: number, wallCol: number) {
  const map = createTileMap(cols, rows)
  map.fill(FLOOR)
  for (let y = 0; y < rows; y++) map.setTile(wallCol, y, WALL)
  return map
}

describe('resolveRectY — tall sprite landing on floor', () => {
  it('16×24 hero falling onto floor at row 5 — lands flush, hitBottom=true', () => {
    const map = makeWallRowMap(10, 10, 5)
    // Hero head at y=0, feet at y=23. Falls down. Floor tile at y=40..47.
    const rect = { x: 8, y: 0, w: 16, h: 24 }
    // Move down: target y where feet would enter floor (y=17 → feet at y=40 → in floor row)
    const r = resolveRectY(rect, map, 17)
    expect(r.hitBottom).toBe(true)
    // Hero placed flush above floor: floor at y=40, hero height 24, so hero.y = 16
    expect(r.y).toBe(40 - 24)
  })

  it('does NOT stop above floor when feet are still in the air', () => {
    const map = makeWallRowMap(10, 10, 5)
    const rect = { x: 8, y: 0, w: 16, h: 24 }
    const r = resolveRectY(rect, map, 10)   // feet at y=33, floor at y=40 — clear
    expect(r.hitBottom).toBe(false)
    expect(r.y).toBe(10)
  })
})

describe('resolveRectX — wide sprite hitting wall column', () => {
  it('24×16 wagon moving right into wall at col 5 — stops flush left of wall', () => {
    const map = makeWallColMap(10, 10, 5)
    const rect = { x: 0, y: 16, w: 24, h: 16 }
    // Try to move so right edge enters wall column (col 5 = x=40..47).
    // Right edge of wagon would be at x=newX+23. Need newX+23 ≥ 40 → newX ≥ 17.
    const r = resolveRectX(rect, map, 20)
    expect(r.hitRight).toBe(true)
    // Wall starts at x=40, wagon width 24 → wagon.x = 16
    expect(r.x).toBe(40 - 24)
  })

  it('24×16 wagon moving left into wall column — stops flush right of wall', () => {
    const map = makeWallColMap(10, 10, 3)
    // Wagon at x=32 (right of wall col 3 = x=24..31). Move left into wall.
    const rect = { x: 32, y: 16, w: 24, h: 16 }
    const r = resolveRectX(rect, map, 24)   // left edge enters wall
    expect(r.hitLeft).toBe(true)
    // Should be placed flush right of wall col 3 → x = 4*CELL = 32
    expect(r.x).toBe(32)
  })
})

describe('resolveRectY — tall sprite spanning >2 tile rows (critical for 24+ height)', () => {
  it('24-tall hero — wall in middle vertical tile-row is detected when moving right', () => {
    // 24-tall sprite at y=8 spans tile rows 1 (y=8..15), 2 (y=16..23), 3 (y=24..31).
    // A naive check using only y0 and y1 would skip row 2 — this test catches that.
    const map = createTileMap(10, 10)
    map.fill(FLOOR)
    map.setTile(5, 2, WALL)   // wall only at row 2 (the MIDDLE row hero crosses)

    // Start hero with right edge in col 4 (x=24..39) — clear of wall col 5
    const rect = { x: 24, y: 8, w: 16, h: 24 }

    // Move right by 1 → right edge enters col 5 (x=40)
    const r = resolveRectX(rect, map, 25)
    expect(r.hitRight).toBe(true)             // wall in middle row was detected
    expect(r.x).toBe(40 - 16)                 // flush left of wall col → x=24
  })

  it('24-tall hero — wall in middle row is detected when moving left', () => {
    const map = createTileMap(10, 10)
    map.fill(FLOOR)
    map.setTile(2, 2, WALL)   // wall at col 2, row 2 (middle of hero's vertical span)

    // Start hero with left edge in col 3 (x=24) — clear of wall col 2
    const rect = { x: 24, y: 8, w: 16, h: 24 }

    // Move left by 1 → left edge enters col 2 (x=23 → col 2)
    const r = resolveRectX(rect, map, 23)
    expect(r.hitLeft).toBe(true)              // wall in middle row was detected
    expect(r.x).toBe((2 + 1) * CELL)          // flush right of wall col → x=24
  })

  it('48-wide sprite — wall in middle horizontal tile-column is detected when falling', () => {
    // 48-wide sprite spans 6 tile columns. A naive check of only the two horizontal
    // corners would skip the inner 4 columns — this test catches that.
    const map = createTileMap(15, 10)
    map.fill(FLOOR)
    map.setTile(3, 5, WALL)   // wall at col 3, row 5 (middle of sprite's horizontal span)

    // Sprite at y=24 spans cols 1..6 horizontally (x=8..55), bottom at y=39 (row 4)
    const rect = { x: 8, y: 24, w: 48, h: 16 }

    // Move down by 1 → bottom edge enters row 5 (y=40)
    const r = resolveRectY(rect, map, 25)
    expect(r.hitBottom).toBe(true)            // wall in middle col was detected
    expect(r.y).toBe(40 - 16)                 // flush above wall row → y=24
  })

  it('48-wide sprite — wall in middle column is detected when moving up', () => {
    const map = createTileMap(15, 10)
    map.fill(FLOOR)
    map.setTile(3, 2, WALL)   // wall at col 3, row 2 (middle of sprite's horizontal span)

    // Sprite at y=24 spans cols 1..6, top at y=24 (row 3, below wall row 2)
    const rect = { x: 8, y: 24, w: 48, h: 16 }

    // Move up by 1 → top edge enters row 2 (y=23 → row 2)
    const r = resolveRectY(rect, map, 23)
    expect(r.hitTop).toBe(true)
    expect(r.y).toBe((2 + 1) * CELL)          // flush below wall row → y=24
  })
})

describe('resolveRectX / Y — backward compat with 8×8 (sprite-equivalent)', () => {
  it('8×8 rect behaves identically to resolveX on 8×8 sprite', () => {
    const map = makeWallColMap(10, 10, 5)
    const rect = { x: 0, y: 16, w: CELL, h: CELL }
    const r = resolveRectX(rect, map, 36)  // try to enter col 5 = x=40
    expect(r.hitRight).toBe(true)
    expect(r.x).toBe(40 - CELL)
  })
})

// ── End-to-end: define → mirror → render → collide ───────────────────────────

describe('end-to-end: define large sprite → mirror → render → collide', () => {
  it('all four steps wire together without throwing for a 24×40 character', () => {
    const data = new Uint8Array(24 / 8 * 40)
    // Add a couple of pixels so render produces ink fillRects
    data[0] = 0xFF; data[1] = 0xFF; data[2] = 0xFF
    const charR: Bitmap = createBitmap(data, 24, 40)
    const charL: Bitmap = mirrorBitmap(charR)

    const ctx = makeMockCtx()
    drawBitmap(ctx, charR, 10, 20, C.B_WHITE, C.BLACK)
    drawBitmap(ctx, charL, 60, 20, C.B_WHITE, C.BLACK)

    // Both characters rendered something
    expect(ctx._rects.length).toBeGreaterThan(2)

    // Collision: characters at x=10 and x=60, width 24 each — no overlap
    expect(rectsOverlap(bitmapRect(charR, 10, 20), bitmapRect(charL, 60, 20))).toBe(false)

    // Move left character right by 30 px → x=40, right edge at x=63 → overlap
    expect(rectsOverlap(bitmapRect(charR, 40, 20), bitmapRect(charL, 60, 20))).toBe(true)
  })
})

// ── Multi-coloured sprites (authentic Spectrum attribute clash) ───────────────

describe('multi-coloured hero (16×24, 2×3 attrs) — Jet-Pac style', () => {
  // Helper: vertical pixel line through every row → ensures we have ink pixels
  // in every cell so we can verify per-cell ink colour assignment.
  const HERO_BYTES = (() => {
    const d = new Uint8Array(48)
    for (let row = 0; row < 24; row++) {
      d[row * 2 + 0] = 0xFF   // fill byte 0 of every row
      d[row * 2 + 1] = 0xFF   // fill byte 1 of every row
    }
    return d
  })()
  const HERO_BMP   = createBitmap(HERO_BYTES, 16, 24)
  const HERO_ATTRS = createAttrMap(2, 3, [
    C.B_YELLOW, C.B_YELLOW,   // head row (cells row 0)
    C.B_RED,    C.B_RED,      // body row (cells row 1)
    C.B_BLUE,   C.B_BLUE,     // legs row (cells row 2)
  ], C.BLACK)

  it('renders 6 paper cells + 16×24 = 384 ink pixels = 390 fillRects', () => {
    const ctx = makeMockCtx()
    drawBitmapAttrs(ctx, HERO_BMP, HERO_ATTRS, 0, 0)
    expect(ctx._rects).toHaveLength(6 + 384)
  })

  it('top 8 rows of pixels render in yellow', () => {
    const ctx = makeMockCtx()
    drawBitmapAttrs(ctx, HERO_BMP, HERO_ATTRS, 0, 0)
    const topPixels = ctx._rects.filter(r => r.w === 1 && r.y < 8)
    expect(topPixels).toHaveLength(8 * 16)   // 8 rows × 16 px wide
    for (const r of topPixels) expect(r.style).toBe(C.B_YELLOW)
  })

  it('middle 8 rows render in red', () => {
    const ctx = makeMockCtx()
    drawBitmapAttrs(ctx, HERO_BMP, HERO_ATTRS, 0, 0)
    const midPixels = ctx._rects.filter(r => r.w === 1 && r.y >= 8 && r.y < 16)
    for (const r of midPixels) expect(r.style).toBe(C.B_RED)
  })

  it('bottom 8 rows render in blue', () => {
    const ctx = makeMockCtx()
    drawBitmapAttrs(ctx, HERO_BMP, HERO_ATTRS, 0, 0)
    const botPixels = ctx._rects.filter(r => r.w === 1 && r.y >= 16)
    for (const r of botPixels) expect(r.style).toBe(C.B_BLUE)
  })

  it('respects x/y offsets uniformly', () => {
    const ctx = makeMockCtx()
    drawBitmapAttrs(ctx, HERO_BMP, HERO_ATTRS, 100, 50)
    // First paper cell at (100, 50)
    expect(ctx._rects[0]).toMatchObject({ x: 100, y: 50, w: 8, h: 8 })
  })
})

// ── Mirror invariance — mirrored bitmap + mirrored attrs render correctly ───

describe('mirror invariance — bitmap + attrs flip together', () => {
  // 16×8 (2×1 attrs) — single row, asymmetric ink colours
  // Left half pixels set: byte 0 = 0xFF, byte 1 = 0x00 (per row)
  const ASYM_BYTES = (() => {
    const d = new Uint8Array(16)
    for (let row = 0; row < 8; row++) {
      d[row * 2 + 0] = 0xFF   // left cell: filled
      d[row * 2 + 1] = 0x00   // right cell: empty
    }
    return d
  })()
  const BMP   = createBitmap(ASYM_BYTES, 16, 8)
  const ATTRS = createAttrMap(2, 1, [C.B_RED, C.B_GREEN], C.BLACK)

  it('original: left half is red (pixels), right half is empty', () => {
    const ctx = makeMockCtx()
    drawBitmapAttrs(ctx, BMP, ATTRS, 0, 0)
    const inkPixels = ctx._rects.filter(r => r.w === 1)
    // All ink pixels should be red (they're all on the left, where ink = RED)
    for (const r of inkPixels) {
      expect(r.style).toBe(C.B_RED)
      expect(r.x).toBeLessThan(8)
    }
  })

  it('mirrored: pixels move to the right half, ink stays RED (colour follows the body part)', () => {
    // After horizontal mirror:
    // - bitmap pixels move from left cell (byte 0) to right cell (byte 1)
    // - mirrorAttrMap swaps inks: cell 0 = GREEN, cell 1 = RED
    // The right cell now has RED ink AND has pixels — so visible pixels are RED.
    // This is the authentic mirror semantic: a red body part stays red after the flip.
    const ctx = makeMockCtx()
    const mBmp   = mirrorBitmap(BMP)
    const mAttrs = mirrorAttrMap(ATTRS)
    drawBitmapAttrs(ctx, mBmp, mAttrs, 0, 0)
    const inkPixels = ctx._rects.filter(r => r.w === 1)
    expect(inkPixels.length).toBeGreaterThan(0)
    for (const r of inkPixels) {
      expect(r.style).toBe(C.B_RED)            // body part keeps its colour
      expect(r.x).toBeGreaterThanOrEqual(8)    // but is now on the right side
    }
  })

  it('mirrored attrs alone (with unmirrored bitmap) → pixels render in GREEN', () => {
    // Sanity check: if you only mirror the attrs but NOT the bitmap, you get
    // "wrong" colours — original pixels (still on left) hit the swapped ink (GREEN).
    // This is why bitmap and attrs must always mirror together.
    const ctx = makeMockCtx()
    drawBitmapAttrs(ctx, BMP, mirrorAttrMap(ATTRS), 0, 0)
    const inkPixels = ctx._rects.filter(r => r.w === 1)
    for (const r of inkPixels) expect(r.style).toBe(C.B_GREEN)
  })

  it('mirror of mirror renders identically to original (per-pixel count + colour)', () => {
    const ctx1 = makeMockCtx()
    const ctx2 = makeMockCtx()
    drawBitmapAttrs(ctx1, BMP, ATTRS, 0, 0)
    drawBitmapAttrs(ctx2, mirrorBitmap(mirrorBitmap(BMP)),
                          mirrorAttrMap(mirrorAttrMap(ATTRS)), 0, 0)
    expect(ctx2._rects).toEqual(ctx1._rects)
  })
})

// ── AttrMap + Collision — bbox unchanged by colour scheme ────────────────────

describe('AttrMap + collision — colours never affect bounding box', () => {
  const BMP = createBitmap(new Uint8Array(48), 16, 24)
  const MULTI_ATTRS = createAttrMap(2, 3, [
    C.B_YELLOW, C.B_YELLOW,
    C.B_RED,    C.B_RED,
    C.B_BLUE,   C.B_BLUE,
  ], C.BLACK)
  const TRANSPARENT_ATTRS = createAttrMap(2, 3, [
    C.B_YELLOW, C.B_YELLOW,
    C.B_RED,    C.B_RED,
    C.B_BLUE,   C.B_BLUE,
  ])  // no papers

  it('bitmapRect ignores attrs entirely (collision is pixel-bbox based)', () => {
    const r1 = bitmapRect(BMP, 10, 20)
    expect(r1).toEqual({ x: 10, y: 20, w: 16, h: 24 })
  })

  it('two heroes with different colour schemes still collide based on rects', () => {
    const ENEMY_BMP = createBitmap(new Uint8Array(48), 16, 24)
    // Hero with multi-colour attrs vs enemy with transparent attrs — same bbox
    expect(rectsOverlap(bitmapRect(BMP, 0, 0), bitmapRect(ENEMY_BMP, 8, 0))).toBe(true)
    // Visual: both use drawBitmapAttrs with different attrs, but collision sees only rects
    void MULTI_ATTRS; void TRANSPARENT_ATTRS
  })

  it('mirrored hero collision rect identical to original (mirror preserves bbox)', () => {
    const mBmp = mirrorBitmap(BMP)
    expect(bitmapRect(mBmp, 5, 7)).toEqual(bitmapRect(BMP, 5, 7))
  })
})

// ── End-to-end Manic-Miner-style multi-colour character ───────────────────────

describe('end-to-end: multi-colour character with mirrored variant', () => {
  it('define → mirror (bitmap + attrs) → render both directions → collide', () => {
    const data = new Uint8Array(48)
    // Some asymmetric content so mirror is observable
    for (let row = 0; row < 24; row++) {
      data[row * 2 + 0] = (row < 8) ? 0x80 : 0xC0   // left half has pixels
      data[row * 2 + 1] = 0x00                       // right half empty
    }
    const HERO_R_BMP = createBitmap(data, 16, 24)
    const HERO_R_ATTRS = createAttrMap(2, 3, [
      C.B_YELLOW, C.B_WHITE,   // head: yellow ink left, white ink right
      C.B_RED,    C.B_RED,
      C.B_BLUE,   C.B_CYAN,    // legs: blue left, cyan right
    ], C.BLACK)

    // Derive left-facing
    const HERO_L_BMP   = mirrorBitmap(HERO_R_BMP)
    const HERO_L_ATTRS = mirrorAttrMap(HERO_R_ATTRS)

    // Render both
    const ctx = makeMockCtx()
    drawBitmapAttrs(ctx, HERO_R_BMP, HERO_R_ATTRS, 10, 10)
    drawBitmapAttrs(ctx, HERO_L_BMP, HERO_L_ATTRS, 40, 10)

    // Both rendered something
    expect(ctx._rects.length).toBeGreaterThan(12)   // at least 6 + 6 paper fills

    // Collision: 16 wide, at x=10 and x=40 → no overlap (gap of 14 px)
    expect(rectsOverlap(bitmapRect(HERO_R_BMP, 10, 10), bitmapRect(HERO_L_BMP, 40, 10))).toBe(false)

    // Bring them together at x=20 → overlap with right hero
    expect(rectsOverlap(bitmapRect(HERO_R_BMP, 10, 10), bitmapRect(HERO_L_BMP, 20, 10))).toBe(true)
  })
})
