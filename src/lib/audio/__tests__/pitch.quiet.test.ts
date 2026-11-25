import { describe, it, expect } from 'vitest'
import { detectPitch } from '../pitch'

/** A note as a phone hears it from a music stand: quiet, not full scale. */
const tone = (freq: number, amp: number, sr = 48000, n = 4096) =>
  Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * freq * i) / sr))

describe('tuner sensitivity', () => {
  it('reads a quiet A4 (it read nothing below 0.2 amplitude before)', () => {
    const f = detectPitch(tone(440, 0.05), 48000)
    expect(f).not.toBeNull()
    expect(Math.abs((f as number) - 440)).toBeLessThan(2)
  })
  it('reads a cello C2 and a violin E5', () => {
    expect(Math.abs((detectPitch(tone(65.41, 0.08), 48000) as number) - 65.41)).toBeLessThan(1)
    expect(Math.abs((detectPitch(tone(659.25, 0.04), 48000) as number) - 659.25)).toBeLessThan(3)
  })
  it('still ignores room tone', () => {
    expect(detectPitch(tone(440, 0.003), 48000)).toBeNull()
  })
})
