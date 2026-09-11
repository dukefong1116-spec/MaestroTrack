import { describe, it, expect } from 'vitest'
import { format } from 'date-fns'
import { xpForLevel, levelForXp, computeProgression, BADGES, buildBadgeContext, earnedBadges } from '../progression'
import type { PracticeSession } from '@/types'

const d = (n: number) => { const x = new Date(); x.setDate(x.getDate() - n); return format(x, 'yyyy-MM-dd') }
const S = (date: string, min = 30): PracticeSession => ({
  id: `s-${date}-${min}`, userId: 'u1', date, durationMinutes: min,
  category: 'Repertoire', difficultyRating: 3, confidenceRating: 8, createdAt: date,
})

describe('level curve', () => {
  it('starts at level 1 with no xp', () => {
    expect(levelForXp(0)).toBe(1)
    expect(xpForLevel(1)).toBe(0)
  })

  it('rises monotonically', () => {
    for (let l = 1; l < 12; l++) expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l))
  })

  it('each level costs more than the last', () => {
    const span = (l: number) => xpForLevel(l + 1) - xpForLevel(l)
    for (let l = 1; l < 10; l++) expect(span(l + 1)).toBeGreaterThan(span(l))
  })

  it('levelForXp inverts xpForLevel', () => {
    for (let l = 1; l < 12; l++) {
      expect(levelForXp(xpForLevel(l))).toBe(l)
      expect(levelForXp(xpForLevel(l + 1) - 1)).toBe(l)
    }
  })

  it('paces early levels within a few days of practice', () => {
    // ~30 min/day at goal = 30 + 25 + 50 = 105 xp/day
    expect(xpForLevel(2)).toBeLessThanOrEqual(210) // reachable in ~2 days
    expect(xpForLevel(5)).toBeGreaterThan(1000)    // but level 5 is a real climb
  })
})

describe('xp accrual', () => {
  it('is zero with no sessions', () => {
    expect(computeProgression([], 43).totalXp).toBe(0)
  })

  it('counts minutes plus a per-session bonus', () => {
    // one 30-min session, daily goal 999 so no goal bonus, no streak milestone
    expect(computeProgression([S(d(0), 30)], 999).totalXp).toBe(30 + 25)
  })

  it('awards the daily-goal bonus once per day, not per session', () => {
    const twoSameDay = [S(d(0), 30), S(d(0), 30)]
    // 60 min + 2x25 + one 50 bonus
    expect(computeProgression(twoSameDay, 43).totalXp).toBe(60 + 50 + 50)
  })

  it('percent stays within bounds', () => {
    for (const n of [0, 1, 5, 40, 300]) {
      const sessions = Array.from({ length: n }, (_, i) => S(d(i)))
      const p = computeProgression(sessions, 43)
      expect(p.percent).toBeGreaterThanOrEqual(0)
      expect(p.percent).toBeLessThanOrEqual(100)
      expect(p.xpIntoLevel).toBeLessThan(p.xpForThisLevel)
    }
  })
})

describe('badges', () => {
  it('have unique ids', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length)
  })

  it('none are earned with no history', () => {
    expect(earnedBadges(buildBadgeContext([]))).toHaveLength(0)
  })

  it('first session unlocks exactly one badge', () => {
    const earned = earnedBadges(buildBadgeContext([S(d(0), 10)]))
    expect(earned.map((b) => b.id)).toEqual(['first_session'])
  })

  it('a 60-minute session unlocks the marathon badge', () => {
    const earned = earnedBadges(buildBadgeContext([S(d(0), 60)]))
    expect(earned.map((b) => b.id)).toContain('marathon')
  })

  it('a 7-day run unlocks week warrior', () => {
    const week = Array.from({ length: 7 }, (_, i) => S(d(i)))
    expect(earnedBadges(buildBadgeContext(week)).map((b) => b.id)).toContain('week_warrior')
  })

  it('counts frozen days toward streak badges', () => {
    // six practised days with a frozen gap in the middle = a 7-day run
    const sessions = [S(d(0)), S(d(1)), S(d(2)), S(d(4)), S(d(5)), S(d(6))]
    const without = earnedBadges(buildBadgeContext(sessions)).map((b) => b.id)
    const withFreeze = earnedBadges(buildBadgeContext(sessions, [d(3)])).map((b) => b.id)
    expect(without).not.toContain('week_warrior')
    expect(withFreeze).toContain('week_warrior')
  })
})
