/**
 * Lightweight synthesized sound effects via Web Audio API.
 * No external assets required, so it works fully offline.
 */

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** Call from a user gesture to unlock audio on some browsers. */
export function unlockAudio() {
  getCtx()
}

/** Short tick when the wheel passes a segment. */
export function playTick(intensity = 1) {
  const ac = getCtx()
  if (!ac) return
  const t = ac.currentTime
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(1400 + 400 * intensity, t)
  osc.frequency.exponentialRampToValueAtTime(600, t + 0.03)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.12 * Math.max(0.3, intensity), t + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045)
  osc.connect(gain).connect(ac.destination)
  osc.start(t)
  osc.stop(t + 0.05)
}

/** Rising whoosh when the spin starts. */
export function playSpinStart() {
  const ac = getCtx()
  if (!ac) return
  const t = ac.currentTime
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(180, t)
  osc.frequency.exponentialRampToValueAtTime(720, t + 0.6)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.08, t + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7)
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(900, t)
  filter.frequency.exponentialRampToValueAtTime(3000, t + 0.6)
  osc.connect(filter).connect(gain).connect(ac.destination)
  osc.start(t)
  osc.stop(t + 0.75)
}

/** Celebration fanfare when a winner is revealed. */
export function playWin() {
  const ac = getCtx()
  if (!ac) return
  const t0 = ac.currentTime
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5] // C5 E5 G5 C6 E6
  notes.forEach((freq, i) => {
    const t = t0 + i * 0.09
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    osc.connect(gain).connect(ac.destination)
    osc.start(t)
    osc.stop(t + 0.55)
  })
  // Final chord
  const tc = t0 + notes.length * 0.09
  ;[523.25, 659.25, 783.99, 1046.5].forEach((freq) => {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, tc)
    gain.gain.setValueAtTime(0.0001, tc)
    gain.gain.exponentialRampToValueAtTime(0.14, tc + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, tc + 1.4)
    osc.connect(gain).connect(ac.destination)
    osc.start(tc)
    osc.stop(tc + 1.5)
  })
}
