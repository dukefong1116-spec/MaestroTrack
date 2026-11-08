import { describe, expect, it } from 'vitest'
import { boostFor, integratedLoudness } from '../loudness'

/**
 * The loudness maths, against sine waves of known level.
 *
 * A sine of amplitude A has a mean square of A²/2, so its loudness here is
 * −0.691 + 10·log10(A²/2) — every expected figure below is that formula,
 * worked by hand, rather than a number read back off the code.
 */

const SR = 48000

function sine(amplitude: number, seconds: number, hz = 440): Float32Array {
  const out = new Float32Array(Math.round(SR * seconds))
  for (let i = 0; i < out.length; i++) out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / SR)
  return out
}

function silence(seconds: number): Float32Array {
  return new Float32Array(Math.round(SR * seconds))
}

function join(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) { out.set(p, at); at += p.length }
  return out
}

const expected = (amplitude: number) => -0.691 + 10 * Math.log10((amplitude * amplitude) / 2)

describe('integratedLoudness', () => {
  it('reads a steady tone at the level the formula says', () => {
    expect(integratedLoudness([sine(0.1, 3)], SR)).toBeCloseTo(expected(0.1), 1) // ≈ −23.7
    expect(integratedLoudness([sine(0.5, 3)], SR)).toBeCloseTo(expected(0.5), 1) // ≈ −9.7
  })

  it('is not dragged down by silence before and after the playing', () => {
    // The case that matters most for a practice take: you press record,
    // wait, play, and stop a few seconds later. Ungated, the silence would
    // read the take as far quieter than it is and over-boost it.
    const take = join(silence(3), sine(0.1, 2), silence(3))
    const gated = integratedLoudness([take], SR)!
    // Ungated, 2 s of tone in 8 s of take reads a quarter of the power:
    // 6 dB low, and the take would be boosted 6 dB too far.
    const ungated = expected(0.1) + 10 * Math.log10(2 / 8)

    // Within a decibel of the tone itself. Not exactly on it: the 400 ms
    // blocks that straddle the edges are part silence and pass the gate,
    // which BS.1770 does too.
    expect(Math.abs(gated - expected(0.1))).toBeLessThan(1)
    // And nowhere near what it would read without the gate.
    expect(gated - ungated).toBeGreaterThan(5)
  })

  it('returns nothing for silence, rather than an infinite boost', () => {
    expect(integratedLoudness([silence(2)], SR)).toBeNull()
  })

  it('copes with a take shorter than one 400 ms block', () => {
    expect(integratedLoudness([sine(0.1, 0.25)], SR)).toBeCloseTo(expected(0.1), 0)
  })

  it('sums channel power, as BS.1770 does, rather than averaging it', () => {
    const one = integratedLoudness([sine(0.1, 2)], SR)!
    const two = integratedLoudness([sine(0.1, 2), sine(0.1, 2)], SR)!
    expect(two - one).toBeCloseTo(10 * Math.log10(2), 1) // +3 dB
  })

  it('returns nothing for an empty buffer', () => {
    expect(integratedLoudness([new Float32Array(0)], SR)).toBeNull()
    expect(integratedLoudness([], SR)).toBeNull()
  })
})

describe('boostFor', () => {
  it('lifts a quiet take to the −16 target', () => {
    expect(boostFor(-23.7)).toBeCloseTo(7.7, 5)
  })

  it('never turns a take down — the complaint was quiet, not loud', () => {
    expect(boostFor(-9)).toBe(0)
    expect(boostFor(-16)).toBe(0)
  })

  it('stops at +24 dB, so a near-silent take is not blown up into hiss', () => {
    expect(boostFor(-60)).toBe(24)
  })

  it('leaves silence alone', () => {
    expect(boostFor(null)).toBe(0)
  })

  it('takes a real phone-mic level to a normal one, end to end', () => {
    // An instrument through an iPhone mic with AGC off commonly sits around
    // −30 LUFS. That lands 14 dB short of the target, and gets all of it.
    const quiet = integratedLoudness([sine(0.04, 3)], SR)!
    const db = boostFor(quiet)
    expect(quiet + db).toBeCloseTo(-16, 1)
  })
})
