import { unlock, ready, installAudioUnlock } from '@/lib/audio/engine'
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
  // Un-muting happens inside a click, which is the one moment a browser
  // will let us open an audio context. Take it: someone who has just
  // turned sound on should not have to click a second time before the
  // next celebration is audible.
  if (!muted) primeAudioContext()
  else armAudioContext()
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
  other: 261.63,      // C4 — middle of the range, knowing nothing else
  clarinet: 261.63,   // C4
  saxophone: 261.63,  // C4
  guitar: 261.63,     // C4
  viola: 261.63,      // C4
  violin: 392.0,      // G4
  flute: 392.0,       // G4
  trumpet: 392.0,     // G4
  voice: 392.0,       // G4
}

/** The root note an instrument's sounds are built on, in Hz. */
export function rootFor(instrument: InstrumentType | undefined): number {
  return ROOTS[instrument ?? 'piano'] ?? 261.63
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

/**
 * Sound borrows the app's single context rather than owning one — see
 * lib/audio/engine. Three independent contexts was over Safari's budget
 * before the tuner even opened.
 *
 * `ready()` yields the context only when it is actually running. Notes
 * scheduled on a suspended clock never sound and raise nothing, which is
 * exactly how audio disappeared twice without a single error to follow.
 */
function getContext(): AudioContext | null {
  return ready()
}

/**
 * Open or resume audio. Call as the first line of a click handler, before
 * any `await` — Safari only honours resume() synchronously inside the
 * gesture's own call stack, unlike Chrome, which resumes long afterwards
 * and thereby hides this whole class of bug during testing.
 */
export function primeAudioContext(): void {
  if (isSoundMuted()) return
  unlock()
}

/**
 * Installed once at app start. Every gesture re-opens audio rather than
 * only the first: Safari suspends the context when the tab is
 * backgrounded, and the previous arm-once-then-detach approach made the
 * first suspension permanent.
 */
export function armAudioContext(): void {
  installAudioUnlock()
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

/**
 * Mastery — the largest moment in the app, and the only one earned by the
 * music rather than by turning up.
 *
 * A perfect authentic cadence (V7 - I) rather than the badge's rising
 * arpeggio: the badge fanfare announces, this one *resolves*. For a
 * musician that difference carries the whole meaning, and it makes the two
 * unmistakable even heard from another room.
 */
export function playMasteryCadence(): void {
  if (isSoundMuted()) return
  const audio = getContext()
  if (!audio) return

  const bus = audio.createGain()
  bus.gain.value = 0.8
  bus.connect(audio.destination)

  const tonic = 261.63 // C4
  const now = audio.currentTime

  // V7 — G B D F, voiced low and left slightly unresolved.
  const dominant = [-5, -1, 2, 5]
  for (const steps of dominant) {
    const gain = audio.createGain()
    gain.connect(bus)
    const osc = audio.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = semitone(tonic, steps)
    osc.connect(gain)
    osc.start(now)
    osc.stop(now + 0.75)
    envelope(gain, now, 0.11, 0.03, 0.7)
  }

  // I — the resolution, arriving a beat later and an octave wider.
  const at = now + 0.42
  for (const steps of [-12, 0, 4, 7, 12]) {
    const gain = audio.createGain()
    gain.connect(bus)
    const osc = audio.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = semitone(tonic, steps)
    osc.connect(gain)
    osc.start(at)
    osc.stop(at + 2.2)
    envelope(gain, at, 0.13, 0.04, 2.1)
  }

  // A high shimmer on the tonic, so the chord rings rather than stops.
  const shimmer = audio.createGain()
  shimmer.connect(bus)
  const bell = audio.createOscillator()
  bell.type = 'sine'
  bell.frequency.value = semitone(tonic, 24)
  bell.connect(shimmer)
  bell.start(at + 0.1)
  bell.stop(at + 2.2)
  envelope(shimmer, at + 0.1, 0.05, 0.05, 2.0)
}

/**
 * Handing an assignment in.
 *
 * Deliberately unresolved: a rising figure that stops on the dominant
 * rather than returning home. Submitting is not finishing — the teacher
 * has not looked at it yet — and a cadence that lands would promise an
 * outcome the student has not had. The mastery sound resolves because
 * mastery is an arrival; this one asks a question.
 *
 * Short, too. This happens often, and a long flourish every time an
 * exercise is handed in becomes something to sit through.
 */
export function playSubmitChime(): void {
  if (isSoundMuted()) return
  const audio = getContext()
  if (!audio) return

  const bus = audio.createGain()
  bus.gain.value = 0.7
  bus.connect(audio.destination)

  const tonic = 329.63 // E4
  const now = audio.currentTime

  // Three notes climbing to the fifth and stopping there.
  const rise = [0, 4, 7]
  rise.forEach((steps, i) => {
    const at = now + i * 0.07
    const gain = audio.createGain()
    gain.connect(bus)
    const osc = audio.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = semitone(tonic, steps)
    osc.connect(gain)
    osc.start(at)
    osc.stop(at + 0.5)
    envelope(gain, at, 0.15, 0.006, 0.45)
  })

  // A breath of air underneath the last note — the sound of it leaving.
  const at = now + rise.length * 0.07
  const noise = audio.createBufferSource()
  const len = Math.floor(audio.sampleRate * 0.4)
  const buf = audio.createBuffer(1, len, audio.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    // Fades as it goes, so it reads as departing rather than arriving.
    data[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.35
  }
  noise.buffer = buf
  const hp = audio.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 2200
  const ng = audio.createGain()
  noise.connect(hp); hp.connect(ng); ng.connect(bus)
  noise.start(at)
  envelope(ng, at, 0.1, 0.02, 0.38)
}

/* ── Badge unlocks: one sound per reveal ─────────────────────────────
 * Sound effects first, music second: the flip sounds like a card, the
 * shatter like ice giving way, the charge like something powering up and
 * ringing when full. Each is timed to its animation in BadgeMoment and
 * starts when the moment opens. A small chime in a random key marks the
 * unlock itself, so two in a row are never identical.
 */

const BADGE_KEYS = [392.0, 440.0, 349.23, 523.25] // G4, A4, F4, C5
const pickKey = () => BADGE_KEYS[Math.floor(Math.random() * BADGE_KEYS.length)]

function badgeBus(audio: AudioContext, level = 0.9): GainNode {
  const bus = audio.createGain()
  bus.gain.value = level
  bus.connect(audio.destination)
  return bus
}

function tone(audio: AudioContext, bus: AudioNode, freq: number, at: number, dur: number, peak: number, type: OscillatorType = 'triangle') {
  const g = audio.createGain()
  g.connect(bus)
  const o = audio.createOscillator()
  o.type = type
  o.frequency.value = freq
  o.connect(g)
  o.start(at)
  o.stop(at + dur + 0.05)
  envelope(g, at, peak, 0.004, dur)
}

/** A short grain of filtered noise: the raw material of paper, ice and crackle. */
function grain(
  audio: AudioContext, bus: AudioNode, at: number, dur: number,
  filter: BiquadFilterType, freq: number, q: number, peak: number,
  sweepTo?: number,
) {
  const len = Math.max(1, Math.floor(audio.sampleRate * dur))
  const buf = audio.createBuffer(1, len, audio.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = audio.createBufferSource()
  src.buffer = buf
  const f = audio.createBiquadFilter()
  f.type = filter
  f.Q.value = q
  f.frequency.setValueAtTime(freq, at)
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur)
  const g = audio.createGain()
  src.connect(f).connect(g).connect(bus)
  envelope(g, at, peak, 0.002, dur)
  src.start(at)
  src.stop(at + dur + 0.02)
}

/** The unlock's own small chime, on top of whichever effect. */
function chime(audio: AudioContext, bus: AudioNode, root: number, at: number, level = 1) {
  for (const s of [0, 4, 7]) tone(audio, bus, semitone(root, s + 12), at, 0.9, 0.05 * level, 'sine')
  tone(audio, bus, semitone(root, 24), at + 0.06, 0.6, 0.03 * level, 'sine')
}

/**
 * Card flip: the papery "fwip" of a card turning over, quickening as it
 * spins, then the soft slap of it landing face up.
 */
export function playBadgeFlip(): void {
  if (isSoundMuted()) return
  const audio = getContext()
  if (!audio) return
  const bus = badgeBus(audio)
  const now = audio.currentTime
  // The spin (0.6s to 1.25s): each half-turn is one flick of card past air.
  const flicks = [0.62, 0.8, 0.94, 1.04, 1.12, 1.18]
  flicks.forEach((t, i) => {
    grain(audio, bus, now + t, 0.07, 'bandpass', 2600 + i * 250, 1.4, 0.32, 5200)
    // A faint low body under each, the card's own weight.
    grain(audio, bus, now + t, 0.05, 'lowpass', 600, 0.7, 0.12)
  })
  // Landing (1.35s): a flat slap, then a tick as it settles.
  grain(audio, bus, now + 1.33, 0.09, 'lowpass', 1400, 0.8, 0.45)
  grain(audio, bus, now + 1.33, 0.04, 'highpass', 3500, 0.7, 0.18)
  grain(audio, bus, now + 1.43, 0.025, 'bandpass', 3000, 2, 0.12)
  chime(audio, bus, pickKey(), now + 1.38)
}

/**
 * Ice cracking: creaks and sharp ticks spreading through the shell, a
 * groan, then the break — a crack, and a spray of tinkling ice shards.
 */
export function playBadgeShatter(): void {
  if (isSoundMuted()) return
  const audio = getContext()
  if (!audio) return
  const bus = badgeBus(audio)
  const now = audio.currentTime
  // Cracking (0.55s to 1.0s): irregular ticks, each ringing briefly like ice under stress.
  let t = 0.55
  while (t < 1.0) {
    const f = 1800 + Math.random() * 3200
    grain(audio, bus, now + t, 0.03, 'bandpass', f, 9, 0.35 + Math.random() * 0.2)
    // The ring of the ice: a short high resonance after each tick.
    tone(audio, bus, f * (1.5 + Math.random()), now + t + 0.005, 0.12, 0.012, 'sine')
    t += 0.035 + Math.random() * 0.07
  }
  // The groan under it: a low resonant creak bending down.
  grain(audio, bus, now + 0.6, 0.4, 'bandpass', 420, 12, 0.22, 260)
  // The break (1.05s): one hard crack…
  grain(audio, bus, now + 1.05, 0.08, 'highpass', 1500, 0.7, 0.6)
  grain(audio, bus, now + 1.05, 0.14, 'lowpass', 300, 0.9, 0.35)
  // …and the shards: dozens of tiny glassy tinkles scattering and fading.
  for (let i = 0; i < 26; i++) {
    const at = now + 1.08 + i * 0.022 + Math.random() * 0.04
    const f = 3000 + Math.random() * 5000
    tone(audio, bus, f, at, 0.08 + Math.random() * 0.12, 0.012 + Math.random() * 0.015, 'sine')
    if (i % 3 === 0) grain(audio, bus, at, 0.02, 'bandpass', f, 15, 0.12)
  }
  chime(audio, bus, pickKey(), now + 1.2, 0.8)
}

/**
 * Charging ring: a pulsing tone climbing as the ring fills, its pulse
 * speeding up as it nears full, then a bell rings out at 100%.
 */
export function playBadgeCharge(): void {
  if (isSoundMuted()) return
  const audio = getContext()
  if (!audio) return
  const bus = badgeBus(audio)
  const root = pickKey()
  const now = audio.currentTime
  const start = now + 0.35
  const end = now + 1.45
  // The charge: two detuned sines climbing two octaves…
  const g = audio.createGain()
  g.gain.value = 0
  const tremolo = audio.createGain()
  tremolo.gain.value = 0.5
  const lfo = audio.createOscillator()
  const lfoDepth = audio.createGain()
  lfo.frequency.setValueAtTime(6, start)
  lfo.frequency.exponentialRampToValueAtTime(28, end) // …pulsing faster as it fills
  lfoDepth.gain.value = 0.5
  lfo.connect(lfoDepth).connect(tremolo.gain)
  for (const detune of [0, 7]) {
    const o = audio.createOscillator()
    o.type = 'sine'
    o.detune.value = detune
    o.frequency.setValueAtTime(root / 2, start)
    o.frequency.exponentialRampToValueAtTime(root * 2, end)
    o.connect(tremolo)
    o.start(start)
    o.stop(end + 0.05)
  }
  tremolo.connect(g).connect(bus)
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(0.09, start + 0.2)
  g.gain.setValueAtTime(0.11, end - 0.04)
  g.gain.exponentialRampToValueAtTime(0.0001, end + 0.03)
  lfo.start(start)
  lfo.stop(end + 0.05)
  // Full: a bell. Inharmonic partials, like struck metal, ringing out.
  const partials: [number, number, number][] = [[1, 0.16, 2.2], [2.76, 0.07, 1.4], [5.4, 0.04, 0.9], [8.93, 0.025, 0.6]]
  for (const [ratio, peak, dur] of partials) tone(audio, bus, root * 2 * ratio, end, dur, peak, 'sine')
  grain(audio, bus, end, 0.03, 'highpass', 5000, 0.7, 0.2)
}
