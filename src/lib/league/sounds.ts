import { ready } from '@/lib/audio/engine'
import { isSoundMuted, rootFor } from '@/lib/utils/sound'
import type { InstrumentType } from '@/types'

/**
 * The league's sounds, synthesised live like the session chime — no
 * files, nothing to download — on the app's one audio context, silenced
 * by the same mute switch, and pitched to your instrument like the chime.
 *
 * Every function is safe to call at any time: muted, no Web Audio, or a
 * context not yet unlocked by a tap, and it simply does nothing. Phones
 * only allow sound after a tap, which is why the week's reveal asks for
 * one before it starts.
 *
 * Kept quieter than the session chime: these accompany an animation, they
 * are not the reward itself.
 */

const semi = (root: number, steps: number) => root * Math.pow(2, steps / 12)
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19]

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

function tone(audio: AudioContext, out: AudioNode, freq: number, at: number, dur: number, peak: number, type: OscillatorType = 'triangle', detune = 0) {
  const g = audio.createGain()
  g.connect(out)
  const o = audio.createOscillator()
  o.type = type
  o.frequency.value = freq
  o.detune.value = detune
  o.connect(g)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.start(at)
  o.stop(at + dur + 0.05)
}

let noiseBuffer: AudioBuffer | null = null
function noise(audio: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === audio.sampleRate) return noiseBuffer
  const b = audio.createBuffer(1, audio.sampleRate, audio.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  noiseBuffer = b
  return b
}

/** Filtered noise, swept — a whoosh up, or a swell. */
function sweep(audio: AudioContext, out: AudioNode, at: number, dur: number, from: number, to: number, peak: number) {
  const src = audio.createBufferSource()
  src.buffer = noise(audio)
  const f = audio.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = 1.4
  f.frequency.setValueAtTime(from, at)
  f.frequency.exponentialRampToValueAtTime(to, at + dur)
  const g = audio.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + dur * 0.6)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(f).connect(g).connect(out)
  src.start(at)
  src.stop(at + dur + 0.05)
}

let lastTick = 0
/** One soft tick of XP counting up. Throttled, so a fast count is a patter, not a buzz. */
export function playXpTick(instrument?: InstrumentType) {
  const audio = ctx()
  if (!audio || audio.currentTime - lastTick < 0.06) return
  lastTick = audio.currentTime
  tone(audio, bus(audio, 0.5), semi(rootFor(instrument), 24), audio.currentTime, 0.05, 0.05, 'sine')
}

/** Your row lifting off the list. */
export function playZoomIn() {
  const audio = ctx()
  if (!audio) return
  sweep(audio, bus(audio, 0.7), audio.currentTime, 0.4, 400, 2600, 0.22)
}

/**
 * The climb: one rising note for every place passed, across `seconds` —
 * pass three people, hear three notes going up.
 */
export function playClimb(places: number, seconds: number, instrument?: InstrumentType) {
  const audio = ctx()
  if (!audio || places <= 0) return
  const out = bus(audio, 0.8)
  const root = rootFor(instrument)
  const n = Math.min(places, MAJOR.length)
  const step = Math.min(0.28, (seconds * 0.85) / n)
  for (let i = 0; i < n; i++) {
    const at = audio.currentTime + 0.08 + i * step
    tone(audio, out, semi(root, 12 + MAJOR[i]), at, 0.32, 0.09)
    tone(audio, out, semi(root, 12 + MAJOR[i]), at, 0.32, 0.03, 'sine', 7)
  }
}

/** Landing: a soft wooden tock, like a metronome's. */
export function playLand() {
  const audio = ctx()
  if (!audio) return
  const out = bus(audio, 0.8)
  const at = audio.currentTime
  const o = audio.createOscillator()
  const g = audio.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(900, at)
  o.frequency.exponentialRampToValueAtTime(420, at + 0.06)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(0.18, at + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09)
  o.connect(g).connect(out)
  o.start(at)
  o.stop(at + 0.12)
}

/** Into the move-up zone: two bright notes. */
export function playZoneChime(instrument?: InstrumentType) {
  const audio = ctx()
  if (!audio) return
  const out = bus(audio, 0.8)
  const root = rootFor(instrument)
  tone(audio, out, semi(root, 19), audio.currentTime, 0.45, 0.09)
  tone(audio, out, semi(root, 24), audio.currentTime + 0.11, 0.6, 0.09)
}

/** "Week complete": a soft cymbal-like swell. */
export function playWeekSwell() {
  const audio = ctx()
  if (!audio) return
  const out = bus(audio, 0.7)
  sweep(audio, out, audio.currentTime, 1.3, 3000, 9000, 0.12)
}

/**
 * Moving up: a fanfare that grows with the tier you arrive in — a plain
 * major chord into Piano, a note richer each tier, and into Fortissimo the
 * full chord with the octave and a shimmer on top.
 */
export function playPromotion(toTier: number, instrument?: InstrumentType) {
  const audio = ctx()
  if (!audio) return
  const out = bus(audio, 0.9)
  const root = rootFor(instrument)
  const now = audio.currentTime
  const chord = [0, 4, 7, 12, 16, 19].slice(0, Math.min(6, 2 + Math.max(1, toTier)))
  // A quick run up to it…
  ;[0, 4, 7].forEach((s, i) => tone(audio, out, semi(root, s), now + i * 0.07, 0.25, 0.08))
  // …then the chord, held.
  chord.forEach((s, i) => {
    const at = now + 0.24 + i * 0.03
    tone(audio, out, semi(root, s), at, 1.6, 0.11 / Math.sqrt(chord.length), 'triangle', -4)
    tone(audio, out, semi(root, s), at, 1.6, 0.11 / Math.sqrt(chord.length), 'triangle', 4)
  })
  if (toTier >= 4) {
    for (let i = 0; i < 6; i++) tone(audio, out, semi(root, 31 + (i % 3) * 5), now + 0.5 + i * 0.09, 0.3, 0.03, 'sine')
  }
}

/** The notes bursting from a new trophy: light twinkles. */
export function playSparkle(instrument?: InstrumentType) {
  const audio = ctx()
  if (!audio) return
  const out = bus(audio, 0.6)
  const root = rootFor(instrument)
  for (let i = 0; i < 7; i++) {
    tone(audio, out, semi(root, 28 + MAJOR[(i * 3) % 7]), audio.currentTime + i * 0.06 + Math.random() * 0.03, 0.18, 0.035, 'sine')
  }
}

/** Held your place: warm and settled. */
export function playStay(instrument?: InstrumentType) {
  const audio = ctx()
  if (!audio) return
  const out = bus(audio, 0.8)
  const root = rootFor(instrument)
  ;[0, 7, 12].forEach((s, i) => tone(audio, out, semi(root, s), audio.currentTime + i * 0.05, 1.2, 0.07))
}

/** Moving down: two gentle falling notes — soft, never sad. */
export function playDemotion(instrument?: InstrumentType) {
  const audio = ctx()
  if (!audio) return
  const out = bus(audio, 0.7)
  const root = rootFor(instrument)
  tone(audio, out, semi(root, 7), audio.currentTime, 0.6, 0.07, 'sine')
  tone(audio, out, semi(root, 4), audio.currentTime + 0.28, 0.9, 0.07, 'sine')
}
