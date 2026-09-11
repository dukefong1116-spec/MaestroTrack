import { describe, it, expect } from 'vitest'
import { format } from 'date-fns'
import {
  freezesEarned, freezesAvailable, decideFreezes, weekStrip, MAX_FREEZES,
} from '../streakFreeze'
import type { PracticeSession } from '@/types'

const d = (n: number) => {
  const x = new Date()
  x.setDate(x.getDate() - n)
  return format(x, 'yyyy-MM-dd')
}
const S = (date: string): PracticeSession => ({
  id: `s-${date}`, userId: 'u1', date, durationMinutes: 30,
  category: 'Repertoire', difficultyRating: 3, confidenceRating: 8, createdAt: date,
})

describe('earning freezes', () => {
  it('grants one per full week of streak', () => {
    expect(freezesEarned(0)).toBe(0)
    expect(freezesEarned(6)).toBe(0)
    expect(freezesEarned(7)).toBe(1)
    expect(freezesEarned(20)).toBe(2)
  })

  it('caps how many can be held at once', () => {
    expect(freezesAvailable(700, [])).toBe(MAX_FREEZES)
  })

  it('subtracts what has been spent', () => {
    expect(freezesAvailable(14, [])).toBe(2)
    expect(freezesAvailable(14, [d(5)])).toBe(1)
    expect(freezesAvailable(14, [d(5), d(9)])).toBe(0)
  })

  it('never goes negative', () => {
    expect(freezesAvailable(7, [d(2), d(5), d(9)])).toBe(0)
  })
})

describe('deciding when to spend', () => {
  it('does nothing when today is already practised', () => {
    expect(decideFreezes([S(d(0)), S(d(1))], [], 14).freeze).toEqual([])
  })

  it('does nothing when yesterday was practised — streak is not at risk yet', () => {
    expect(decideFreezes([S(d(1)), S(d(2))], [], 14).freeze).toEqual([])
  })

  it('freezes yesterday to rescue a lapsed streak', () => {
    // practised up to 2 days ago, missed yesterday, nothing today
    const sessions = [S(d(2)), S(d(3)), S(d(4))]
    const out = decideFreezes(sessions, [], 14)
    expect(out.freeze).toEqual([d(1)])
    expect(out.rescuedStreak).toBe(4)
  })

  it('will not spend more freezes than are available', () => {
    // two-day gap but only one freeze earned
    const sessions = [S(d(3)), S(d(4)), S(d(5)), S(d(6)), S(d(7)), S(d(8)), S(d(9))]
    expect(decideFreezes(sessions, [], 7).freeze).toEqual([])
  })

  it('spans a two-day gap when two freezes are available', () => {
    const sessions = [S(d(3)), S(d(4)), S(d(5))]
    const out = decideFreezes(sessions, [], 14)
    expect(out.freeze).toEqual([d(1), d(2)])
    expect(out.rescuedStreak).toBe(5)
  })

  it('never freezes today, even when unpractised', () => {
    const out = decideFreezes([S(d(1))], [], 14)
    expect(out.freeze).not.toContain(d(0))
  })

  it('is idempotent — a day already frozen is not re-spent', () => {
    const sessions = [S(d(2)), S(d(3))]
    const out = decideFreezes(sessions, [d(1)], 14)
    expect(out.freeze).toEqual([])
  })

  it('does not rescue when there was no streak to begin with', () => {
    expect(decideFreezes([S(d(9))], [], 14).freeze).toEqual([])
  })

  it('does nothing with no sessions at all', () => {
    expect(decideFreezes([], [], 14).freeze).toEqual([])
  })
})

describe('week strip', () => {
  const strip = weekStrip([S(d(0))], [])

  it('is seven days, Monday first', () => {
    expect(strip).toHaveLength(7)
    expect(strip[0].label).toBe('M')
  })

  it('marks exactly one day as today', () => {
    expect(strip.filter((x) => x.isToday)).toHaveLength(1)
  })

  it('flags the practised day', () => {
    expect(strip.find((x) => x.date === d(0))?.practised).toBe(true)
  })

  it('distinguishes frozen from practised', () => {
    const s = weekStrip([S(d(0))], [d(1)])
    expect(s.find((x) => x.date === d(1))?.frozen).toBe(true)
    expect(s.find((x) => x.date === d(1))?.practised).toBe(false)
  })

  it('does not mark a practised day as frozen even if both are recorded', () => {
    const s = weekStrip([S(d(0))], [d(0)])
    expect(s.find((x) => x.date === d(0))?.frozen).toBe(false)
  })
})
