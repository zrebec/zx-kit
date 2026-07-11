import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import {
  AYChipCore, AYDumpPlayer, parsePSG, renderAYDump, playAYDump,
  _buildAYDumpWorkletSource, AY_MACHINE,
} from '../src/aydump.js'
import type { AYChipCore as AYChipCoreType } from '../src/aydump.js'
import { AY_VOL, AY_CLOCK } from '../src/ay.js'

// ── Helpers ──────────────────────────────────────────────────────────────────────

/** A minimal valid PSG: 16-byte header + two frames. */
function tinyPsg(): Uint8Array {
  return Uint8Array.from([
    0x50, 0x53, 0x47, 0x1A, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // "PSG\x1a" + padding
    0xFF, 0x00, 0x10, 0x07, 0x3E, 0x08, 0x0F,                    // frame0: R0=0x10, R7=0x3E, R8=15
    0xFF, 0x00, 0x20,                                            // frame1: R0=0x20
  ])
}

/**
 * A deterministic multi-frame 3-voice arpeggio PSG, built in memory — a real
 * multi-minute register dump with **no third-party content** (this is a zx-kit
 * test; nothing foreign, live or not, belongs in the repo).
 */
function synthPsg(frames: number): Uint8Array {
  const out: number[] = [
    0x50, 0x53, 0x47, 0x1A, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // "PSG\x1a" + padding
  ]
  const aP = [239, 179, 142, 119] // channel A tone periods (all < 256 → coarse stays 0)
  const bP = [200, 150, 240, 160] // channel B
  const cP = [120, 160, 100, 190] // channel C
  for (let f = 0; f < frames; f++) {
    out.push(0xFF)                       // open frame f
    if (f === 0) {
      out.push(7, 0x38)                  // mixer: tones A/B/C on, noise off
      out.push(1, 0, 3, 0, 5, 0)         // coarse periods = 0
      out.push(8, 13, 9, 12, 10, 11)     // channel volumes
    }
    out.push(0, aP[f % aP.length], 2, bP[f % bP.length], 4, cP[f % cP.length])
  }
  return Uint8Array.from(out)
}

/** Count rising zero-crossings (≈ frequency in Hz for a 1-second buffer). */
function risingCrossings(buf: Float32Array): number {
  let n = 0
  for (let i = 1; i < buf.length; i++) if (buf[i - 1] <= 0 && buf[i] > 0) n++
  return n
}

/** A pure 1-second tone on channel A at the given clock. */
function renderTone(clockHz: number, tp: number): Float32Array {
  const chip = new AYChipCore(44100, clockHz, 16, AY_VOL, 'mono')
  chip.setRegister(0, tp & 0xFF)          // R0 fine
  chip.setRegister(1, (tp >> 8) & 0x0F)   // R1 coarse
  chip.setRegister(7, 0x3E)               // tone A on, everything else off
  chip.setRegister(8, 15)                 // channel A full volume
  const left = new Float32Array(44100)
  const right = new Float32Array(44100)
  chip.renderInto(left, right, 0, 44100)
  return left
}

// ── parsePSG (§4.4) ────────────────────────────────────────────────────────────────

describe('parsePSG', () => {
  it('parses header and register pairs into frames', () => {
    const d = parsePSG(tinyPsg())
    expect(d.frameRateHz).toBe(50)
    expect(d.frameCount).toBe(2)
    expect(Array.from(d.writeRegs)).toEqual([0, 7, 8, 0])
    expect(Array.from(d.writeVals)).toEqual([0x10, 0x3E, 0x0F, 0x20])
    expect(Array.from(d.frameOffsets)).toEqual([0, 3, 4])
    expect(d.frameOffsets[d.frameCount]).toBe(d.writeRegs.length)
  })

  it('rejects a bad header', () => {
    const bad = tinyPsg()
    bad[3] = 0x00
    expect(() => parsePSG(bad)).toThrow(/bad header/)
    expect(() => parsePSG(Uint8Array.from([0x50, 0x53]))).toThrow(/bad header/)
  })

  it('expands 0xFE runs into n×4 empty frames', () => {
    const bytes = Uint8Array.from([
      0x50, 0x53, 0x47, 0x1A, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0xFF, 0x00, 0x01,   // frame0: R0=1
      0xFE, 0x02,         // 2×4 = 8 empty frames
      0xFF,               // one more frame
    ])
    const d = parsePSG(bytes)
    expect(d.frameCount).toBe(1 + 8 + 1)
    expect(Array.from(d.writeVals)).toEqual([1])            // only frame0 wrote
    expect(d.frameOffsets[1]).toBe(1)                       // empty frames are zero-length
    expect(d.frameOffsets[9]).toBe(1)
  })

  it('stops at 0xFD (end of song)', () => {
    const bytes = Uint8Array.from([
      0x50, 0x53, 0x47, 0x1A, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0xFF, 0x00, 0x01,
      0xFD,               // end
      0xFF, 0x00, 0x02,   // ignored
    ])
    const d = parsePSG(bytes)
    expect(d.frameCount).toBe(1)
    expect(Array.from(d.writeVals)).toEqual([1])
  })

  it('skips foreign-device writes (0x10..0xFC)', () => {
    const bytes = Uint8Array.from([
      0x50, 0x53, 0x47, 0x1A, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0xFF, 0x10, 0xAA, 0x00, 0x05,   // frame0: foreign reg skipped, then R0=5
    ])
    const d = parsePSG(bytes)
    expect(d.frameCount).toBe(1)
    expect(Array.from(d.writeRegs)).toEqual([0])
    expect(Array.from(d.writeVals)).toEqual([5])
  })

  it('throws on a truncated register pair', () => {
    const bytes = Uint8Array.from([
      0x50, 0x53, 0x47, 0x1A, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0xFF, 0x00,   // R0 with no value
    ])
    expect(() => parsePSG(bytes)).toThrow(/truncated register pair/)
  })

  it('throws on a truncated 0xFE run', () => {
    const bytes = Uint8Array.from([
      0x50, 0x53, 0x47, 0x1A, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0xFF, 0xFE,   // 0xFE with no count
    ])
    expect(() => parsePSG(bytes)).toThrow(/truncated 0xFE/)
  })
})

// ── AYChipCore — tone (§4.8.2) ───────────────────────────────────────────────────

describe('AYChipCore tone', () => {
  it('produces ≈440 Hz for TP=252 at the ZX 128K clock', () => {
    // TP = clock / (16 × f); 1773400 / (16 × 440) ≈ 252 → f ≈ 439.8 Hz.
    const tone = renderTone(AY_CLOCK, 252)
    expect(risingCrossings(tone)).toBeGreaterThanOrEqual(435)
    expect(risingCrossings(tone)).toBeLessThanOrEqual(445)
  })
})

// ── AYChipCore — noise LFSR (§4.8.3) ─────────────────────────────────────────────

describe('AYChipCore noise LFSR', () => {
  it('locks the 17-bit sequence (feedback = bit0 XOR bit3)', () => {
    const chip = new AYChipCore(44100, AY_CLOCK, 16, AY_VOL, 'mono')
    // Regression lock: these exact bits were computed independently from the seed=1
    // LFSR with the bit0^bit3 tap. A wrong tap (e.g. >>2) diverges by index 30.
    const expected = [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0,
      0, 1, 0, 0, 0, 0, 0, 0,
    ]
    expect(chip._stepNoiseForTest(expected.length)).toEqual(expected)
  })
})

// ── AYChipCore — envelope (§4.8.4) ───────────────────────────────────────────────

describe('AYChipCore envelope', () => {
  it('shape 13 (/‾) rises then holds at 15', () => {
    const chip = new AYChipCore(44100, AY_CLOCK, 16, AY_VOL, 'mono')
    chip.setRegister(13, 13)
    const levels = chip._stepEnvelopeForTest(20)
    expect(levels.slice(0, 15)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
    expect(levels.slice(15).every((v) => v === 15)).toBe(true)
  })

  it('shape 10 (\\/\\/) falls then rises (triangle)', () => {
    const chip = new AYChipCore(44100, AY_CLOCK, 16, AY_VOL, 'mono')
    chip.setRegister(13, 10)
    const levels = chip._stepEnvelopeForTest(20)
    expect(levels[0]).toBe(14)   // started at 15, first step → 14
    expect(levels[14]).toBe(0)   // bottom of the ramp
    expect(levels[19]).toBeGreaterThan(levels[16]) // climbing back up
  })

  it('writing R13 restarts the envelope', () => {
    const chip = new AYChipCore(44100, AY_CLOCK, 16, AY_VOL, 'mono')
    chip.setRegister(13, 13)
    chip._stepEnvelopeForTest(5)          // advance mid-ramp
    chip.setRegister(13, 13)              // restart
    expect(chip._stepEnvelopeForTest(1)[0]).toBe(1)  // back to the start of the rise
  })
})

// ── AYChipCore — mixer (§4.8.5) ──────────────────────────────────────────────────

describe('AYChipCore mixer', () => {
  it('is silent when everything is disabled (R7=0x3F) at zero volume', () => {
    const chip = new AYChipCore(44100, AY_CLOCK, 16, AY_VOL, 'mono')
    chip.setRegister(7, 0x3F)   // all tone + noise disabled; volumes default 0
    const left = new Float32Array(1000)
    const right = new Float32Array(1000)
    chip.renderInto(left, right, 0, 1000)
    let maxAbs = 0
    for (let i = 0; i < left.length; i++) maxAbs = Math.max(maxAbs, Math.abs(left[i]))
    expect(maxAbs).toBeLessThan(1e-6)
  })
})

// ── AYDumpPlayer (§4.8.6) ────────────────────────────────────────────────────────

interface Applied { pos: number; reg: number; val: number }

class SpyChip {
  pos = 0
  writes: Applied[] = []
  setRegister(reg: number, val: number): void { this.writes.push({ pos: this.pos, reg, val }) }
  renderInto(_l: Float32Array, _r: Float32Array, _o: number, count: number): void { this.pos += count }
  reset(): void { this.pos = 0 }
}

/** Three frames, one write each: R0 = 1, 2, 3. */
function threeFrameDump(): { wr: Uint8Array; wv: Uint8Array; fo: Uint32Array } {
  return {
    wr: Uint8Array.from([0, 0, 0]),
    wv: Uint8Array.from([1, 2, 3]),
    fo: Uint32Array.from([0, 1, 2, 3]),
  }
}

describe('AYDumpPlayer', () => {
  it('applies each frame on the right sample boundary', () => {
    const spy = new SpyChip()
    const { wr, wv, fo } = threeFrameDump()
    const player = new AYDumpPlayer(spy as unknown as AYChipCoreType, wr, wv, fo, 50, 44100, false, 0)
    player.render(new Float32Array(882 * 3), new Float32Array(882 * 3))
    expect(spy.writes).toEqual([
      { pos: 0,    reg: 0, val: 1 },
      { pos: 882,  reg: 0, val: 2 },
      { pos: 1764, reg: 0, val: 3 },
    ])
  })

  it('wraps to loopFrame after the last frame', () => {
    const spy = new SpyChip()
    const { wr, wv, fo } = threeFrameDump()
    const player = new AYDumpPlayer(spy as unknown as AYChipCoreType, wr, wv, fo, 50, 44100, true, 1)
    player.render(new Float32Array(882 * 4), new Float32Array(882 * 4))
    expect(spy.writes.map((w) => w.val)).toEqual([1, 2, 3, 2]) // ...then back to frame 1
  })

  it('reports ended after the last frame without looping', () => {
    const spy = new SpyChip()
    const wr = Uint8Array.from([0, 0])
    const wv = Uint8Array.from([1, 2])
    const fo = Uint32Array.from([0, 1, 2])
    const player = new AYDumpPlayer(spy as unknown as AYChipCoreType, wr, wv, fo, 50, 44100, false, 0)
    const buf = new Float32Array(882 * 3)
    expect(player.render(buf, new Float32Array(882 * 3))).toBe(true)
    expect(player.render(new Float32Array(64), new Float32Array(64))).toBe(true)
  })

  it('seekToFrame replays writes without rendering', () => {
    const spy = new SpyChip()
    const { wr, wv, fo } = threeFrameDump()
    const player = new AYDumpPlayer(spy as unknown as AYChipCoreType, wr, wv, fo, 50, 44100, false, 0)
    player.seekToFrame(2)
    expect(spy.writes.map((w) => w.val)).toEqual([1, 2]) // frames 0,1 replayed at pos 0
    expect(spy.writes.every((w) => w.pos === 0)).toBe(true)
    player.render(new Float32Array(882), new Float32Array(882))
    expect(spy.writes.map((w) => w.val)).toEqual([1, 2, 3]) // then frame 2 on resume
  })
})

// ── renderAYDump — determinism + clock variants (§4.8.7 / §4.8.8) ─────────────────

describe('renderAYDump', () => {
  it('is deterministic (byte-identical repeats)', () => {
    const d = parsePSG(tinyPsg())
    const a = renderAYDump(d, { maxSeconds: 0.2 })
    const b = renderAYDump(d, { maxSeconds: 0.2 })
    expect(a.left).toEqual(b.left)
    expect(a.right).toEqual(b.right)
  })

  it('Melodik (1.75 MHz) plays lower than ZX128 (1.7734 MHz)', () => {
    const zx  = risingCrossings(renderTone(1_773_400, 252))
    const mel = risingCrossings(renderTone(1_750_000, 252))
    expect(mel).toBeLessThan(zx)
    expect(mel / zx).toBeCloseTo(1_750_000 / 1_773_400, 2) // ≈ 0.9868
  })
})

// ── Synthetic multi-frame PSG (pure zx-kit — no third-party content) ──────────────

describe('synthetic multi-frame PSG', () => {
  const dump = parsePSG(synthPsg(6000)) // ~120 s @ 50 Hz, 3-voice arpeggio

  it('parses a long multi-frame dump', () => {
    expect(dump.frameRateHz).toBe(50)
    expect(dump.frameCount).toBe(6000)
    expect(dump.writeRegs.length).toBe(dump.writeVals.length)
    expect(dump.writeRegs.length).toBeGreaterThan(15_000)
    expect(dump.frameOffsets.length).toBe(dump.frameCount + 1)
    expect(dump.frameOffsets[dump.frameCount]).toBe(dump.writeRegs.length)
  })

  it('renders real, bounded, non-silent stereo audio (Melodik preset)', () => {
    const { left, right } = renderAYDump(dump, { maxSeconds: 3, ...AY_MACHINE.melodik })
    let maxAbs = 0
    let nan = false
    let energyL = 0
    let energyR = 0
    for (let i = 0; i < left.length; i++) {
      const a = Math.abs(left[i])
      if (a > maxAbs) maxAbs = a
      energyL += left[i] * left[i]
      energyR += right[i] * right[i]
      if (Number.isNaN(left[i]) || Number.isNaN(right[i])) nan = true
    }
    expect(nan).toBe(false)
    expect(maxAbs).toBeGreaterThan(0.01)    // actual sound, not silence
    expect(maxAbs).toBeLessThanOrEqual(1.0) // no clipping past full-scale
    expect(energyL).not.toBe(energyR)       // ACB stereo → L and R differ
  })
})

// ── Web Audio bridge (mocked) ────────────────────────────────────────────────────

let lastNode: MockNode | null = null

class MockPort {
  postMessage = vi.fn()
  onmessage: ((e: { data: unknown }) => void) | null = null
}
class MockNode {
  port = new MockPort()
  connect = vi.fn()
  disconnect = vi.fn()
  constructor(public ctx: unknown, public name: string, public opts: unknown) { lastNode = this }
}
class MockGain {
  gain = { value: 1 }
  connect = vi.fn()
  disconnect = vi.fn()
}
const addModule = vi.fn(async () => {})
class MockAudioContext {
  sampleRate = 44100
  currentTime = 0
  destination = {}
  state = 'running'
  audioWorklet = { addModule }
  createGain(): MockGain { return new MockGain() }
}

describe('playAYDump (mocked Web Audio)', () => {
  beforeAll(() => {
    vi.stubGlobal('AudioContext', MockAudioContext)
    vi.stubGlobal('AudioWorkletNode', MockNode)
    ;(globalThis.URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:mock')
    ;(globalThis.URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn()
  })
  afterAll(() => { vi.unstubAllGlobals() })

  it('registers the worklet, wires node → gain → master, and loads the dump', async () => {
    const dump = parsePSG(tinyPsg())
    const handle = await playAYDump(dump, { volume: 0.5, loop: true })

    expect(addModule).toHaveBeenCalled()
    expect(lastNode).not.toBeNull()
    expect(lastNode!.connect).toHaveBeenCalled()         // node → gain

    const post = lastNode!.port.postMessage
    const [msg, transfer] = post.mock.calls[0] as [Record<string, unknown>, ArrayBuffer[]]
    expect(msg.type).toBe('load')
    expect(msg.loop).toBe(true)
    expect(transfer).toHaveLength(3)                     // three transferable buffers

    // The caller's dump must survive the transfer (we copy before transferring).
    expect(dump.writeRegs.length).toBeGreaterThan(0)

    expect(handle.playing).toBe(true)
    let ended = false
    handle.onEnded = () => { ended = true }
    lastNode!.port.onmessage!({ data: { type: 'ended' } })
    expect(handle.playing).toBe(false)
    expect(ended).toBe(true)
  })

  it('handle.setStereo posts a message; stop() detaches', async () => {
    const handle = await playAYDump(parsePSG(tinyPsg()))
    handle.setStereo('abc')
    expect(lastNode!.port.postMessage).toHaveBeenCalledWith({ type: 'stereo', mode: 'abc' })
    handle.setVolume(0.25)
    handle.pause()
    handle.resume()
    handle.stop()
    expect(lastNode!.disconnect).toHaveBeenCalled()
    expect(handle.playing).toBe(false)
  })
})

// ── Worklet-source self-containment guard (§8.2) ─────────────────────────────────

interface WorkletProc {
  port: { postMessage(m?: unknown): void; onmessage: ((e: { data: unknown }) => void) | null }
  process(inputs: unknown[], outputs: Float32Array[][]): boolean
}

describe('_buildAYDumpWorkletSource', () => {
  it('is self-contained (no imports, no module-scope leaks)', () => {
    const src = _buildAYDumpWorkletSource()
    expect(src).not.toMatch(/\bimport\b/)
    expect(src).toContain('registerProcessor(')
    expect(src).toContain('AudioWorkletProcessor')
    // The injected classes must not reference module-scope symbols.
    expect(src).not.toContain('AY_VOL')
    expect(src).not.toContain('getMasterGain')
    expect(src).not.toContain('initAudio')
  })

  it('parses and runs even when the bundler anonymises the class', () => {
    // Regression lock for "SyntaxError: class statement requires a name": under a
    // bundler the classes become anonymous expressions, so their toString() has no
    // name. Assembling + evaluating the source catches that (a string check does not).
    const src = _buildAYDumpWorkletSource()
    let registered: { name: string; cls: new () => WorkletProc } | null = null
    const RP = (name: string, cls: new () => WorkletProc): void => { registered = { name, cls } }
    class FakeProcessor {
      port = { postMessage(): void {}, onmessage: null as ((e: { data: unknown }) => void) | null }
    }

    const run = new Function('registerProcessor', 'AudioWorkletProcessor', 'sampleRate', src) as
      (rp: typeof RP, awp: typeof FakeProcessor, sr: number) => void
    expect(() => run(RP, FakeProcessor, 44100)).not.toThrow()
    expect(registered!.name).toBe('zxkit-aydump')

    // …and the registered processor actually renders audio from a loaded dump.
    const proc = new registered!.cls()
    const dump = parsePSG(synthPsg(50))
    proc.port.onmessage!({ data: {
      type: 'load', clockHz: 1_773_400, envSteps: 16, dac: Array.from(AY_VOL), stereo: 'acb',
      writeRegs: dump.writeRegs, writeVals: dump.writeVals, frameOffsets: dump.frameOffsets,
      frameRateHz: 50, loop: true, loopFrame: 0,
    } })
    const L = new Float32Array(128)
    const R = new Float32Array(128)
    let maxAbs = 0
    for (let q = 0; q < 100; q++) {
      proc.process([], [[L, R]])
      for (let i = 0; i < 128; i++) maxAbs = Math.max(maxAbs, Math.abs(L[i]))
    }
    expect(maxAbs).toBeGreaterThan(0.01)
  })
})
