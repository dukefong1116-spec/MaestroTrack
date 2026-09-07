/**
 * Monophonic pitch detection by normalised autocorrelation.
 *
 * FFT peak-picking is unreliable for instruments with a strong overtone
 * series (a violin's second harmonic is often louder than its fundamental,
 * so you'd read an octave high). Autocorrelation matches the waveform
 * against a delayed copy of itself, which locks onto the true period.
 */

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const A4 = 440

export interface PitchReading {
  frequency: number
  /** e.g. "A" */
  note: string
  octave: number
  /** How far off, −50…+50. Zero is dead in tune. */
  cents: number
}

/** Root-mean-square level, used as a noise gate. */
export function rms(buf: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / buf.length)
}

/**
 * Returns the detected frequency in Hz, or null when the signal is too
 * quiet or too noisy to trust.
 */
export function detectPitch(buf: Float32Array, sampleRate: number): number | null {
  const SIZE = buf.length

  // Noise gate — below this it's room tone, not a note.
  if (rms(buf) < 0.012) return null

  // Trim leading/trailing near-silence so the correlation isn't diluted.
  const threshold = 0.2
  let start = 0
  let end = SIZE - 1
  while (start < SIZE / 2 && Math.abs(buf[start]) < threshold) start++
  while (end > SIZE / 2 && Math.abs(buf[end]) < threshold) end--

  const trimmed = buf.slice(start, end)
  const n = trimmed.length
  if (n < 512) return null

  // Raw autocorrelation.
  const c = new Float32Array(n).fill(0)
  for (let lag = 0; lag < n; lag++) {
    let sum = 0
    for (let i = 0; i < n - lag; i++) sum += trimmed[i] * trimmed[i + lag]
    c[lag] = sum
  }

  // Skip the zero-lag peak, then find the first real maximum after it.
  let d = 0
  while (d < n - 1 && c[d] > c[d + 1]) d++

  let maxVal = -1
  let maxPos = -1
  for (let i = d; i < n; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i]
      maxPos = i
    }
  }
  if (maxPos <= 0) return null

  // Parabolic interpolation around the peak for sub-sample accuracy.
  let T0 = maxPos
  const y1 = c[maxPos - 1]
  const y2 = c[maxPos]
  const y3 = c[maxPos + 1]
  if (y1 !== undefined && y3 !== undefined) {
    const a = (y1 + y3 - 2 * y2) / 2
    const b = (y3 - y1) / 2
    if (a !== 0) T0 = T0 - b / (2 * a)
  }

  const freq = sampleRate / T0
  // Outside the range of any instrument this app supports.
  if (freq < 55 || freq > 2100) return null

  // Weak correlation means we latched onto noise.
  if (maxVal / c[0] < 0.35) return null

  return freq
}

/** Maps a frequency onto the nearest note plus its cents deviation. */
export function toNote(frequency: number): PitchReading {
  const semitonesFromA4 = 12 * Math.log2(frequency / A4)
  const rounded = Math.round(semitonesFromA4)
  const cents = Math.round((semitonesFromA4 - rounded) * 100)

  // MIDI 69 is A4; C-1 is MIDI 0, so octave = floor(midi/12) - 1.
  const midi = rounded + 69
  const note = NOTE_NAMES[((midi % 12) + 12) % 12]
  const octave = Math.floor(midi / 12) - 1

  return { frequency, note, octave, cents }
}
