import { describe, expect, it } from 'vitest'
import {
  addDays, mondayOf, weekIdOf, weekOf, bandFor, weekEndsAt, weekXp, streakOn,
  rankMembers, moveCounts, zoneOf, finalResults, publicName, colourFor,
  DAILY_CAP, TOP_TIER,
} from '../rules'

const MON = '2026-11-09' // a Monday, ISO week 46

describe('dates', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('finds the Monday of any day', () => {
    expect(mondayOf('2026-11-09')).toBe(MON)
    expect(mondayOf('2026-11-15')).toBe(MON) // Sunday
    expect(mondayOf('2026-11-16')).toBe('2026-11-16')
  })
  it('names ISO weeks, including the ones that cross a new year', () => {
    expect(weekIdOf(MON)).toBe('2026-W46')
    expect(weekIdOf('2026-01-01')).toBe('2026-W01') // a Thursday
    expect(weekIdOf('2027-01-01')).toBe('2026-W53') // a Friday: still 2026's last week
    expect(weekIdOf('2024-12-30')).toBe('2025-W01') // a Monday in 2025's first week
  })
  it('puts "now" in the right local week either side of midnight', () => {
    const sunday2330utc = Date.parse('2026-11-15T23:30:00Z')
    expect(weekOf(sunday2330utc, 0).id).toBe('2026-W46')
    expect(weekOf(sunday2330utc, 60).id).toBe('2026-W47') // 00:30 Monday in UTC+1
    expect(weekOf(sunday2330utc, -480).today).toBe('2026-11-15') // Los Angeles
  })
})

describe('bands and the end of a week', () => {
  it('groups time zones into 3-hour bands', () => {
    expect(bandFor(0)).toBe(0)
    expect(bandFor(-480)).toBe(-3) // UTC−8
    expect(bandFor(540)).toBe(3)   // UTC+9
    expect(bandFor(-720)).toBe(-4)
    expect(bandFor(840)).toBe(5)
  })
  it('ends a week at Monday 00:00 in the band', () => {
    expect(new Date(weekEndsAt(MON, 0)).toISOString()).toBe('2026-11-16T00:00:00.000Z')
    expect(new Date(weekEndsAt(MON, -3)).toISOString()).toBe('2026-11-16T09:00:00.000Z')
    expect(new Date(weekEndsAt(MON, 3)).toISOString()).toBe('2026-11-15T15:00:00.000Z')
  })
})

describe('weekly XP', () => {
  it('pays a minute a minute, plus 10 for each practice day', () => {
    const { xp, days } = weekXp([{ date: MON, minutes: 30 }, { date: addDays(MON, 2), minutes: 45 }], MON)
    expect(xp).toBe(30 + 10 + 45 + 10)
    expect(days).toHaveLength(7)
    expect(days[0]).toMatchObject({ date: MON, minutes: 30, counted: 30, bonus: 10, xp: 40 })
  })
  it('adds up several sessions on one day before capping', () => {
    const { xp } = weekXp([{ date: MON, minutes: 80 }, { date: MON, minutes: 80 }], MON)
    expect(xp).toBe(DAILY_CAP + 10)
  })
  it('caps at exactly 120', () => {
    expect(weekXp([{ date: MON, minutes: 120 }], MON).xp).toBe(130)
    expect(weekXp([{ date: MON, minutes: 121 }], MON).xp).toBe(130)
  })
  it('does not make a practice day of under 10 minutes', () => {
    expect(weekXp([{ date: MON, minutes: 9 }], MON).xp).toBe(9)
    expect(weekXp([{ date: MON, minutes: 10 }], MON).xp).toBe(20)
  })
  it('ignores days outside the week and nonsense minutes', () => {
    const { xp } = weekXp([
      { date: addDays(MON, -1), minutes: 60 },
      { date: addDays(MON, 7), minutes: 60 },
      { date: MON, minutes: -5 },
      { date: MON, minutes: Number.NaN },
    ], MON)
    expect(xp).toBe(0)
  })
  it('pays the streak bonus from the seventh day in a row', () => {
    const sessions = Array.from({ length: 7 }, (_, i) => ({ date: addDays(MON, i), minutes: 10 }))
    const { xp, days } = weekXp(sessions, MON)
    expect(days.map((d) => d.bonus)).toEqual([10, 10, 10, 10, 10, 10, 30])
    expect(xp).toBe(7 * 20 + 20)
  })
  it('carries a streak in from last week', () => {
    // Last Wednesday to Sunday practised: Monday is day 6, Tuesday day 7.
    const last = [-5, -4, -3, -2, -1].map((n) => ({ date: addDays(MON, n), minutes: 15 }))
    const { days } = weekXp([...last, { date: MON, minutes: 15 }, { date: addDays(MON, 1), minutes: 15 }], MON)
    expect(days[0]).toMatchObject({ streak: 6, bonus: 10 })
    expect(days[1]).toMatchObject({ streak: 7, bonus: 30 })
  })
  it('resets the streak on a missed day', () => {
    const sessions = [0, 1, 2, 3, 4, 5, 6].filter((n) => n !== 3).map((n) => ({ date: addDays(MON, n), minutes: 10 }))
    expect(weekXp(sessions, MON).days.every((d) => d.bonus <= 10)).toBe(true)
  })
  it('a held day keeps the streak without adding to it', () => {
    // Monday to Sunday practised except Thursday, which was a lesson day.
    const sessions = [0, 1, 2, 4, 5, 6].map((n) => ({ date: addDays(MON, n), minutes: 10 }))
    expect(weekXp(sessions, MON).days[6]).toMatchObject({ streak: 3, bonus: 10 })
    const held = weekXp(sessions, MON, [addDays(MON, 3)]).days
    expect(held[3]).toMatchObject({ streak: 3, bonus: 0, xp: 0 })
    expect(held[6]).toMatchObject({ streak: 6, bonus: 10 })
  })
  it('carries a streak across a held day from last week', () => {
    const last = [-8, -7, -6, -5, -4, -3].map((n) => ({ date: addDays(MON, n), minutes: 10 }))
    const { days } = weekXp([...last, { date: MON, minutes: 10 }], MON, [addDays(MON, -2), addDays(MON, -1)])
    expect(days[0]).toMatchObject({ streak: 7, bonus: 30 })
  })
  it('tops out at 1,050 for a perfect week on a long streak', () => {
    const sessions = Array.from({ length: 13 }, (_, i) => ({ date: addDays(MON, i - 6), minutes: 200 }))
    expect(weekXp(sessions, MON).xp).toBe(7 * 150)
  })
})

describe('the current streak', () => {
  const sessions = [0, 1, 2].map((n) => ({ date: addDays(MON, n), minutes: 12 }))
  const { days } = weekXp(sessions, MON)
  it('counts today once practised', () => expect(streakOn(days, addDays(MON, 2))).toBe(3))
  it('is still alive on a day not practised yet', () => expect(streakOn(days, addDays(MON, 3))).toBe(3))
  it('is broken once a whole day is missed', () => expect(streakOn(days, addDays(MON, 4))).toBe(0))
})

describe('ranking and moving', () => {
  it('ranks by XP, then by who got there first', () => {
    const r = rankMembers([
      { uid: 'a', xp: 50, xpAt: '2026-11-10T10:00:00Z' },
      { uid: 'b', xp: 80, xpAt: '2026-11-11T10:00:00Z' },
      { uid: 'c', xp: 50, xpAt: '2026-11-09T10:00:00Z' },
    ])
    expect(r.map((m) => m.uid)).toEqual(['b', 'c', 'a'])
  })
  it('scales who moves with room size', () => {
    expect(moveCounts(1)).toEqual({ up: 1, down: 0 })
    expect(moveCounts(4)).toEqual({ up: 1, down: 0 })
    expect(moveCounts(5)).toEqual({ up: 2, down: 1 })
    expect(moveCounts(9)).toEqual({ up: 2, down: 1 })
    expect(moveCounts(10)).toEqual({ up: 2, down: 2 })
    expect(moveCounts(30)).toEqual({ up: 6, down: 5 })
  })
  it('never moves up from the top tier or down from the bottom one', () => {
    expect(zoneOf(0, 30, TOP_TIER)).toBe(null)
    expect(zoneOf(29, 30, 0)).toBe(null)
    expect(zoneOf(0, 30, 2)).toBe('up')
    expect(zoneOf(29, 30, 2)).toBe('down')
  })
  it('never moves anyone up on zero XP', () => {
    expect(zoneOf(0, 3, 1, 0)).toBe(null)
  })
  it('works out the end of a week for everyone', () => {
    const members = Array.from({ length: 10 }, (_, i) => ({ uid: `u${i}`, xp: 100 - i, xpAt: '' }))
    const res = finalResults(members, 3)
    expect(res.filter((r) => r.toTier === 4).map((r) => r.uid)).toEqual(['u0', 'u1'])
    expect(res.filter((r) => r.toTier === 2).map((r) => r.uid)).toEqual(['u8', 'u9'])
    expect(res[0]).toMatchObject({ rank: 1, of: 10, fromTier: 3, maestro: false })
  })
  it('names the top three in the top tier Maestro', () => {
    const res = finalResults([{ uid: 'a', xp: 9 }, { uid: 'b', xp: 8 }, { uid: 'c', xp: 7 }, { uid: 'd', xp: 6 }], TOP_TIER)
    expect(res.map((r) => r.maestro)).toEqual([true, true, true, false])
    expect(res.every((r) => r.toTier === TOP_TIER)).toBe(true)
  })
  it('promotes someone alone in a room, if they practised', () => {
    expect(finalResults([{ uid: 'a', xp: 40 }], 0)[0].toTier).toBe(1)
  })
})

describe('what others see', () => {
  it('shows a first name and last initial only', () => {
    expect(publicName('Sam Oyelaran')).toBe('Sam O.')
    expect(publicName('Mary Ann de la Cruz')).toBe('Mary C.')
    expect(publicName('Cher')).toBe('Cher')
    expect(publicName('  ')).toBe('Musician')
    expect(publicName(undefined)).toBe('Musician')
  })
  it('gives each player a stable colour', () => {
    expect(colourFor('abc')).toBe(colourFor('abc'))
    expect(colourFor('abc')).toBeGreaterThanOrEqual(0)
    expect(colourFor('abc')).toBeLessThan(6)
  })
})
