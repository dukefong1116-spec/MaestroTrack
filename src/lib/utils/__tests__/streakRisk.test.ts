import { describe, it, expect } from 'vitest'
import { streakRisk, riskCopy } from '../streakRisk'
import type { PracticeSession } from '@/types'

const sess = (date: string): PracticeSession => ({
  id: date, userId: 'u', date, durationMinutes: 30, category: 'Technique',
  difficultyRating: 3, confidenceRating: 7, createdAt: '',
})

const at = (iso: string) => new Date(iso)

describe('streakRisk', () => {
  it('is silent when there is no streak to lose', () => {
    expect(streakRisk([], 0, 0, at('2026-09-10T22:00:00')).level).toBe('none')
  })

  it('is silent once today has been practised', () => {
    const r = streakRisk([sess('2026-09-10')], 5, 0, at('2026-09-10T22:00:00'))
    expect(r.level).toBe('none')
  })

  it('escalates through the evening', () => {
    const s = [sess('2026-09-09')]
    expect(streakRisk(s, 5, 0, at('2026-09-10T10:00:00')).level).toBe('calm')
    expect(streakRisk(s, 5, 0, at('2026-09-10T19:00:00')).level).toBe('firm')
    expect(streakRisk(s, 5, 0, at('2026-09-10T22:00:00')).level).toBe('urgent')
  })

  it('counts to local midnight, not a fixed offset', () => {
    const r = streakRisk([sess('2026-09-09')], 5, 0, at('2026-09-10T21:30:00'))
    expect(r.minutesLeft).toBe(150)
    // Floors rather than rounding — it may never claim more time than is left.
    expect(r.timeLeft).toBe('2 hours')
  })

  it('reports whether a freeze would cover the night', () => {
    const s = [sess('2026-09-09')]
    expect(streakRisk(s, 5, 2, at('2026-09-10T22:00:00')).freezeCovers).toBe(true)
    expect(streakRisk(s, 5, 0, at('2026-09-10T22:00:00')).freezeCovers).toBe(false)
  })

  it('humanises the remaining time', () => {
    const s = [sess('2026-09-09')]
    expect(streakRisk(s, 5, 0, at('2026-09-10T23:25:00')).timeLeft).toBe('35 minutes')
    expect(streakRisk(s, 5, 0, at('2026-09-10T22:50:00')).timeLeft).toBe('70 minutes')
    // Never rounds up: at 21:00 there are exactly three hours left.
    expect(streakRisk(s, 5, 0, at('2026-09-10T21:00:00')).timeLeft).toBe('3 hours')
    expect(streakRisk(s, 5, 0, at('2026-09-10T20:30:00')).timeLeft).toBe('3 hours')
  })
})

describe('riskCopy', () => {
  const s = [sess('2026-09-09')]

  it('says nothing when there is no risk', () => {
    expect(riskCopy(streakRisk([], 0, 0, at('2026-09-10T22:00:00')))).toBe('')
  })

  it('names the stake and the time when urgent', () => {
    const copy = riskCopy(streakRisk(s, 23, 0, at('2026-09-10T22:00:00')))
    expect(copy).toContain('23-day streak')
    expect(copy).toContain('2 hours')
  })

  it('mentions the freeze only when one is available', () => {
    const withFreeze = riskCopy(streakRisk(s, 23, 1, at('2026-09-10T22:00:00')))
    const without = riskCopy(streakRisk(s, 23, 0, at('2026-09-10T22:00:00')))
    expect(withFreeze).toContain('freeze')
    expect(without).not.toContain('freeze')
  })

  it('stays gentle in the morning', () => {
    expect(riskCopy(streakRisk(s, 23, 0, at('2026-09-10T09:00:00')))).toContain('going')
  })
})
