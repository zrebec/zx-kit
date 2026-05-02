import { describe, it, expect } from 'vitest'
import { C } from './src/palette.js'
import { createTileMap } from './src/tilemap.js'
import type { Tile, Viewport } from './src/tilemap.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const WALL: Tile = {
  sprite: new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]),
  ink: C.B_WHITE, paper: C.BLACK,
  solid: true, id: 'wall',
}
const FLOOR: Tile = {
  sprite: new Uint8Array(8),
  ink: C.BLACK, paper: C.GREEN,
  solid: false, id: 'floor',
}
const PLAYER: Tile = {
  sprite: new Uint8Array([0x18, 0x18, 0x3C, 0x66, 0x3C, 0x18, 0x3C, 0x66]),
  ink: C.B_CYAN, paper: C.BLACK,
  solid: false, id: 'player',
}
const GRASS: Tile = {
  sprite: new Uint8Array([0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA]),
  ink: C.GREEN, paper: C.BLACK,
  solid: false, id: 'grass',
}
const SNOW: Tile = {
  sprite: new Uint8Array(8).fill(0x55),
  ink: C.B_WHITE, paper: C.WHITE,
  solid: false, id: 'snow',
}
const NIGHT: Tile = {
  sprite: new Uint8Array(8),
  ink: C.BLACK, paper: C.BLACK,
  solid: false, id: 'night',
}
const EXIT: Tile = {
  sprite: new Uint8Array([0x3C, 0x42, 0x99, 0xA5, 0xA5, 0x99, 0x42, 0x3C]),
  ink: C.B_YELLOW, paper: C.BLACK,
  solid: false, id: 'exit',
  metadata: { nextLevel: 2 },
}

// Minimal mock for CanvasRenderingContext2D — records fillRect calls
function makeMockCtx() {
  const fillRects: Array<{ x: number; y: number; w: number; h: number }> = []
  let _fillStyle = ''
  const ctx = {
    get fillStyle() { return _fillStyle },
    set fillStyle(v: string) { _fillStyle = v },
    fillRect(x: number, y: number, w: number, h: number) {
      fillRects.push({ x, y, w, h })
    },
    _fillRects: fillRects,
  } as unknown as CanvasRenderingContext2D & { _fillRects: typeof fillRects }
  return ctx
}

// ── Dimensions ────────────────────────────────────────────────────────────────

describe('createTileMap — dimensions', () => {
  it('exposes cols and rows', () => {
    const map = createTileMap(10, 5)
    expect(map.cols).toBe(10)
    expect(map.rows).toBe(5)
  })

  it('cols and rows are readonly (assignment is a TS error — runtime check)', () => {
    const map = createTileMap(3, 3)
    expect(map.cols).toBe(3)
  })
})

// ── getTile / setTile ─────────────────────────────────────────────────────────

describe('getTile', () => {
  it('returns null for empty cells', () => {
    const map = createTileMap(4, 4)
    expect(map.getTile(0, 0)).toBeNull()
    expect(map.getTile(3, 3)).toBeNull()
  })

  it('returns null for out-of-bounds (never throws)', () => {
    const map = createTileMap(4, 4)
    expect(map.getTile(-1, 0)).toBeNull()
    expect(map.getTile(0, -1)).toBeNull()
    expect(map.getTile(4, 0)).toBeNull()
    expect(map.getTile(0, 4)).toBeNull()
    expect(map.getTile(99, 99)).toBeNull()
  })
})

describe('setTile', () => {
  it('stores and retrieves a tile', () => {
    const map = createTileMap(4, 4)
    map.setTile(2, 1, WALL)
    const t = map.getTile(2, 1)
    expect(t).not.toBeNull()
    expect(t!.id).toBe('wall')
    expect(t!.solid).toBe(true)
  })

  it('stores a shallow copy — mutating original does not affect stored tile', () => {
    const map = createTileMap(4, 4)
    const tile: Tile = { ...FLOOR }
    map.setTile(0, 0, tile)
    tile.id = 'mutated'
    expect(map.getTile(0, 0)!.id).toBe('floor')
  })

  it('silently ignores out-of-bounds writes', () => {
    const map = createTileMap(4, 4)
    expect(() => map.setTile(-1, 0, WALL)).not.toThrow()
    expect(() => map.setTile(4, 0, WALL)).not.toThrow()
    expect(() => map.setTile(0, -1, WALL)).not.toThrow()
    expect(() => map.setTile(0, 4, WALL)).not.toThrow()
  })

  it('overwrites an existing tile', () => {
    const map = createTileMap(4, 4)
    map.setTile(1, 1, WALL)
    map.setTile(1, 1, FLOOR)
    expect(map.getTile(1, 1)!.id).toBe('floor')
  })

  it('different positions get independent copies', () => {
    const map = createTileMap(4, 4)
    map.setTile(0, 0, FLOOR)
    map.setTile(1, 0, FLOOR)
    expect(map.getTile(0, 0)).not.toBe(map.getTile(1, 0))
  })
})

// ── clearTile ─────────────────────────────────────────────────────────────────

describe('clearTile', () => {
  it('removes a placed tile', () => {
    const map = createTileMap(4, 4)
    map.setTile(2, 2, WALL)
    map.clearTile(2, 2)
    expect(map.getTile(2, 2)).toBeNull()
  })

  it('silently ignores empty cells', () => {
    const map = createTileMap(4, 4)
    expect(() => map.clearTile(0, 0)).not.toThrow()
  })

  it('silently ignores out-of-bounds', () => {
    const map = createTileMap(4, 4)
    expect(() => map.clearTile(-1, 0)).not.toThrow()
    expect(() => map.clearTile(4, 4)).not.toThrow()
  })

  it('does not affect neighbouring cells', () => {
    const map = createTileMap(4, 4)
    map.setTile(1, 1, WALL)
    map.setTile(1, 2, FLOOR)
    map.clearTile(1, 1)
    expect(map.getTile(1, 1)).toBeNull()
    expect(map.getTile(1, 2)!.id).toBe('floor')
  })
})

// ── fill ──────────────────────────────────────────────────────────────────────

describe('fill', () => {
  it('fills every cell', () => {
    const map = createTileMap(3, 2)
    map.fill(FLOOR)
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 3; x++) {
        expect(map.getTile(x, y)!.id).toBe('floor')
      }
    }
  })

  it('each cell is an independent shallow copy', () => {
    const map = createTileMap(2, 2)
    map.fill(FLOOR)
    const t00 = map.getTile(0, 0)
    const t11 = map.getTile(1, 1)
    expect(t00).not.toBe(t11)
    expect(t00!.id).toBe(t11!.id)
  })

  it('overwrites previously placed tiles', () => {
    const map = createTileMap(3, 3)
    map.setTile(1, 1, WALL)
    map.fill(FLOOR)
    expect(map.getTile(1, 1)!.id).toBe('floor')
  })
})

// ── fillRect ──────────────────────────────────────────────────────────────────

describe('fillRect', () => {
  it('fills a rectangle', () => {
    const map = createTileMap(6, 6)
    map.fillRect(1, 1, 3, 2, WALL)
    expect(map.getTile(1, 1)!.id).toBe('wall')
    expect(map.getTile(2, 1)!.id).toBe('wall')
    expect(map.getTile(3, 1)!.id).toBe('wall')
    expect(map.getTile(1, 2)!.id).toBe('wall')
    expect(map.getTile(3, 2)!.id).toBe('wall')
  })

  it('does not fill outside the rectangle', () => {
    const map = createTileMap(6, 6)
    map.fillRect(1, 1, 3, 2, WALL)
    expect(map.getTile(0, 0)).toBeNull()
    expect(map.getTile(4, 1)).toBeNull()
    expect(map.getTile(1, 3)).toBeNull()
  })

  it('clips to map boundaries — no throws', () => {
    const map = createTileMap(4, 4)
    expect(() => map.fillRect(-2, -2, 10, 10, WALL)).not.toThrow()
    expect(map.getTile(0, 0)!.id).toBe('wall')
    expect(map.getTile(3, 3)!.id).toBe('wall')
  })

  it('each cell in rect is an independent copy', () => {
    const map = createTileMap(3, 1)
    map.fillRect(0, 0, 3, 1, FLOOR)
    expect(map.getTile(0, 0)).not.toBe(map.getTile(1, 0))
    expect(map.getTile(1, 0)).not.toBe(map.getTile(2, 0))
  })
})

// ── isSolid ───────────────────────────────────────────────────────────────────

describe('isSolid', () => {
  it('returns true for solid tiles', () => {
    const map = createTileMap(4, 4)
    map.setTile(1, 1, WALL)
    expect(map.isSolid(1, 1)).toBe(true)
  })

  it('returns false for non-solid tiles', () => {
    const map = createTileMap(4, 4)
    map.setTile(1, 1, FLOOR)
    expect(map.isSolid(1, 1)).toBe(false)
  })

  it('returns false for empty cells (no tile = passable void)', () => {
    const map = createTileMap(4, 4)
    expect(map.isSolid(0, 0)).toBe(false)
  })

  it('returns true for out-of-bounds (map boundary is implicitly solid)', () => {
    const map = createTileMap(4, 4)
    expect(map.isSolid(-1, 0)).toBe(true)
    expect(map.isSolid(4, 0)).toBe(true)
    expect(map.isSolid(0, -1)).toBe(true)
    expect(map.isSolid(0, 4)).toBe(true)
  })
})

// ── findById ──────────────────────────────────────────────────────────────────

describe('findById', () => {
  it('returns empty array when no tiles match', () => {
    const map = createTileMap(4, 4)
    expect(map.findById('ghost')).toEqual([])
  })

  it('finds a single tile with correct coordinates', () => {
    const map = createTileMap(8, 8)
    map.setTile(5, 3, EXIT)
    const results = map.findById('exit')
    expect(results).toHaveLength(1)
    expect(results[0].x).toBe(5)
    expect(results[0].y).toBe(3)
    expect(results[0].tile.id).toBe('exit')
  })

  it('finds multiple tiles with the same id', () => {
    const map = createTileMap(8, 8)
    map.setTile(0, 0, WALL)
    map.setTile(1, 0, WALL)
    map.setTile(2, 0, WALL)
    const results = map.findById('wall')
    expect(results).toHaveLength(3)
    const coords = results.map(r => `${r.x},${r.y}`).sort()
    expect(coords).toEqual(['0,0', '1,0', '2,0'])
  })

  it('updates after clearTile removes a tile', () => {
    const map = createTileMap(4, 4)
    map.setTile(1, 1, WALL)
    map.setTile(2, 2, WALL)
    map.clearTile(1, 1)
    const results = map.findById('wall')
    expect(results).toHaveLength(1)
    expect(results[0].x).toBe(2)
    expect(results[0].y).toBe(2)
  })

  it('updates when tile is overwritten with a different id', () => {
    const map = createTileMap(4, 4)
    map.setTile(0, 0, WALL)
    map.setTile(0, 0, FLOOR)
    expect(map.findById('wall')).toHaveLength(0)
    expect(map.findById('floor')).toHaveLength(1)
  })

  it('updates after fill clears old id', () => {
    const map = createTileMap(2, 2)
    map.setTile(0, 0, WALL)
    map.fill(FLOOR)
    expect(map.findById('wall')).toHaveLength(0)
    expect(map.findById('floor')).toHaveLength(4)
  })

  it('updates after fillRect', () => {
    const map = createTileMap(4, 4)
    map.fill(GRASS)
    map.fillRect(1, 1, 2, 2, WALL)
    expect(map.findById('wall')).toHaveLength(4)
    expect(map.findById('grass')).toHaveLength(12)
  })

  it('returns tile object matching getTile', () => {
    const map = createTileMap(4, 4)
    map.setTile(2, 3, EXIT)
    const found = map.findById('exit')[0]
    expect(found.tile).toBe(map.getTile(2, 3))
  })

  it('handles numeric id', () => {
    const numTile: Tile = { ...FLOOR, id: 42 }
    const map = createTileMap(4, 4)
    map.setTile(0, 0, numTile)
    expect(map.findById(42)).toHaveLength(1)
    expect(map.findById('42')).toHaveLength(0)
  })
})

// ── setBackground ─────────────────────────────────────────────────────────────

describe('setBackground — first call', () => {
  it('does not modify the map', () => {
    const map = createTileMap(3, 3)
    map.setBackground(GRASS)
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        expect(map.getTile(x, y)).toBeNull()
      }
    }
  })

  it('does not add anything to findById', () => {
    const map = createTileMap(3, 3)
    map.setBackground(GRASS)
    expect(map.findById('grass')).toHaveLength(0)
  })
})

describe('setBackground — smart swap', () => {
  it('replaces all cells matching old background id', () => {
    const map = createTileMap(3, 2)
    map.fill(GRASS)
    map.setBackground(GRASS)
    map.setBackground(SNOW)
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 3; x++) {
        expect(map.getTile(x, y)!.id).toBe('snow')
      }
    }
  })

  it('leaves non-background tiles untouched', () => {
    const map = createTileMap(4, 4)
    map.fill(GRASS)
    map.setBackground(GRASS)
    map.setTile(1, 1, PLAYER)
    map.setTile(2, 2, WALL)
    map.setBackground(SNOW)
    expect(map.getTile(0, 0)!.id).toBe('snow')
    expect(map.getTile(1, 1)!.id).toBe('player')
    expect(map.getTile(2, 2)!.id).toBe('wall')
  })

  it('chained swaps — each swap matches only the previous background id', () => {
    const map = createTileMap(3, 1)
    map.fill(GRASS)
    map.setBackground(GRASS)
    map.setBackground(SNOW)  // grass → snow
    map.setTile(2, 0, PLAYER)
    map.setBackground(NIGHT) // snow → night (player untouched)
    expect(map.getTile(0, 0)!.id).toBe('night')
    expect(map.getTile(1, 0)!.id).toBe('night')
    expect(map.getTile(2, 0)!.id).toBe('player')
  })

  it('each swapped cell is a fresh shallow copy — not the same object', () => {
    const map = createTileMap(2, 1)
    map.fill(GRASS)
    map.setBackground(GRASS)
    map.setBackground(SNOW)
    const t0 = map.getTile(0, 0)
    const t1 = map.getTile(1, 0)
    expect(t0).not.toBe(t1)
    expect(t0!.id).toBe('snow')
    expect(t1!.id).toBe('snow')
  })

  it('updates findById — old id gone, new id present', () => {
    const map = createTileMap(3, 1)
    map.fill(GRASS)
    map.setBackground(GRASS)
    map.setBackground(SNOW)
    expect(map.findById('grass')).toHaveLength(0)
    expect(map.findById('snow')).toHaveLength(3)
  })

  it('only partially-surviving background tiles count after placing objects', () => {
    const map = createTileMap(4, 1)
    map.fill(GRASS)
    map.setBackground(GRASS)
    map.setTile(0, 0, PLAYER)   // overwrites grass at (0,0)
    map.setTile(1, 0, WALL)     // overwrites grass at (1,0)
    map.setBackground(SNOW)
    // Only cells (2,0) and (3,0) had grass → become snow
    expect(map.getTile(0, 0)!.id).toBe('player')
    expect(map.getTile(1, 0)!.id).toBe('wall')
    expect(map.getTile(2, 0)!.id).toBe('snow')
    expect(map.getTile(3, 0)!.id).toBe('snow')
    expect(map.findById('snow')).toHaveLength(2)
  })
})

// ── render ────────────────────────────────────────────────────────────────────

describe('render', () => {
  it('does not throw on an empty map', () => {
    const map = createTileMap(4, 4)
    const ctx = makeMockCtx()
    expect(() => map.render(ctx)).not.toThrow()
    expect(ctx._fillRects).toHaveLength(0)
  })

  it('calls fillRect for each non-null tile (at least the paper rect)', () => {
    const map = createTileMap(4, 4)
    map.setTile(0, 0, WALL)
    map.setTile(2, 3, FLOOR)
    const ctx = makeMockCtx()
    map.render(ctx)
    // Each drawSprite call fills at least the paper rect (1 fillRect per tile minimum)
    expect(ctx._fillRects.length).toBeGreaterThanOrEqual(2)
  })

  it('skips null cells — fewer fillRect calls on a sparse map', () => {
    const mapFull = createTileMap(4, 4)
    mapFull.fill(WALL)
    const mapSparse = createTileMap(4, 4)
    mapSparse.setTile(0, 0, WALL)

    const ctxFull = makeMockCtx()
    const ctxSparse = makeMockCtx()
    mapFull.render(ctxFull)
    mapSparse.render(ctxSparse)

    expect(ctxSparse._fillRects.length).toBeLessThan(ctxFull._fillRects.length)
  })

  it('full map without viewport renders all cells', () => {
    const map = createTileMap(2, 2)
    // All-zero sprite: drawSprite calls only the paper fillRect per tile
    const BLANK: Tile = { sprite: new Uint8Array(8), ink: C.BLACK, paper: C.B_WHITE, solid: false, id: 't' }
    map.fill(BLANK)
    const ctx = makeMockCtx()
    map.render(ctx)
    // 2×2 = 4 tiles, each produces exactly 1 paper fillRect (all sprite bits are 0)
    expect(ctx._fillRects).toHaveLength(4)
  })

  it('viewport limits rendering to visible tiles only', () => {
    const map = createTileMap(8, 8)
    map.fill(WALL)
    const ctxFull = makeMockCtx()
    const ctxVP = makeMockCtx()
    const viewport: Viewport = { x: 0, y: 0, cols: 2, rows: 2 }
    map.render(ctxFull)
    map.render(ctxVP, viewport)
    expect(ctxVP._fillRects.length).toBeLessThan(ctxFull._fillRects.length)
  })

  it('canvas position: tileX within viewport → canvasX = (tileX - vpX) * CELL', () => {
    const CELL = 8
    const map = createTileMap(10, 10)
    // All-zero sprite → exactly 1 fillRect per tile (paper only)
    const BLANK: Tile = { sprite: new Uint8Array(8), ink: C.BLACK, paper: C.B_WHITE, solid: false, id: 't' }
    map.setTile(5, 3, BLANK)

    const ctx = makeMockCtx()
    const viewport: Viewport = { x: 3, y: 1, cols: 8, rows: 8 }
    map.render(ctx, viewport)

    // tileX=5, vpX=3 → canvasX=(5-3)*8=16; tileY=3, vpY=1 → canvasY=(3-1)*8=16
    expect(ctx._fillRects).toHaveLength(1)
    expect(ctx._fillRects[0]).toEqual({ x: 16, y: 16, w: CELL, h: CELL })
  })

  it('tiles outside viewport are not rendered', () => {
    const map = createTileMap(10, 10)
    map.setTile(0, 0, WALL)   // outside viewport
    map.setTile(9, 9, WALL)   // outside viewport
    map.setTile(5, 5, WALL)   // inside viewport

    const ctx = makeMockCtx()
    const viewport: Viewport = { x: 4, y: 4, cols: 4, rows: 4 }
    map.render(ctx, viewport)

    // Only the tile at (5,5) is within viewport — produces at least 1 fillRect
    // Tiles at (0,0) and (9,9) are outside — not rendered
    expect(ctx._fillRects.length).toBeGreaterThan(0)
    // Verify paper rect for (5,5): canvasX=(5-4)*8=8, canvasY=(5-4)*8=8
    expect(ctx._fillRects[0]).toMatchObject({ x: 8, y: 8 })
  })
})

// ── Boulder Dash integration scenario ─────────────────────────────────────────

describe('Boulder Dash integration', () => {
  const GEM: Tile = {
    sprite: new Uint8Array([0x18, 0x3C, 0x7E, 0xFF, 0xFF, 0x7E, 0x3C, 0x18]),
    ink: C.B_CYAN, paper: C.BLACK,
    solid: false, id: 'gem',
    metadata: { points: 10 },
  }
  const ROCK: Tile = {
    sprite: new Uint8Array([0x3C, 0x7E, 0xFF, 0xFF, 0xFF, 0xFF, 0x7E, 0x3C]),
    ink: C.WHITE, paper: C.BLACK,
    solid: true, id: 'rock',
  }

  it('full level setup — collision, collection, seasonal swap', () => {
    const map = createTileMap(16, 8)

    // Background
    map.fill(GRASS)
    map.setBackground(GRASS)

    // Perimeter walls
    map.fillRect(0, 0, 16, 1, WALL)
    map.fillRect(0, 7, 16, 1, WALL)
    map.fillRect(0, 0, 1, 8, WALL)
    map.fillRect(15, 0, 1, 8, WALL)

    // Objects
    map.setTile(5, 3, GEM)
    map.setTile(10, 5, GEM)
    map.setTile(7, 4, ROCK)
    map.setTile(14, 6, EXIT)

    // Player cannot move through wall or rock
    expect(map.isSolid(0, 0)).toBe(true)   // wall
    expect(map.isSolid(7, 4)).toBe(true)   // rock
    expect(map.isSolid(5, 3)).toBe(false)  // gem — passable
    expect(map.isSolid(8, 4)).toBe(false)  // grass — passable

    // Collecting gems
    expect(map.findById('gem')).toHaveLength(2)
    map.clearTile(5, 3)
    expect(map.findById('gem')).toHaveLength(1)

    // Seasonal swap — walls, rocks, gems, exit untouched
    map.setBackground(SNOW)
    expect(map.getTile(0, 0)!.id).toBe('wall')   // wall — untouched
    expect(map.getTile(7, 4)!.id).toBe('rock')   // rock — untouched
    expect(map.getTile(10, 5)!.id).toBe('gem')   // gem — untouched
    expect(map.getTile(14, 6)!.id).toBe('exit')  // exit — untouched
    // Inner grass cells → snow
    expect(map.getTile(8, 4)!.id).toBe('snow')

    // Exit detection
    const exits = map.findById('exit')
    expect(exits).toHaveLength(1)
    expect(exits[0].x).toBe(14)
    expect(exits[0].y).toBe(6)
    expect(exits[0].tile.metadata?.['nextLevel']).toBe(2)
  })
})
