import { describe, it, expect } from 'vitest'
import { C, CELL } from './src/palette.js'
import { mirrorSprite } from './src/renderer.js'
import { createSprite, moveSprite, applyGravity, renderSprite } from './src/sprite.js'

const BM = new Uint8Array([0x18, 0x3C, 0x7E, 0xFF, 0xFF, 0x7E, 0x3C, 0x18])

// ── createSprite ──────────────────────────────────────────────────────────────

describe('createSprite — defaults', () => {
  it('starts at (0, 0)', () => {
    const s = createSprite(BM, C.B_CYAN)
    expect(s.x).toBe(0)
    expect(s.y).toBe(0)
  })

  it('starts with zero velocity', () => {
    const s = createSprite(BM, C.B_CYAN)
    expect(s.vx).toBe(0)
    expect(s.vy).toBe(0)
  })

  it('is visible by default', () => {
    expect(createSprite(BM, C.B_CYAN).visible).toBe(true)
  })

  it('flipX is false by default', () => {
    expect(createSprite(BM, C.B_CYAN).flipX).toBe(false)
  })

  it('paper defaults to null (transparent)', () => {
    expect(createSprite(BM, C.B_CYAN).paper).toBeNull()
  })

  it('stores provided ink', () => {
    expect(createSprite(BM, C.B_RED).ink).toBe(C.B_RED)
  })

  it('stores provided paper when given', () => {
    expect(createSprite(BM, C.B_CYAN, C.BLACK).paper).toBe(C.BLACK)
  })

  it('stores bitmap reference', () => {
    const s = createSprite(BM, C.B_CYAN)
    expect(s.bitmap).toBe(BM)
  })

  it('two sprites do not share state', () => {
    const a = createSprite(BM, C.B_CYAN)
    const b = createSprite(BM, C.B_WHITE)
    a.x = 10
    expect(b.x).toBe(0)
  })
})

// ── moveSprite ────────────────────────────────────────────────────────────────

describe('moveSprite — position update', () => {
  it('advances x by vx * dt', () => {
    const s = createSprite(BM, C.B_CYAN)
    s.vx = 0.1
    moveSprite(s, 100)
    expect(s.x).toBeCloseTo(10)
  })

  it('advances y by vy * dt', () => {
    const s = createSprite(BM, C.B_CYAN)
    s.vy = 0.05
    moveSprite(s, 200)
    expect(s.y).toBeCloseTo(10)
  })

  it('moves in negative direction', () => {
    const s = createSprite(BM, C.B_CYAN)
    s.x = 50
    s.vx = -0.2
    moveSprite(s, 100)
    expect(s.x).toBeCloseTo(30)
  })

  it('does not move when velocity is zero', () => {
    const s = createSprite(BM, C.B_CYAN)
    s.x = 32
    s.y = 16
    moveSprite(s, 100)
    expect(s.x).toBe(32)
    expect(s.y).toBe(16)
  })

  it('accumulates across multiple calls', () => {
    const s = createSprite(BM, C.B_CYAN)
    s.vx = 0.1
    moveSprite(s, 50)
    moveSprite(s, 50)
    expect(s.x).toBeCloseTo(10)
  })
})

// ── applyGravity ──────────────────────────────────────────────────────────────

describe('applyGravity — velocity accumulation', () => {
  it('increases vy by gravity * dt', () => {
    const s = createSprite(BM, C.B_CYAN)
    applyGravity(s, 0.003, 100)
    expect(s.vy).toBeCloseTo(0.3)
  })

  it('does not affect vx', () => {
    const s = createSprite(BM, C.B_CYAN)
    s.vx = 1
    applyGravity(s, 0.003, 100)
    expect(s.vx).toBe(1)
  })

  it('accumulates across frames', () => {
    const s = createSprite(BM, C.B_CYAN)
    applyGravity(s, 0.003, 100)
    applyGravity(s, 0.003, 100)
    expect(s.vy).toBeCloseTo(0.6)
  })

  it('works with zero dt', () => {
    const s = createSprite(BM, C.B_CYAN)
    applyGravity(s, 0.003, 0)
    expect(s.vy).toBe(0)
  })

  it('gravity + move: sprite falls faster each frame', () => {
    const s = createSprite(BM, C.B_CYAN)
    applyGravity(s, 0.003, 100)
    moveSprite(s, 100)
    const y1 = s.y

    applyGravity(s, 0.003, 100)
    moveSprite(s, 100)
    const dy2 = s.y - y1

    expect(dy2).toBeGreaterThan(y1) // second drop is larger than first
  })
})

// ── flipX — bitmap caching ────────────────────────────────────────────────────

describe('flipX — mirrored bitmap', () => {
  it('mirrorSprite produces a horizontally flipped bitmap', () => {
    const original = new Uint8Array([0b10000000, 0, 0, 0, 0, 0, 0, 0])
    const mirrored = mirrorSprite(original)
    expect(mirrored[0]).toBe(0b00000001)
  })

  it('double-mirror returns original bits', () => {
    const mirrored = mirrorSprite(BM)
    const restored = mirrorSprite(mirrored)
    for (let i = 0; i < 8; i++) expect(restored[i]).toBe(BM[i])
  })

  it('asymmetric bitmap mirrors correctly', () => {
    // Left column set: 0b11000000
    const bm = new Uint8Array(8).fill(0b11000000)
    const mirrored = mirrorSprite(bm)
    // After mirror: right two bits set → 0b00000011
    expect(mirrored[0]).toBe(0b00000011)
  })
})

// ── renderSprite ──────────────────────────────────────────────────────────────

function makeCtx() {
  let _fillStyle = ''
  const rects: Array<{ style: string; x: number; y: number; w: number; h: number }> = []
  return {
    get fillStyle() { return _fillStyle },
    set fillStyle(v: string) { _fillStyle = v },
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ style: _fillStyle, x, y, w, h })
    },
    _rects: rects,
  } as unknown as CanvasRenderingContext2D & { _rects: typeof rects }
}

const ALL_ON  = new Uint8Array(8).fill(0xFF)  // all 64 pixels set
const ALL_OFF = new Uint8Array(8)              // no pixels set
// Only bit 7 (leftmost pixel, column 0, row 0) is set:
const LEFT_PIX = new Uint8Array([0x80, 0, 0, 0, 0, 0, 0, 0])

describe('renderSprite — visibility', () => {
  it('does nothing when sprite.visible is false', () => {
    const ctx = makeCtx()
    const s = createSprite(ALL_ON, C.B_CYAN)
    s.visible = false
    renderSprite(ctx, s)
    expect(ctx._rects).toHaveLength(0)
  })

  it('renders when sprite.visible is true', () => {
    const ctx = makeCtx()
    const s = createSprite(LEFT_PIX, C.B_CYAN)
    s.visible = true
    renderSprite(ctx, s)
    expect(ctx._rects.length).toBeGreaterThan(0)
  })
})

describe('renderSprite — transparent background (paper=null)', () => {
  it('all-zero bitmap — no fillRect calls (no ink pixels)', () => {
    const ctx = makeCtx()
    const s = createSprite(ALL_OFF, C.B_CYAN)
    renderSprite(ctx, s)
    expect(ctx._rects).toHaveLength(0)
  })

  it('all-on bitmap — exactly 64 ink fillRects', () => {
    const ctx = makeCtx()
    const s = createSprite(ALL_ON, C.B_CYAN)
    renderSprite(ctx, s)
    expect(ctx._rects).toHaveLength(64)
  })

  it('uses sprite.ink as fillStyle for ink pixels', () => {
    const ctx = makeCtx()
    const s = createSprite(LEFT_PIX, C.B_RED)
    renderSprite(ctx, s)
    expect(ctx._rects[0].style).toBe(C.B_RED)
  })

  it('each ink fillRect is 1×1 pixel', () => {
    const ctx = makeCtx()
    const s = createSprite(LEFT_PIX, C.B_CYAN)
    renderSprite(ctx, s)
    expect(ctx._rects[0]).toMatchObject({ w: 1, h: 1 })
  })
})

describe('renderSprite — opaque background (paper set)', () => {
  it('all-zero bitmap — exactly 1 paper fillRect (CELL×CELL background)', () => {
    const ctx = makeCtx()
    const s = createSprite(ALL_OFF, C.B_CYAN, C.BLACK)
    renderSprite(ctx, s)
    expect(ctx._rects).toHaveLength(1)
    expect(ctx._rects[0]).toMatchObject({ style: C.BLACK, x: 0, y: 0, w: CELL, h: CELL })
  })

  it('all-on bitmap — 1 paper + 64 ink = 65 fillRects', () => {
    const ctx = makeCtx()
    const s = createSprite(ALL_ON, C.B_WHITE, C.BLACK)
    renderSprite(ctx, s)
    expect(ctx._rects).toHaveLength(65)
  })

  it('first fillRect is paper (background), uses paper color', () => {
    const ctx = makeCtx()
    const s = createSprite(ALL_ON, C.B_CYAN, C.B_BLUE)
    renderSprite(ctx, s)
    expect(ctx._rects[0].style).toBe(C.B_BLUE)
  })
})

describe('renderSprite — position rounding', () => {
  it('rounds x and y to nearest integer', () => {
    const ctx = makeCtx()
    const s = createSprite(LEFT_PIX, C.B_CYAN)
    s.x = 0.7  // Math.round(0.7) = 1
    s.y = 0.4  // Math.round(0.4) = 0
    renderSprite(ctx, s)
    // LEFT_PIX has 1 set pixel at column 0, row 0 → fillRect(x+0, y+0, 1, 1) = (1, 0, 1, 1)
    expect(ctx._rects[0]).toMatchObject({ x: 1, y: 0 })
  })

  it('rounds down for .4 fractions', () => {
    const ctx = makeCtx()
    const s = createSprite(LEFT_PIX, C.B_CYAN)
    s.x = 10.4
    renderSprite(ctx, s)
    expect(ctx._rects[0].x).toBe(10)
  })

  it('rounds up for .5+ fractions', () => {
    const ctx = makeCtx()
    const s = createSprite(LEFT_PIX, C.B_CYAN)
    s.x = 10.5
    renderSprite(ctx, s)
    expect(ctx._rects[0].x).toBe(11)
  })
})

describe('renderSprite — flipX', () => {
  it('flipX=false — pixel at column 0 renders at x+0', () => {
    const ctx = makeCtx()
    const s = createSprite(LEFT_PIX, C.B_CYAN)
    s.flipX = false
    renderSprite(ctx, s)
    expect(ctx._rects[0].x).toBe(0)
  })

  it('flipX=true — pixel originally at column 0 moves to column 7', () => {
    const ctx = makeCtx()
    const s = createSprite(LEFT_PIX, C.B_CYAN)
    s.flipX = true
    renderSprite(ctx, s)
    // Mirrored: leftmost pixel (bit 7) → rightmost position (column 7)
    expect(ctx._rects[0].x).toBe(7)
  })

  it('flipX=true returns same pixel count as flipX=false', () => {
    const ctxNormal  = makeCtx()
    const ctxFlipped = makeCtx()
    const s1 = createSprite(ALL_ON, C.B_CYAN); s1.flipX = false
    const s2 = createSprite(ALL_ON, C.B_CYAN); s2.flipX = true
    renderSprite(ctxNormal,  s1)
    renderSprite(ctxFlipped, s2)
    expect(ctxFlipped._rects).toHaveLength(ctxNormal._rects.length)
  })
})
