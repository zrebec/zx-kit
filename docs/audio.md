# Audio

zx-kit ships two independent audio paths — the 1-bit **beeper** (`audio.ts`) and the **AY-3-8912** chip emulator (`ay.ts`) — plus a note-name music helper (`music.ts`). They are not alternatives: 128K Spectrum games used both at once. Start with the architecture note below.

Sister guides: [rendering](rendering.md) · [API reference](api.md).

## Audio architecture — beeper vs AY

zx-kit ships two independent audio modules — [`audio.ts`](#audiots--beeper-audio) (the **beeper**) and [`ay.ts`](#ayts--ay-3-8912-melodik-audio) (the **AY chip**). They are **not alternatives** — most ZX Spectrum 128K games used both at once, and so should yours.

### The history (so the choice makes sense)

| Hardware | Beeper (1-bit) | AY-3-8912 (3 ch) |
|----------|:--:|:--:|
| Spectrum 48K | ✅ built-in | ❌ |
| Spectrum 128K / +2 / +3 | ✅ built-in | ✅ built-in |
| Melodik add-on (for 48K) | — | ✅ |

- **48K games** (Manic Miner, Jet Set Willy, Atic Atac) had only the beeper — every blip, jump, footstep and title jingle was a square wave forced out of the 1-bit speaker by tight CPU loops.
- **128K games** (Robocop, R-Type, Chase H.Q., Lord of the Rings) used the AY for **music** — proper 3-channel tunes with envelope shaping — while the beeper kept doing **sound effects** in parallel. AY hummed an orchestral score; the beeper still went *pew pew*.

### When to use which

| Want to play… | Module | Function | Why |
|---|---|---|---|
| Short SFX (shot, jump, hit, beep) | `audio.ts` | `beep(freq, dur, t)` | Single square wave, punchy, era-correct for SFX |
| A 3-channel jingle / chord | `ay.ts` | `playAY({ a, b, c })` | Needs ≥2 simultaneous voices |
| Game-over fanfare / level music | `ay.ts` | `playAY(...)` | Envelope shaping + multiple voices |
| Single-voice melody | `audio.ts` | `playPattern(notes)` | Lighter setup, no AY init needed |
| Live, dynamically-changing tone (siren, engine) | `ay.ts` | `createAY()` then `tone()` | Persistent oscillator handle |
| Title-screen music | `ay.ts` | `playAY(...)` | Authentic 128K title-music feel |

**Rule of thumb:** if it needs to be *heard at the same time as something else*, you almost certainly want AY for at least one of the two.

### Authentic parallel pattern — the "Robocop" pattern

This is how 128K games actually sounded:

```ts
import { initAudio, beep, getAudioContext, resumeAudio } from 'zx-kit'  // beeper
import { playAY }                                          from 'zx-kit'  // AY

// One-time setup (must be inside a user gesture — click, keydown — due to browser autoplay policy)
window.addEventListener('keydown', () => { initAudio(); resumeAudio() }, { once: true })

// Title screen: AY plays a multi-voice melody...
playAY({
  a: [{ freq: 523, dur: 200 }, { freq: 659, dur: 200 }, { freq: 784, dur: 400, envShape: 12, envCycleDurMs: 200 }],
  b: [{ freq: 262, dur: 200 }, { freq: 330, dur: 200 }, { freq: 392, dur: 400 }],
})

// ...meanwhile in the game loop, beeper does the SFX:
function onPlayerShoots() {
  const audio = getAudioContext()
  if (audio) beep(1200, 40, audio.currentTime)     // sharp pew
}
function onPlayerHit() {
  const audio = getAudioContext()
  if (audio) beep(120, 200, audio.currentTime)     // low thump
}
```

Both modules route through the **same master `GainNode`**, so `setMasterVolume(v)` controls both at once. They share state cleanly — no audio bus conflicts.

### Notes on accuracy

- **Beeper** (`audio.ts`) is a faithful 1-bit-style square wave via Web Audio's `OscillatorNode`. Era-correct for SFX use.
- **AY** (`ay.ts`) is a *good approximation* of the AY-3-8912 — hardware-accurate logarithmic amplitudes (16 levels, ≈ √2 ratio), all 16 envelope shapes, proper LFSR noise. **Not sample-accurate**: Web Audio's `OscillatorNode` is band-limited (no aliasing artefacts), real AY's raw squares have a buzzier, fuzzier character; envelopes are smooth ramps here vs the chip's 16-step ramps. For chip-tune purists wanting bit-exact AY emulation, a future AudioWorklet-based backend is on the roadmap. For game sound and most music, the current implementation is more than convincing.

---

## `ay.ts` — AY-3-8912 Melodik Audio

The AY-3-8912 chip (sold as the *Melodik* add-on for ZX Spectrum 48K, built into the 128K) gave the Spectrum three independent square-wave channels, a shared LFSR noise generator, and a hardware envelope generator with 16 distinct shapes. This module emulates all of it via the Web Audio API with hardware-accurate logarithmic amplitude values.

> **Pair with [`audio.ts`](#audiots--beeper-audio) (the beeper) for sound effects.** Use AY for music, beeper for SFX — see [Audio architecture — beeper vs AY](#audio-architecture--beeper-vs-ay) for the historical context and the parallel-use pattern. Both modules share the same master gain, so `setMasterVolume()` controls them together.

Two usage modes:

| Mode | Function | Use case |
|------|----------|----------|
| **Real-time** | `createAY()` | Persistent chip handle — set channels live (SFX, dynamic music) |
| **Sequencer** | `playAY(pattern)` | Pre-scheduled, fire-and-forget (music tracks, jingles) |

Both modes route through the zx-kit master `GainNode`, so `setMasterVolume()` works globally.

### `AY_CLOCK`

```ts
export const AY_CLOCK = 1_773_400  // Hz — ZX Spectrum 128K / Melodik
```

The AY-3-8912 master clock. Exported for use in frequency calculations:
`f_Hz = AY_CLOCK / (16 × period_register)`.

### `AY_VOL`

```ts
export const AY_VOL: readonly number[] = [
  0, 0.0089, 0.0118, 0.0156, 0.0211, 0.0289, 0.0403, 0.0549,
  0.0744, 0.1060, 0.1518, 0.2139, 0.2969, 0.4259, 0.6098, 1.0,
]
```

Hardware-accurate logarithmic amplitude table. Each step ≈ √2 (3 dB), matching the real chip's resistor ladder. Index 0 = silence, index 15 = full amplitude.

### `AY_ENVELOPE_SHAPES`

```ts
export const AY_ENVELOPE_SHAPES: readonly string[]
```

Human-readable names for all 16 R13 envelope shapes — useful for documentation, tooling, and debugging.

| R13 | Shape | Description |
|-----|-------|-------------|
| 0–3 | `\_ ` | One-shot decay, hold at zero |
| 4–7 | `/_ ` | One-shot attack, hold at zero |
| 8   | `\\\\` | Repeat decay (sawtooth down) |
| 9   | `\_`  | One-shot decay, hold at zero |
| 10  | `\/\/` | Alternate down/up (triangle) |
| 11  | `\‾`  | One-shot decay, hold at maximum |
| 12  | `//`  | Repeat attack (sawtooth up) |
| 13  | `/‾`  | One-shot attack, hold at maximum |
| 14  | `/\/\`| Alternate up/down (triangle) |
| 15  | `/_`  | One-shot attack, hold at zero |

### `AYChannel` type

```ts
type AYChannel = 'A' | 'B' | 'C'
```

### `AYNote` interface

```ts
interface AYNote {
  freq:          number   // Hz — 0 = rest
  dur:           number   // milliseconds
  vol?:          number   // 0–15 (default 15). Ignored when envShape is set.
  noise?:        boolean  // mix LFSR noise alongside tone (default false)
  noisePeriod?:  number   // 1–31 — higher = darker texture (default 8)
  envShape?:     number   // 0–15 (R13) — activates envelope, overrides vol
  envCycleDurMs?: number  // ms for one ramp (15→0 or 0→15). Default = note duration.
}
```

### `AYChip` interface

The handle returned by `createAY()`.

```ts
interface AYChip {
  tone(ch: AYChannel, freq: number, vol?: number): void
  enableNoise(ch: AYChannel, period?: number): void
  disableNoise(ch: AYChannel): void
  envelope(ch: AYChannel, shape: number, cycleDurMs: number): void
  mute(ch: AYChannel): void
  muteAll(): void
  stop(): void
}
```

### `createAY(): AYChip`

Creates three persistent AY channels wired to the master gain. Each channel has:
- An independent square-wave oscillator (tone)
- An LFSR noise path (shared 17-bit noise source, per-channel lowpass filter and gain)
- `AudioParam` automation for envelope

Must be called inside a user-gesture handler.

```ts
button.addEventListener('click', () => {
  initAudio()
  const ay = createAY()

  // Simple tone
  ay.tone('A', 440, 12)           // channel A: A4, amplitude level 12

  // Tone + noise mix
  ay.tone('B', 220, 10)
  ay.enableNoise('B', 16)         // darker noise (higher period = lower cutoff)

  // Envelope — shape 10 = \/\/ triangle, 400ms cycle
  ay.tone('C', 110, 0)            // oscillator active but tone gain is silent
  ay.envelope('C', 10, 400)       // envelope drives the amplitude

  setTimeout(() => ay.muteAll(), 3000)
  setTimeout(() => ay.stop(), 3500)
})
```

#### `ay.tone(ch, freq, vol?)`

Sets the channel oscillator frequency and amplitude. `freq ≤ 0` silences the tone generator (noise can still run). `vol` maps to `AY_VOL` (0–15, default 15). Cancels any running envelope on that channel.

#### `ay.enableNoise(ch, period?)`

Enables LFSR noise on a channel. `period` 1–31 maps to `AY_CLOCK / (16 × period)` Hz as a lowpass cutoff on the noise path. Default period 8 → ~13 kHz (bright, crispy). Period 28 → ~4 kHz (darker, rumble-like).

#### `ay.disableNoise(ch)`

Fades noise out on a channel with a 5ms release.

#### `ay.envelope(ch, shape, cycleDurMs)`

Applies an AY hardware envelope to a channel's amplitude. `shape` 0–15 corresponds to the 16 R13 values. `cycleDurMs` is the duration of one ramp (0→15 or 15→0). Repeating shapes (8, 10, 12, 14) are pre-scheduled for 32 cycles; call again to extend.

```ts
// Explosion: channel C, shape 8 (repeat decay), 60ms per cycle
ay.enableNoise('C', 5)
ay.envelope('C', 8, 60)

// Organ: shape 13 (/‾ fast attack, hold high), 20ms attack
ay.tone('A', 523, 0)
ay.envelope('A', 13, 20)
```

#### `ay.mute(ch)` / `ay.muteAll()`

Fade out one or all channels (5ms release). Cancels any pending envelope automation.

#### `ay.stop()`

Stops all oscillators and the noise source, disconnects all Web Audio nodes. Call when discarding the chip instance.

#### Stereo + per-channel volume (Experimental)

Each channel runs through its own `StereoPannerNode` (direction) **and** a dedicated `GainNode`
(independent volume) before the master bus. Defaults are transparent — centre pan, full volume —
so existing code is unchanged (non-breaking).

- **`ay.pan(ch, value)`** — `-1` left … `0` centre (default) … `+1` right.
- **`ay.setStereoMode(mode)`** — demoscene preset for all three at once: `'mono'` (all centred),
  `'abc'` (A left / B centre / C right), `'acb'` (A left / B right / C centre).
- **`ay.volume(ch, level)`** — set a channel's independent volume immediately (`level` 0–15);
  composes on top of the per-note `vol`.
- **`ay.fade(ch, toLevel, durationMs)`** — smoothly ramp that volume to `toLevel` (0–15) over
  `durationMs`. All three channels are independent and can play at once with different volume + pan.

```ts
const ay = createAY()
ay.tone('A', 220)
ay.pan('A', -1)          // bass in the left ear
ay.volume('A', 0)        // start silent
ay.fade('A', 8, 2000)    // …swell to level 8 over 2 s…
ay.fade('A', 0, 1500)    //   …then let it ring out
ay.setStereoMode('abc')  // or place all three at once (A left / C right)
```

---

### `playAY(pattern, startDelay?): void`

Pre-schedules up to three independent note arrays on the shared `AudioContext`. All channels start at the same wall-clock time. Fire-and-forget — no handle returned. Per-note noise and envelope are fully supported. Add an optional `pan` map (`{ a?, b?, c? }`, each `-1`…`+1`, default centre) to place the channels in stereo — e.g. `playAY({ a, c }, 0)` with `pan: { a: -1, c: 1 }`.

```ts
// Three-channel chiptune jingle with envelope and noise
playAY({
  a: [
    { freq: 523, dur: 300, envShape: 13, envCycleDurMs: 20 },  // C5, organ attack
    { freq: 659, dur: 300, envShape: 13, envCycleDurMs: 20 },  // E5
    { freq: 784, dur: 600, envShape: 12, envCycleDurMs: 100 }, // G5, sawtooth swell
  ],
  b: [
    { freq: 261, dur: 600, vol: 10 },   // C4 bass note
    { freq: 329, dur: 600, vol: 10 },   // E4
  ],
  c: [
    { freq: 0, dur: 100, noise: true, noisePeriod: 5, envShape: 8, envCycleDurMs: 40 },  // snare hit
    { freq: 0, dur: 1100 },  // silence
  ],
})

// With a 500ms startup delay
playAY({ a: melody, b: bass }, 500)
```

---

## `audio.ts` — Beeper Audio

Single-channel 1-bit square-wave audio, faithful to the ZX Spectrum beeper. Use this for **sound effects** (shots, jumps, hits, beeps) and simple monophonic melodies.

> **Pair with [`ay.ts`](#ayts--ay-3-8912-melodik-audio) for music.** This is how 128K Spectrum games actually sounded — see [Audio architecture — beeper vs AY](#audio-architecture--beeper-vs-ay) for the reasoning and the "Robocop" parallel-use pattern.

All audio routes through a shared `AudioContext` and master `GainNode` — `setMasterVolume()` controls both modules at once. **`initAudio()` must be called inside a user-gesture handler** due to browser autoplay policy.

### `initAudio(volume?): void`

Creates the `AudioContext` and master gain node. Idempotent — safe to call multiple times. `volume` is clamped to 0.0–1.0 (default `0.3`).

```ts
window.addEventListener('keydown', () => initAudio(), { once: true })
window.addEventListener('click',   () => initAudio(), { once: true })
```

### `resumeAudio(): void`

Resumes a suspended `AudioContext`. Browsers suspend the context on tab hide or first load. Call before scheduling any audio in the game loop.

### `getAudioContext(): AudioContext | null`

Returns the shared context, or `null` before `initAudio()`.

### `getMasterGain(): GainNode | null`

Returns the master gain node. Connect custom oscillators here to participate in the global volume level.

### `getMasterVolume(): number`

Returns the current master volume (0.0–1.0), or `0` before `initAudio()`.

### `setMasterVolume(volume): void`

Sets master volume. Clamped to 0.0–1.0. No-op before `initAudio()`.

```ts
setMasterVolume(0.5)  // 50%
setMasterVolume(0)    // mute
setMasterVolume(1)    // full
```

### `increaseVolume() / decreaseVolume(): void`

Adjusts master volume by ±0.1, clamped to 0.0–1.0. Each call also timestamps the
change, so the auto-hide [volume HUD bar](#built-in-volume-control-experimental)
appears for ~1.5 s — whether the call came from a key press or game code.

### Built-in volume control (Experimental)

A near-free `+`/`-` volume control plus an auto-hide HUD bar. A **deliberate break
from ZX authenticity** (the Speccy had no software volume) — an "under glass, 2026"
affordance like `curveDisplay`/scanlines. Default case is one render-loop line; the
keys and the bar are both customisable with a single optional `set*` call.

```ts
initInput()                              // +/- control volume (default on)
setVolumeBarStyle({ color: C.B_CYAN })   // optional — defaults are fine without it
setVolumeKeys('9', '8')                  // optional — +/- stays if you skip it
// in the render loop:
drawVolumeBar(ctx)                        // shows ~1.5 s after a change, then hides
```

#### `setVolumeBarStyle(opts?): void`

Configures the bar's appearance (config-once); stores style only, does **not**
render. Optional — the defaults below apply if it is never called.

| Option | Default | Meaning |
|--------|---------|---------|
| `color`    | `C.B_GREEN` | Bar ink colour |
| `segments` | `10` | Bar width in cells (`width = segments * CELL` → 80 px) |
| `x`        | centred | Left edge in game pixels; omit to centre via `ctx.canvas` width |
| `y`        | `96 - CELL` | Top edge in game pixels (≈ mid-screen) |

#### `drawVolumeBar(ctx): void`

The only render-loop call — no style args (reads the stored style). Draws nothing
once more than ~1.5 s has passed since the last volume change; otherwise renders the
current master volume and hides itself afterwards. Centres horizontally via the
canvas width when `x` is unset. Thin wrapper over [`drawProgressBar`](rendering.md);
no new bar renderer.

#### `setVolumeKeys(up, down): void`

Lives in [`input.ts`](#inputts). Overrides the keys that adjust volume. Optional —
`+`/`=` (up) and `-`/`_` (down) stay active if never called. Each argument is a
string or array of `KeyboardEvent.key` values. Pass empty arrays to disable.

```ts
setVolumeKeys('9', '8')   // remap; +/- no longer touch volume
setVolumeKeys([], [])     // disable built-in volume keys
```

### `Note` interface

```ts
interface Note {
  freq: number  // Hz — 0 = rest (silence, advances timeline)
  dur:  number  // ms
}
```

### `playPattern(notes, startDelay?): void`

Schedules a note sequence on the shared `AudioContext`. `freq: 0` entries produce silence for their duration. `startDelay` offsets the entire pattern in milliseconds.

```ts
// Rising arpeggio
playPattern([
  { freq: 262, dur: 80 },   // C4
  { freq: 330, dur: 80 },   // E4
  { freq: 392, dur: 80 },   // G4
  { freq: 523, dur: 160 },  // C5
])

// With rest and startup delay
playPattern([
  { freq: 880, dur: 100 },
  { freq: 0,   dur: 50  },  // rest
  { freq: 880, dur: 100 },
], 200)
```

### `beep(freq, durationMs, startTime, pan?): void`

Schedules a single square-wave note at an absolute `AudioContext.currentTime`. Uses a 5ms linear ramp on attack and release to avoid click artefacts. Use `playPattern` for sequences; use `beep` when you need algorithmic or sample-accurate timing. Optional `pan` (`-1` left … `0` centre, default … `+1` right) routes the note through a `StereoPanner`; `pan = 0` keeps the original mono graph (non-breaking). `Note.pan` lets `playPattern` place individual notes the same way.

```ts
const audio = getAudioContext()!
resumeAudio()
beep(440, 80, audio.currentTime)
beep(880, 80, audio.currentTime + 0.15)  // 150ms later
```

### `stopBeep(): void`

Silences the beeper immediately — the tone sounding right now **and** every note already queued behind it.

This exists because `playPattern` is a scheduler, not a player: it hands the whole melody to the Web Audio timeline in one go and returns. Without `stopBeep` a jingle keeps playing after the game has moved on, and the game has no handle on it. The Spectrum had a single speaker bit — a new sound replaced whatever was sounding, it never mixed — so cutting the old sound is the era-correct behaviour, not a workaround.

A tone that is already sounding is released over 5ms rather than cut dead; chopping a square wave mid-cycle produces an audible click. Notes still queued in the future never sound at all. Safe to call when nothing is playing, and before `initAudio` (no-op).

Beeper only — AY music runs on its own voices and is untouched. Stop that with `ay.stop()`.

```ts
// Intro jingle stops the moment the player takes their first step
playPattern(STARTUP_JINGLE)

// …later, in the input handler:
stopBeep()
playPattern(FOOTSTEP)
```

Cutting is a decision the **game** makes, not something the beeper does on its own: `beep` and `playPattern` still layer by default, which is what games mixing footsteps, sonar and beacons rely on. Call `stopBeep` at the points where the old sound genuinely stopped mattering — a keypress ending an intro, a scene change, an accessibility "quiet now".

---

## `music.ts` — Note-Name AY Music

Write AY tunes by **note name** instead of raw frequencies, and **loop** them for
background music. A thin, friendly layer over [`playAY`](#playaypattern-startdelay-void):
the AY chip already plays three channels of `AYNote`s — this lets you *author* and
*repeat* them without the maths (so "I don't read note tables" is no longer a blocker).

### `noteToFreq(name): number`

Note name → frequency (Hz), equal temperament, **A4 = 440**. Accepts `A5`, `C#4`,
`Db3`, `Fs5` (`s` = sharp). `r` / `-` is a rest → `0` (a silent note). Throws on a
malformed name. Pure.

```ts
noteToFreq('A4')   // 440
noteToFreq('C4')   // 261.63  (middle C)
noteToFreq('A5')   // 880
```

### `seq(spec, options?): AYNote[]`

Parses a compact note string into one channel's `AYNote[]`. Tokens are
whitespace-separated `Note` or `Note:durMs`; `r` (or `-`) is a rest. `options.dur`
sets the default duration (200 ms); `options.noise` / `noisePeriod` mix LFSR noise
into every note (handy for a texture/percussion channel).

```ts
seq('A4 C5:400 r:200 E5')          // A4 @default, C5 @400ms, rest @200ms, E5 @default
seq('r r r r', { dur: 240, noise: true })   // a noise-only texture line
```

### `playAYLoop(pattern): { stop() }`

Plays a 3-channel pattern **on repeat** — background music. Re-schedules each loop
after the pattern's length (its longest channel) and returns a handle to `stop()`.
No-ops (returns a do-nothing stop) when there's no audio context yet or the pattern
is empty. Call after a user gesture has unlocked audio.

```ts
const track = playAYLoop({
  a: seq('A4 C5 E5 C5', { dur: 240 }),         // melody
  b: seq('A2:480 E2:480', { dur: 480 }),        // slow bass drone
  c: seq('r r r r', { dur: 240, noise: true }), // texture
})
// later…
track.stop()
```

> Looping re-schedules at the pattern boundary via a timer — fine for ambient /
> background loops; for tight musical sync you'd want a sample-accurate scheduler.

---

## `aydump` — real ZX-scene tunes (PSG register dumps)  *(Experimental, 0.37)*

Where `ay` **synthesises** notes you compose in code, `aydump` **reproduces the
hardware**: it runs a cycle-level AY-3-8910 / YM2149 emulator (`AYChipCore`) fed a
stream of register writes — a **PSG dump** — and renders real, sample-accurate PCM
through an `AudioWorklet`. This is the "sample-accurate AudioWorklet backend" the
`ay` docblock promises. It shares the master gain, so the global **M mute** and
`setMasterVolume` cover it for free.

**Scope is the PSG format (v1).** A `.psg` file is a raw register dump — HW-level and
unambiguous. Anything from zxart.ee (PT3, STC…) is converted to `.psg` **offline** on
a PC (Ay_Emul "save as PSG", `zxtune123 --convert`, or Vortex Tracker II — export at
50 Hz). The dump is **data, not a code dependency**, so Zero Dependencies stays clean.
A native PT3 replay routine over the same `AYChipCore` is a future module.

> **Authorship is the one real minefield.** A PSG dump is a derivative of the original
> tune; zxart hosting is *not* a licence. Ship a track only with the composer's
> permission — credit them + link their zxart profile, and keep the permission on file.
> Prefer original compositions (a PT3 "cover" of a film theme still owes the original
> composer). This is a deliberate break from note-based `ay`; the reward is the *actual*
> scene sound.

### Playing a tune

```ts
import { initAudio, loadPSG, playAYDump, AY_MACHINE } from 'zx-kit'

button.addEventListener('click', async () => {
  initAudio()                                   // once, inside a user gesture
  const dump = await loadPSG('./music/tune.psg')
  const track = await playAYDump(dump, { loop: true, ...AY_MACHINE.melodik })
  // later…
  track.setVolume(0.6)     // per-track (master stays with setMasterVolume)
  track.setStereo('acb')   // live stereo preset
  track.pause(); track.resume()
  track.onEnded = () => console.log('finished')  // non-looping only
  track.stop()             // detach (irreversible)
})
```

### Chip variants — `AY_MACHINE`

The same dump plays differently per machine, because the clock and stereo wiring differ.
Presets: `zx128` (1.7734 MHz, mono TV speaker), `melodik` / `pentagon` (1.75 MHz, ACB
jack), `atariST` (YM2149, 2 MHz). Or pass your own `{ clockHz, variant, stereo, dacTable }`
— `dacTable` is a hook for a measured DAC (a real Melodik, one day).

### Offline render — `renderAYDump(dump, opts?)`

Deterministic full render to stereo `Float32Array`s **without** an `AudioContext` — for
tests, `AudioWorklet`-less fallbacks, and tooling (e.g. PSG → WAV). RAM-heavy for a full
song (~64 MB for 3 min stereo @44.1 kHz) — pass `maxSeconds` to bound it.

### API surface

| Symbol | Purpose |
|--------|---------|
| `parsePSG(bytes)` → `AYDump` | Parse a `.psg` byte stream (throws on a bad header / truncation). |
| `loadPSG(url)` → `Promise<AYDump>` | `fetch` + `parsePSG`. |
| `playAYDump(dump, opts?)` → `Promise<AYDumpHandle>` | Realtime playback via `AudioWorklet`. Call after `initAudio()`. |
| `renderAYDump(dump, opts?)` | Offline deterministic render. |
| `AYChipCore` | The chip emulator (registers → PCM). Worklet-safe / headless-testable. |
| `AYDumpPlayer` | Frame scheduler that drives `AYChipCore` from an `AYDump`. |
| `AY_MACHINE` | Ready-made machine presets. |

---
