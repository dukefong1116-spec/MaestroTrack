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
