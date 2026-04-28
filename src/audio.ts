let ctx: AudioContext | null = null
let masterGain: GainNode | null = null

export function initAudio(volume = 0.3): void {
  if (ctx) return
  ctx = new AudioContext()
  masterGain = ctx.createGain()
  masterGain.gain.value = volume
  masterGain.connect(ctx.destination)
}

export function resumeAudio(): void {
  if (ctx && ctx.state === 'suspended') void ctx.resume()
}

export function getAudioContext(): AudioContext | null {
  return ctx
}

export function getMasterGain(): GainNode | null {
  return masterGain
}

// Core primitive — schedule a square-wave beep on the shared AudioContext
export function beep(freq: number, durationMs: number, startTime: number): void {
  if (!ctx || !masterGain) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(0.8, startTime + 0.005)
  gain.gain.setValueAtTime(0.8, startTime + durationMs / 1000 - 0.005)
  gain.gain.linearRampToValueAtTime(0, startTime + durationMs / 1000)
  osc.connect(gain)
  gain.connect(masterGain)
  osc.start(startTime)
  osc.stop(startTime + durationMs / 1000 + 0.01)
}
