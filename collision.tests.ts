import { describe, it, expect } from 'vitest'
import { C, CELL } from './src/palette.js'
import { createSprite } from './src/sprite.js'
import { rectsOverlap, spritesOverlap, isSolidAt, resolveX, resolveY, spriteRect } from './src/collision.js'
import { createTileMap } from './src/tilemap.js'
import type { Tile } from './src/tilemap.js'

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
