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

/* ── quality weighting ─────────────────────────────────────────────── */

describe('XP rewards practice, not presence', () => {
  const day = (n: number) => `2026-03-${String(n).padStart(2, '0')}`
  const s = (over: Partial<PracticeSession> & { date: string; durationMinutes: number }): PracticeSession => ({
    id: Math.random().toString(36), userId: 'u', category: 'Technique',
    difficultyRating: 3, confidenceRating: 7, createdAt: '', ...over,
  })

  it('pays diminishing returns on a runaway timer', () => {
    // Six honest hours across six days beats one abandoned six-hour timer.
    const spread = [1, 2, 3, 4, 5, 6].map((d) => s({ date: day(d), durationMinutes: 60 }))
    const marathon = [s({ date: day(1), durationMinutes: 360 })]
    expect(computeProgression(spread, 40).totalXp)
      .toBeGreaterThan(computeProgression(marathon, 40).totalXp)
  })

  it('still pays more for a longer session than a shorter one', () => {
    const short = [s({ date: day(1), durationMinutes: 30 })]
    const long = [s({ date: day(1), durationMinutes: 120 })]
    expect(computeProgression(long, 40).totalXp)
      .toBeGreaterThan(computeProgression(short, 40).totalXp)
  })

  it('caps per day, not across the whole history', () => {
    // Two 90-minute days are uncapped; both should count in full.
    const two = [s({ date: day(1), durationMinutes: 90 }), s({ date: day(2), durationMinutes: 90 })]
    const one = [s({ date: day(1), durationMinutes: 180 })]
    expect(computeProgression(two, 40).totalXp)
      .toBeGreaterThan(computeProgression(one, 40).totalXp)
  })

  it('rewards returning to a piece on another day', () => {
    // Identical in every other respect — same minutes, same days, same
    // session count, same daily-goal days — so the gap is the return
    // bonus alone and nothing else.
    const scattered = [
      s({ date: day(1), durationMinutes: 30, pieceName: 'p1' }),
      s({ date: day(2), durationMinutes: 30, pieceName: 'p2' }),
    ]
    const returned = [
      s({ date: day(1), durationMinutes: 30, pieceName: 'p1' }),
      s({ date: day(2), durationMinutes: 30, pieceName: 'p1' }),
    ]
    const gap = computeProgression(returned, 40).totalXp - computeProgression(scattered, 40).totalXp
    expect(gap).toBe(15)
  })

  it('spreading the same work over two days beats cramming it into one', () => {
    // Both days clear the 40-minute goal, so this compares spacing rather
    // than accidentally comparing who hit their daily target. (Two 30s in
    // one day legitimately beats 30 + 30 across two: neither short day met
    // the goal the player set, and the goal bonus is larger than the
    // return bonus. That is the formula working, not a bug.)
    const crammed = [
      s({ date: day(1), durationMinutes: 60, pieceName: 'p1' }),
      s({ date: day(1), durationMinutes: 60, pieceName: 'p1' }),
    ]
    const spaced = [
      s({ date: day(1), durationMinutes: 60, pieceName: 'p1' }),
      s({ date: day(2), durationMinutes: 60, pieceName: 'p1' }),
    ]
    expect(computeProgression(spaced, 40).totalXp)
      .toBeGreaterThan(computeProgression(crammed, 40).totalXp)
  })

  it('pays the return bonus once per piece per day', () => {
    const once = [
      s({ date: day(1), durationMinutes: 20, pieceName: 'p1' }),
      s({ date: day(2), durationMinutes: 20, pieceName: 'p1' }),
    ]
    const thrice = [
      s({ date: day(1), durationMinutes: 20, pieceName: 'p1' }),
      s({ date: day(2), durationMinutes: 20, pieceName: 'p1' }),
      s({ date: day(2), durationMinutes: 0, pieceName: 'p1' }),
      s({ date: day(2), durationMinutes: 0, pieceName: 'p1' }),
    ]
    const delta = computeProgression(thrice, 40).totalXp - computeProgression(once, 40).totalXp
    expect(delta).toBe(2 * 25) // two extra sessions only, no extra return bonus
  })

  it('rewards writing something down', () => {
    const bare = [s({ date: day(1), durationMinutes: 30 })]
    const noted = [s({ date: day(1), durationMinutes: 30, notes: 'LH arpeggios still uneven' })]
    expect(computeProgression(noted, 40).totalXp)
      .toBeGreaterThan(computeProgression(bare, 40).totalXp)
  })

  it('ignores a whitespace-only note', () => {
    const bare = [s({ date: day(1), durationMinutes: 30 })]
    const blank = [s({ date: day(1), durationMinutes: 30, notes: '   \n  ' })]
    expect(computeProgression(blank, 40).totalXp).toBe(computeProgression(bare, 40).totalXp)
  })

  it('rewards a varied week over playing only your favourite thing', () => {
    const same = [2, 3, 4].map((d) => s({ date: day(d), durationMinutes: 30, category: 'Repertoire' }))
    const varied = [
      s({ date: day(2), durationMinutes: 30, category: 'Repertoire' }),
      s({ date: day(3), durationMinutes: 30, category: 'Scales' }),
      s({ date: day(4), durationMinutes: 30, category: 'Sight Reading' }),
    ]
    expect(computeProgression(varied, 40).totalXp)
      .toBeGreaterThan(computeProgression(same, 40).totalXp)
  })
})

describe('the legacy credit', () => {
  const past = (n: number) => `2026-0${n <= 9 ? n : 9}-01`   // all before the cutover
  const future = (n: number) => `2026-10-${String(n).padStart(2, '0')}` // all after

  const marathons = (dates: string[]): PracticeSession[] =>
    dates.map((date, i) => ({
      id: 's' + i, userId: 'u', date, durationMinutes: 240, category: 'Repertoire',
      difficultyRating: 3, confidenceRating: 7, createdAt: '',
    }))

  it('nobody loses a level to the new formula', () => {
    // The worst case: all marathon days, no pieces, no notes, one
    // category — everything the new weighting declines to pay for.
    const history = marathons([1, 2, 3, 4, 5, 6, 7, 8, 9].map(past))
    const legacy = 9 * 240 + 9 * 25 + 9 * 50
    expect(computeProgression(history, 43).totalXp).toBeGreaterThanOrEqual(legacy)
  })

  it('the bar is never stranded behind its own level', () => {
    const p = computeProgression(marathons([1, 2, 3, 4, 5, 6, 7, 8, 9].map(past)), 43)
    expect(p.totalXp).toBeGreaterThanOrEqual(xpForLevel(p.level))
    expect(p.totalXp).toBeLessThan(xpForLevel(p.level + 1))
    expect(p.percent).toBeGreaterThanOrEqual(0)
    expect(p.percent).toBeLessThanOrEqual(100)
  })

  it('credits nothing to someone who started after the change', () => {
    // Two identical histories, one wholly after the cutover: the later one
    // gets no credit, so it must score lower than the grandfathered one.
    const old = computeProgression(marathons([1, 2, 3].map(past)), 43).totalXp
    const now = computeProgression(marathons([1, 2, 3].map(future)), 43).totalXp
    expect(now).toBeLessThan(old)
  })

  it('stops growing — new practice is valued by the new rules alone', () => {
    const before = marathons([1, 2, 3].map(past))
    const plusOne = [...before, ...marathons([future(1)])]
    const plusTwo = [...before, ...marathons([future(1), future(2)])]

    const step1 = computeProgression(plusOne, 43).totalXp - computeProgression(before, 43).totalXp
    const step2 = computeProgression(plusTwo, 43).totalXp - computeProgression(plusOne, 43).totalXp

    // Each post-cutover marathon day is worth the same capped amount, and
    // less than the 240 flat minutes the old formula paid.
    expect(step1).toBe(step2)
    expect(step1).toBeLessThan(240 + 25 + 50)
  })
})
