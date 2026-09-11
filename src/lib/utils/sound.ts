import type { InstrumentType } from '@/types'

/**
 * Reward chime, synthesised live with the Web Audio API.
 *
 * No audio files: every note is an oscillator with an ADSR envelope. The
 * chord grows with the length of the session, so a longer practice is
 * literally a richer reward.
 */

const MUTE_KEY = 'maestro_sound_muted'

export function isSoundMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function setSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    /* private mode — the preference just won't persist */
  }
}

/**
 * Root note per instrument, chosen to sit in that instrument's natural
 * register. Frequencies in Hz.
 */
const ROOTS: Record<InstrumentType, number> = {
  cello: 130.81,      // C3
  trombone: 130.81,   // C3
  percussion: 130.81, // C3
  piano: 261.63,      // C4
  clarinet: 261.63,   // C4
  saxophone: 261.63,  // C4
  guitar: 261.63,     // C4
  viola: 261.63,      // C4
  violin: 392.0,      // G4
  flute: 392.0,       // G4
  trumpet: 392.0,     // G4
  voice: 392.0,       // G4
}

/** Semitone offsets, added progressively as the session gets longer. */
const CHORD = [0, 7, 4, 12, 14] // root, fifth, third, octave, ninth

function noteCount(minutes: number): number {
  if (minutes < 15) return 2
  if (minutes < 30) return 3
  if (minutes < 60) return 4
  return 5
}

const semitone = (root: number, steps: number) => root * Math.pow(2, steps / 12)

/** Lazily created so construction happens inside a user gesture. */
let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (ctx) return ctx
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    return ctx
  } catch {
    return null
  }
}

/**
 * Creates (and resumes) the audio context. Call this as the very first
 * line of a click/submit handler, before any `await` — Safari only honours
 * `resume()` as part of a user gesture when it runs synchronously in that
 * gesture's call stack. Calling it again later (e.g. once real session data
 * is ready) is a cheap no-op that just re-attempts resume().
 */
export function primeAudioContext(): void {
  if (isSoundMuted()) return
  const audio = getContext()
  if (audio?.state === 'suspended') audio.resume().catch(() => {})
}

/**
 * Plays a rising arpeggio. Safe to call unconditionally — it no-ops when
 * muted or when Web Audio is unavailable.
 *
 * For the sound to be audible on Safari/iOS, call `primeAudioContext()`
 * synchronously at the start of the same gesture, before any `await` —
 * by the time this function runs (e.g. after a network write), the
 * gesture window may already be gone.
 */
export function playSessionChime(instrument: InstrumentType | undefined, minutes: number): void {
  if (isSoundMuted()) return

  const audio = getContext()
  if (!audio) return

  // Last-ditch attempt in case priming wasn't called — harmless if it was.
  if (audio.state === 'suspended') audio.resume().catch(() => {})

  const root = ROOTS[instrument ?? 'piano'] ?? 261.63
  const notes = CHORD.slice(0, noteCount(minutes))

  // Shared bus so the chord as a whole sits at a sane level.
  const bus = audio.createGain()
  bus.gain.value = 0.9
  bus.connect(audio.destination)

  const now = audio.currentTime
  const stagger = 0.09

  notes.forEach((steps, i) => {
    const freq = semitone(root, steps)
    const start = now + i * stagger
    // Later notes ring shorter so the chord resolves together.
    const dur = 1.15 - i * 0.08

    const gain = audio.createGain()
    gain.connect(bus)

    // Two slightly detuned oscillators per note for warmth.
    for (const detune of [-4, 4]) {
      const osc = audio.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = freq
      osc.detune.value = detune
      osc.connect(gain)
      osc.start(start)
      osc.stop(start + dur + 0.05)
    }

    const peak = 0.17 / Math.sqrt(notes.length)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012)          // attack
    gain.gain.exponentialRampToValueAtTime(peak * 0.55, start + 0.18)    // decay
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)          // release
  })
}

/* ── Celebration sounds ──────────────────────────────────────────────
 *
 * Two more synthesised cues, deliberately opposite in character to each
 * other and to the warm session chime: the badge fanfare is bright and
 * rising, the freeze is cold and falling.
 */

/** Shared envelope helper: an exponential swell and decay on a gain node. */
function envelope(gain: GainNode, at: number, peak: number, attack: number, dur: number) {
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
}

/**
 * Badge unlock — a bright ascending arpeggio resolving on a held major
 * chord, with a shimmer an octave and a fifth above.
 */
export function playBadgeFanfare(): void {
  if (isSoundMuted()) return
  const audio = getContext()
  if (!audio) return
  if (audio.state === 'suspended') audio.resume().catch(() => {})

  const bus = audio.createGain()
  bus.gain.value = 0.85
  bus.connect(audio.destination)

  const root = 392.0 // G4
  const now = audio.currentTime

  // Rising arpeggio: root, major third, fifth, octave.
  const arp = [0, 4, 7, 12]
  arp.forEach((steps, i) => {
    const at = now + i * 0.085
    const gain = audio.createGain()
    gain.connect(bus)
    const osc = audio.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = semitone(root, steps)
    osc.connect(gain)
    osc.start(at)
    osc.stop(at + 0.85)
    envelope(gain, at, 0.16, 0.008, 0.8)
  })

  // Held triad underneath, arriving as the arpeggio lands.
  const chordAt = now + arp.length * 0.085
  for (const steps of [0, 4, 7]) {
    const gain = audio.createGain()
    gain.connect(bus)
    const osc = audio.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = semitone(root, steps)
    osc.connect(gain)
    osc.start(chordAt)
    osc.stop(chordAt + 1.2)
    envelope(gain, chordAt, 0.1, 0.02, 1.15)
  }

  // Shimmer: a high sine with gentle vibrato, an octave + fifth up.
  const shimmerGain = audio.createGain()
  shimmerGain.connect(bus)
  const shimmer = audio.createOscillator()
  shimmer.type = 'sine'
  shimmer.frequency.value = semitone(root, 19)
  const vibrato = audio.createOscillator()
  const vibratoDepth = audio.createGain()
  vibrato.frequency.value = 5.5
  vibratoDepth.gain.value = 6
  vibrato.connect(vibratoDepth).connect(shimmer.frequency)
  shimmer.connect(shimmerGain)
  shimmer.start(chordAt)
  vibrato.start(chordAt)
  shimmer.stop(chordAt + 1.2)
  vibrato.stop(chordAt + 1.2)
  envelope(shimmerGain, chordAt, 0.05, 0.05, 1.15)
}

/**
 * Streak freeze — cold and crystalline. A descending detuned sine cluster
 * over a filtered noise burst; the noise is what actually reads as
 * "ice/glass" rather than just a quiet bell.
 */
export function playFreezeChime(): void {
  if (isSoundMuted()) return
  const audio = getContext()
  if (!audio) return
  if (audio.state === 'suspended') audio.resume().catch(() => {})

  const bus = audio.createGain()
  bus.gain.value = 0.9
  bus.connect(audio.destination)

  const now = audio.currentTime

  // Short burst of highpassed white noise — the "crack" of forming ice.
  const noiseLen = Math.floor(audio.sampleRate * 0.28)
  const buffer = audio.createBuffer(1, noiseLen, audio.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < noiseLen; i++) {
    // Taper so the burst decays rather than cutting off.
    data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen)
  }
  const noise = audio.createBufferSource()
  noise.buffer = buffer
  const hp = audio.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 3200
  const noiseGain = audio.createGain()
  noise.connect(hp).connect(noiseGain).connect(bus)
  envelope(noiseGain, now, 0.12, 0.004, 0.26)
  noise.start(now)

  // Descending minor third, detuned for shimmer, long tail.
  const top = 1046.5 // C6
  const fall = [0, -3]
  fall.forEach((steps, i) => {
    const at = now + i * 0.16
    for (const detune of [-7, 7]) {
      const gain = audio.createGain()
      gain.connect(bus)
      const osc = audio.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = semitone(top, steps)
      osc.detune.value = detune
      osc.connect(gain)
      osc.start(at)
      osc.stop(at + 1.15)
      envelope(gain, at, 0.09, 0.01, 1.1)
    }
  })
}
