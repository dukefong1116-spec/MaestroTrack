import { afterAll, describe, expect, it, vi } from 'vitest'
import { computeSessionReward, rewardCopy } from '../gamification'
import { addDays } from '@/lib/streak/engine'
import type { PracticeSession } from '@/types'

/** What the celebration after a session says about the streak. */
vi.useFakeTimers()
vi.setSystemTime(new Date('2026-11-10T18:00:00'))
afterAll(() => { vi.useRealTimers() })

const TODAY = '2026-11-10'
const back = (n: number) => addDays(TODAY, -n)
const S = (date: string, minutes = 20): PracticeSession => ({
  id: `s-${date}-${minutes}`, userId: 'u', date, durationMinutes: minutes,
  category: 'Repertoire', difficultyRating: 3, confidenceRating: 3, createdAt: date,
})
const days = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => S(back(from + i)))
const reward = (before: PracticeSession[], minutes: number, plan = {}) =>
  computeSessionReward({ sessionsBefore: before, newSession: S(TODAY, minutes), dailyGoalMinutes: 30, plan })

describe('the streak in the celebration', () => {
  it('lights today and extends the streak', () => {
    const r = reward(days(1, 3), 20)
    expect(r).toMatchObject({ streakState: 'extended', streakBefore: 3, streakAfter: 4, thawed: false, minutesToLight: 0 })
  })
  it('under the daily minimum, says how much is left', () => {
    const rules = [{ from: back(30), min: 15, lessonDay: null }]
    const r = reward(days(1, 3), 5, { rules })
    expect(r).toMatchObject({ streakState: 'short', streakAfter: 3, minutesToLight: 10 })
    expect(rewardCopy(r).sub).toBe('10 more minutes today to light your flame.')
  })
  it('thaws a frozen flame', () => {
    const r = reward(days(2, 9), 20, { frozen: [back(1)] })
    expect(r).toMatchObject({ thawed: true, streakBefore: 8, streakAfter: 9 })
    expect(rewardCopy(r).headline).toBe('Flame thawed')
  })
  it('a short session leaves it frozen', () => {
    const rules = [{ from: back(30), min: 15, lessonDay: null }]
    const r = reward(days(2, 9), 5, { frozen: [back(1)], rules })
    expect(r).toMatchObject({ thawed: false, stillFrozen: true })
    expect(rewardCopy(r).sub).toContain('to thaw your flame')
  })
  it('earns a freeze on the seventh day', () => {
    expect(reward(days(1, 6), 20).freezeEarned).toBe(1)
    expect(reward(days(1, 5), 20).freezeEarned).toBeNull()
  })
  it('a comeback, day one then done — with the freeze its streak earns', () => {
    // A 5-day run, missed back(2), practised back(1): today completes it.
    const before = [S(back(1)), ...days(3, 7)]
    const r = reward(before, 20)
    expect(r).toMatchObject({ restored: 7, streakAfter: 7, freezeEarned: 1 })
    expect(rewardCopy(r).headline).toBe('Streak brought back')
    // The day before, the first of its two days.
    const first = computeSessionReward({ sessionsBefore: days(3, 7).map((s) => ({ ...s, date: addDays(s.date, -1) })), newSession: S(back(1)), dailyGoalMinutes: 30 })
    expect(first.streakState).toBe('backdated')
  })
  it('says one more day while a comeback is under way', () => {
    const r = reward(days(2, 6), 20)
    expect(r).toMatchObject({ streakState: 'restarted', comeback: { done: 1, restore: 5 } })
    expect(rewardCopy(r).sub).toBe('One more day tomorrow brings back your 5-day streak.')
  })
})
