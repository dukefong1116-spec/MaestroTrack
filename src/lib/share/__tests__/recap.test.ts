import { describe, it, expect } from 'vitest'
import { monthRecap, recapMonth } from '../recap'
import { isStreakMilestone, streakShare, weekShare } from '../moments'
import { DEFAULT_SHARE_OPTIONS } from '../fields'
import type { Piece, PracticeSession } from '@/types'

/** A session on `date`, started at `hour` local time, `min` long. */
const S = (date: string, hour: number, min: number, over: Partial<PracticeSession> = {}): PracticeSession => {
  const end = new Date(`${date}T00:00:00`)
  end.setHours(hour, 0, 0, 0)
  end.setMinutes(end.getMinutes() + min)
  return { id: `${date}-${hour}`, userId: 'u', date, durationMinutes: min, category: 'Scales', createdAt: end.toISOString(), ...over } as PracticeSession
}
const pieces = [{ id: 'p1', title: 'Clair de Lune' }, { id: 'p2', title: 'Etude' }] as Piece[]

describe('monthly recap', () => {
  it('sums the month, finds the best run and the top piece', () => {
    const r = monthRecap([
      S('2026-11-02', 17, 30, { pieceMinutes: { p1: 20, p2: 10 } }),
      S('2026-11-03', 17, 20, { pieceMinutes: { p1: 20 } }),
      S('2026-11-04', 17, 25, { pieceMinutes: { p2: 25 } }),
      S('2026-11-10', 17, 15),
      S('2026-10-30', 17, 99),
    ], pieces, 2026, 10)!
    expect(r.month).toBe('November')
    expect(r.minutes).toBe(90)
    expect(r.days).toBe(4)
    expect(r.bestStreak).toBe(3)
    expect(r.topPiece).toBe('Clair de Lune')
    expect(r.style).toBe('little-and-often')
  })

  it('names the habit that stands out', () => {
    expect(monthRecap([S('2026-11-02', 22, 30), S('2026-11-03', 21, 30)], [], 2026, 10)!.style).toBe('night-owl')
    expect(monthRecap([S('2026-11-02', 6, 30), S('2026-11-03', 7, 30)], [], 2026, 10)!.style).toBe('early-bird')
    // 7 and 8 November 2026 are a Saturday and a Sunday.
    expect(monthRecap([S('2026-11-07', 14, 30), S('2026-11-08', 14, 30)], [], 2026, 10)!.style).toBe('weekend-warrior')
    expect(monthRecap([S('2026-11-04', 14, 60), S('2026-11-05', 14, 50)], [], 2026, 10)!.style).toBe('marathoner')
  })

  it('nothing to show for an empty month', () => {
    expect(monthRecap([], [], 2026, 10)).toBeNull()
  })

  it('shows last month in the first days of a new one', () => {
    const s = [S('2026-10-20', 17, 30)]
    expect(recapMonth(s, new Date(2026, 10, 2))).toEqual([2026, 9])
    expect(recapMonth(s, new Date(2026, 10, 12))).toEqual([2026, 10])
    expect(recapMonth([], new Date(2026, 10, 2))).toEqual([2026, 10])
  })
})

describe('share moments', () => {
  it('milestones are the round-number days', () => {
    expect([3, 7, 30, 100, 365, 500].every(isStreakMilestone)).toBe(true)
    expect([1, 2, 8, 31, 366].some(isStreakMilestone)).toBe(false)
  })

  it('a name only when "My name" is on', () => {
    const r = streakShare(30, 20, 'Ana Rivera')
    expect(r.build(DEFAULT_SHARE_OPTIONS).name).toBe('Ana Rivera')
    expect(r.build({ ...DEFAULT_SHARE_OPTIONS, includeName: false }).name).toBeUndefined()
  })

  it('a streak on the week card only when "Streak" is on', () => {
    const r = weekShare([10, 0, 20, 30, 0, 15, 25], 'Nov 17 – Nov 23', undefined, 12)
    expect(r.build(DEFAULT_SHARE_OPTIONS)).toMatchObject({ minutes: 100, streakDays: 12 })
    expect(r.build({ ...DEFAULT_SHARE_OPTIONS, includeStreak: false }).streakDays).toBeUndefined()
  })
})
