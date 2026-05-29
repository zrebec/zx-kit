import { describe, it, expect } from 'vitest'
import { C } from '../src/palette.js'
import { createTileMap, type Tile } from '../src/tilemap.js'
import { drawTileMapAt, tileMapWorldSize } from '../src/tilescroll.js'

// ── Mock canvas context ───────────────────────────────────────────────────────

type FillCall = { style: string; x: number; y: number; w: number; h: number }

function makeMockCtx() {
  let _fillStyle = ''
  const rects: FillCall[] = []
  const ctx = {
    get fillStyle() { return _fillStyle },
    set fillStyle(v: string) { _fillStyle = v },
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ style: _fillStyle, x, y, w, h })
    },
    _rects: rects,
  } as unknown as CanvasRenderingContext2D & { _rects: FillCall[] }
  return ctx
}

// All-zero sprite → drawSprite emits exactly ONE fillRect (the paper background).
// That makes each drawn tile a single, position-checkable rect.
function makeTile(id: string | number): Tile {
  return { sprite: new Uint8Array(8), ink: C.B_WHITE, paper: C.BLACK, solid: true, id }
}

/** Returns only the 8×8 paper rects (one per drawn tile), as {x,y} pairs. */
function tilePositions(ctx: ReturnType<typeof makeMockCtx>) {
  return ctx._rects.filter(r => r.w === 8 && r.h === 8).map(r => ({ x: r.x, y: r.y }))
}

// ── tileMapWorldSize ──────────────────────────────────────────────────────────

describe('tileMapWorldSize', () => {
  it('returns pixel dimensions = tiles × CELL', () => {
    const map = createTileMap(32, 24)
    expect(tileMapWorldSize(map)).toEqual({ width: 256, height: 192 })
  })

  it('handles non-square maps', () => {
    const map = createTileMap(10, 3)
    expect(tileMapWorldSize(map)).toEqual({ width: 80, height: 24 })
  })
})

// ── drawTileMapAt — validation ────────────────────────────────────────────────

describe('drawTileMapAt — validation', () => {
  it('throws when viewW <= 0', () => {
    const ctx = makeMockCtx()
    const map = createTileMap(2, 2)
    expect(() => drawTileMapAt(ctx, map, 0, 0, 0, 192)).toThrow(/must be positive/)
  })

  it('throws when viewH <= 0', () => {
    const ctx = makeMockCtx()
    const map = createTileMap(2, 2)
    expect(() => drawTileMapAt(ctx, map, 0, 0, 256, -1)).toThrow(/must be positive/)
  })
})

// ── drawTileMapAt — placement ─────────────────────────────────────────────────

describe('drawTileMapAt — placement', () => {
  it('draws every populated tile at tileX×CELL, tileY×CELL when camera is at origin', () => {
    const ctx = makeMockCtx()
    const map = createTileMap(2, 2)
    map.fill(makeTile('rock'))
    drawTileMapAt(ctx, map, 0, 0, 16, 16)
    expect(tilePositions(ctx)).toEqual([
      { x: 0, y: 0 }, { x: 8, y: 0 },
      { x: 0, y: 8 }, { x: 8, y: 8 },
    ])
  })

  it('offsets tiles by an integer camera position', () => {
    const ctx = makeMockCtx()
    const map = createTileMap(2, 2)
    map.fill(makeTile('rock'))
    drawTileMapAt(ctx, map, 3, 0, 16, 16)
    // ox = 3 → x positions shift left by 3; partial left column has tx=0 at -3
    const xs = tilePositions(ctx).map(p => p.x)
    expect(xs).toContain(-3)   // tile column 0 at 0-3
    expect(xs).toContain(5)    // tile column 1 at 8-3
  })

  it('rounds a fractional camera position to the nearest pixel', () => {
    const ctx = makeMockCtx()
    const map = createTileMap(1, 1)
    map.fill(makeTile('rock'))
    drawTileMapAt(ctx, map, 2.6, 0, 8, 8)   // round(2.6) = 3
    expect(tilePositions(ctx)[0]!.x).toBe(-3)
  })

  it('skips empty (cleared) cells', () => {
    const ctx = makeMockCtx()
    const map = createTileMap(2, 1)
    map.fill(makeTile('rock'))
    map.clearTile(1, 0)
    drawTileMapAt(ctx, map, 0, 0, 16, 8)
    const pos = tilePositions(ctx)
    expect(pos).toHaveLength(1)
    expect(pos[0]).toEqual({ x: 0, y: 0 })
  })

  it('skips tiles left/above the world (negative tile indices)', () => {
    const ctx = makeMockCtx()
    const map = createTileMap(2, 2)
    map.fill(makeTile('rock'))
    // Camera at (-8,-8): startCol/Row = -1 → that overscan row/col is out of bounds and skipped.
    drawTileMapAt(ctx, map, -8, -8, 16, 16)
    const pos = tilePositions(ctx)
    // Only the 4 real tiles, shifted right/down by 8.
    expect(pos).toEqual([
      { x: 8, y: 8 }, { x: 16, y: 8 },
      { x: 8, y: 16 }, { x: 16, y: 16 },
    ])
  })

  it('skips tiles right/below the world when the view is larger than the map', () => {
    const ctx = makeMockCtx()
    const map = createTileMap(2, 2)
    map.fill(makeTile('rock'))
    // Large view over a tiny map → only the 4 in-bounds tiles are drawn.
    drawTileMapAt(ctx, map, 0, 0, 256, 192)
    expect(tilePositions(ctx)).toHaveLength(4)
  })

  it('draws one overscan column/row so a partially scrolled edge tile appears', () => {
    const ctx = makeMockCtx()
    const map = createTileMap(4, 1)
    map.fill(makeTile('rock'))
    // View 8px wide, camera at x=4 → shows part of tile 0 and part of tile 1.
    drawTileMapAt(ctx, map, 4, 0, 8, 8)
    const xs = tilePositions(ctx).map(p => p.x).sort((a, b) => a - b)
    expect(xs).toEqual([-4, 4])   // tile0 at 0-4, tile1 at 8-4
  })

  it('uses the tile paper colour for the background fill', () => {
    const ctx = makeMockCtx()
    const map = createTileMap(1, 1)
    map.fill(makeTile('rock'))
    drawTileMapAt(ctx, map, 0, 0, 8, 8)
    expect(ctx._rects[0]!.style).toBe(C.BLACK)
  })
})
