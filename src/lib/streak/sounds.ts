import { ready } from '@/lib/audio/engine'
import { isSoundMuted } from '@/lib/utils/sound'

/**
 * The streak's ice sounds, synthesised live like every other sound in the
 * app — on the one shared audio context, silenced by the same mute switch,
 * and safe to call at any time (muted, no Web Audio, or audio not yet
 * unlocked by a tap: they simply do nothing).
 *
 * Timed to the animations in components/streak/FlameIce: the freeze
 * settles over about a second; the thaw cracks twice, then shatters at
 * 0.9s and relights.
 */

function ctx(): AudioContext | null {
  if (isSoundMuted()) return null
  return ready()
}

function bus(audio: AudioContext, level: number): GainNode {
  const g = audio.createGain()
  g.gain.value = level
  g.connect(audio.destination)
  return g
}

function tone(
  audio: AudioContext, out: AudioNode, freq: number, at: number, dur: number, peak: number,
  type: OscillatorType = 'sine', glideTo?: number,
) {
  const g = audio.createGain()
  g.connect(out)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  const o = audio.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + dur)
  o.connect(g)
  o.start(at)
  o.stop(at + dur + 0.03)
}

function noise(
  audio: AudioContext, out: AudioNode, at: number, dur: number, peak: number,
  type: BiquadFilterType, freq: number, q = 0.7, sweepTo?: number,
) {
  const len = Math.max(1, Math.floor(audio.sampleRate * dur))
  const buffer = audio.createBuffer(1, len, audio.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = audio.createBufferSource()
  src.buffer = buffer
  const f = audio.createBiquadFilter()
  f.type = type
  f.frequency.setValueAtTime(freq, at)
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur)
  f.Q.value = q
  const g = audio.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(f)
  f.connect(g)
  g.connect(out)
  src.start(at)
  src.stop(at + dur + 0.03)
}

/** Ice closing over the flame: a frosty hiss, a falling glassy chime, a settle. */
export function playFreezeOver(): void {
  const audio = ctx()
  if (!audio) return
  const out = bus(audio, 0.8)
  const t = audio.currentTime + 0.05
  noise(audio, out, t + 0.3, 0.8, 0.06, 'bandpass', 7000, 2, 2200)
  ;[2093, 1760, 1568, 1319, 1047].forEach((f, i) => tone(audio, out, f, t + 0.35 + i * 0.09, 0.7, 0.07, 'triangle'))
  tone(audio, out, 180, t + 1.05, 0.25, 0.14, 'sine', 90)
  ;[3136, 2637].forEach((f, i) => tone(audio, out, f, t + 1.1 + i * 0.25, 0.4, 0.04))
}

/** Ice cracking twice, shattering, and the flame catching again. */
export function playThaw(): void {
  const audio = ctx()
  if (!audio) return
  const out = bus(audio, 0.8)
  const t = audio.currentTime + 0.05
  for (const d of [0.25, 0.55, 0.75]) {
    noise(audio, out, t + d, 0.05, 0.45, 'highpass', 2800)
    tone(audio, out, 1900, t + d, 0.04, 0.06, 'square', 500)
  }
  noise(audio, out, t + 0.9, 0.3, 0.35, 'highpass', 3500)
  for (let i = 0; i < 9; i++) {
    tone(audio, out, 2600 + Math.random() * 2600, t + 0.9 + i * 0.03 + Math.random() * 0.03, 0.12 + Math.random() * 0.2, 0.05, 'triangle')
  }
  noise(audio, out, t + 0.88, 0.55, 0.32, 'bandpass', 350, 1, 2600)
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(audio, out, f, t + 1.15 + i * 0.04, 1, 0.08, i % 2 ? 'sine' : 'triangle'))
}

/** A freeze earned: four bright ice chimes, rising. */
export function playFreezeEarned(): void {
  const audio = ctx()
  if (!audio) return
  const out = bus(audio, 0.7)
  const t = audio.currentTime + 0.05
  ;[1568, 2093, 2637, 3136].forEach((f, i) => tone(audio, out, f, t + i * 0.08, 0.5, 0.06, 'triangle'))
}
