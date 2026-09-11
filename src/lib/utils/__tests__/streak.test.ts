import { describe, it, expect } from 'vitest'
import { format } from 'date-fns'
import { computeStreak } from '../analytics'
import type { PracticeSession } from '@/types'

/**
 * Local-time yyyy-MM-dd for n days ago. Must match how the app writes
 * session dates (date-fns `format`, local) — toISOString() is UTC and
 * yields the wrong day for anyone behind it.
 */
const d = (n: number) => {
  const x = new Date()
  x.setDate(x.getDate() - n)
  return format(x, 'yyyy-MM-dd')
}

const S = (date: string): PracticeSession => ({
  id: `s-${date}-${Math.random()}`,
  userId: 'u1',
  date,
  durationMinutes: 30,
  category: 'Repertoire',
  difficultyRating: 3,
  confidenceRating: 8,
  createdAt: date,
})

describe('computeStreak — existing behaviour', () => {
  it('returns zero for no sessions', () => {
    expect(computeStreak([])).toEqual({ current: 0, longest: 0 })
  })

  it('counts a session today as a 1-day streak', () => {
    expect(computeStreak([S(d(0))]).current).toBe(1)
  })

  it('keeps the streak alive if the last session was yesterday', () => {
    expect(computeStreak([S(d(1))]).current).toBe(1)
  })

  it('breaks the streak if the last session was two days ago', () => {
    expect(computeStreak([S(d(2))]).current).toBe(0)
  })

  it('counts consecutive days', () => {
    expect(computeStreak([S(d(0)), S(d(1)), S(d(2))]).current).toBe(3)
  })

  it('collapses multiple sessions on one day into a single day', () => {
    expect(computeStreak([S(d(0)), S(d(0)), S(d(1))]).current).toBe(2)
  })

  it('stops at a gap', () => {
    // today, yesterday, then a hole at 2, then 3 and 4
    expect(computeStreak([S(d(0)), S(d(1)), S(d(3)), S(d(4))]).current).toBe(2)
  })

  it('reports the longest historical streak independently of the current one', () => {
    // a dead 4-day run long ago, plus a live 1-day run
    const sessions = [S(d(20)), S(d(21)), S(d(22)), S(d(23)), S(d(0))]
    const { current, longest } = computeStreak(sessions)
    expect(current).toBe(1)
    expect(longest).toBe(4)
  })

  it('is order-independent', () => {
    const asc = [S(d(2)), S(d(1)), S(d(0))]
    const desc = [S(d(0)), S(d(1)), S(d(2))]
    expect(computeStreak(asc).current).toBe(computeStreak(desc).current)
  })
})

describe('computeStreak — frozen days', () => {
  it('bridges a one-day gap that is frozen', () => {
    // practised today and 2 days ago; yesterday missed but frozen
    const sessions = [S(d(0)), S(d(2))]
    expect(computeStreak(sessions).current).toBe(1)
    expect(computeStreak(sessions, [d(1)]).current).toBe(3)
  })

  it('keeps a streak alive when yesterday was frozen and nothing logged today', () => {
    const sessions = [S(d(2)), S(d(3))]
    expect(computeStreak(sessions).current).toBe(0)
    expect(computeStreak(sessions, [d(1)]).current).toBe(3)
  })

  it('does not bridge a two-day gap with a single freeze', () => {
    const sessions = [S(d(0)), S(d(3))]
    expect(computeStreak(sessions, [d(1)]).current).toBe(2)
  })

  it('bridges a two-day gap with two freezes', () => {
    const sessions = [S(d(0)), S(d(3))]
    expect(computeStreak(sessions, [d(1), d(2)]).current).toBe(4)
  })

  it('ignores freezes on days that already have sessions', () => {
    const sessions = [S(d(0)), S(d(1))]
    expect(computeStreak(sessions, [d(0), d(1)]).current).toBe(2)
  })

  it('counts frozen days toward the longest streak too', () => {
    const sessions = [S(d(10)), S(d(12))]
    expect(computeStreak(sessions, [d(11)]).longest).toBe(3)
  })

  it('a freeze alone with no sessions is not a streak', () => {
    expect(computeStreak([], [d(1)]).current).toBe(0)
  })
})
