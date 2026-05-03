import { describe, it, expect } from 'vitest'
import { C, CELL } from './src/palette.js'
import { mirrorSprite } from './src/renderer.js'
import { createSprite, moveSprite, applyGravity } from './src/sprite.js'

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
