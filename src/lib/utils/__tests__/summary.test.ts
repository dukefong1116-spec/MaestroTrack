import { describe, it, expect } from 'vitest'
import { buildSummaries, sessionsFromSummary, minutesOn } from '../summary'
import { getDailyData, getCategoryData } from '../analytics'
import type { PracticeSession } from '@/types'

const profile = { uid: 'u1', displayName: 'Ana', instrument: 'violin' as const }

const sess = (date: string, minutes: number, category = 'Technique', over: Partial<PracticeSession> = {}): PracticeSession => ({
  id: date + category + minutes, userId: 'u1', date, durationMinutes: minutes,
  category: category as PracticeSession['category'],
  difficultyRating: 3, confidenceRating: 7, createdAt: '', ...over,
})

const now = new Date('2026-10-06T12:00:00')

describe('buildSummaries', () => {
  it('totals minutes per day', () => {
    const { studio } = buildSummaries([sess('2026-10-05', 30), sess('2026-10-05', 15)], profile, now)
    expect(studio.dailyMinutes['2026-10-05']).toBe(45)
  })

  it('breaks the day down by category for the teacher only', () => {
    const { summary, studio } = buildSummaries(
      [sess('2026-10-05', 30, 'Scales'), sess('2026-10-05', 15, 'Repertoire')], profile, now)
    expect(summary.dailyCategories['2026-10-05']).toEqual({ Scales: 30, Repertoire: 15 })
    // What classmates see carries no breakdown at all.
    expect(studio).not.toHaveProperty('dailyCategories')
  })

  it('carries nothing private into either document', () => {
    const withSecrets = [sess('2026-10-05', 30, 'Scales', {
      notes: 'this is awful and I hate it', pieceName: 'piece-abc',
    })]
    const { studio, summary } = buildSummaries(withSecrets, profile, now)
    const serialised = JSON.stringify({ studio, summary })
    expect(serialised).not.toContain('awful')
    expect(serialised).not.toContain('piece-abc')
  })

  it('drops history past the retention window, so the document stays bounded', () => {
    const old = sess('2023-01-01', 60)
    const { studio } = buildSummaries([old, sess('2026-10-05', 30)], profile, now)
    expect(studio.dailyMinutes['2023-01-01']).toBeUndefined()
    expect(Object.keys(studio.dailyMinutes)).toEqual(['2026-10-05'])
  })

  it('carries the streak, which a leaderboard wants and a session list cannot cheaply give', () => {
    const { studio } = buildSummaries([sess('2026-10-05', 30)], profile, now)
    expect(typeof studio.currentStreak).toBe('number')
  })
})

describe('sessionsFromSummary', () => {
  it('rebuilds enough for the teacher charts to work unchanged', () => {
    const real = [
      sess('2026-10-05', 30, 'Scales'),
      sess('2026-10-05', 15, 'Repertoire'),
      sess('2026-10-04', 40, 'Scales'),
    ]
    const { summary } = buildSummaries(real, profile, now)
    const rebuilt = sessionsFromSummary(summary)

    // The two aggregates the teacher's page actually renders.
    expect(getCategoryData(rebuilt).find((c) => c.category === 'Scales')?.minutes).toBe(70)
    // getDailyData labels days 'MMM dd', not ISO.
    const daily = getDailyData(rebuilt, 14)
    expect(daily.find((d) => d.date === 'Oct 05')?.minutes).toBe(45)
    expect(daily.find((d) => d.date === 'Oct 04')?.minutes).toBe(40)
  })

  it('reconstructs nothing private, because the summary never held it', () => {
    const { summary } = buildSummaries(
      [sess('2026-10-05', 30, 'Scales', { notes: 'secret', pieceName: 'p1' })], profile, now)
    const rebuilt = sessionsFromSummary(summary)
    expect(rebuilt[0].notes).toBeUndefined()
    expect(rebuilt[0].pieceName).toBeUndefined()
  })

  it('is empty rather than throwing when a student has no summary yet', () => {
    expect(sessionsFromSummary(null)).toEqual([])
  })
})

describe('minutesOn', () => {
  it('reads a day, or zero', () => {
    const { studio } = buildSummaries([sess('2026-10-05', 30)], profile, now)
    expect(minutesOn(studio, '2026-10-05')).toBe(30)
    expect(minutesOn(studio, '2026-10-04')).toBe(0)
    expect(minutesOn(null, '2026-10-05')).toBe(0)
  })
})
