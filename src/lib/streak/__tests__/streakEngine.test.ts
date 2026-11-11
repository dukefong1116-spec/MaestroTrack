import { describe, expect, it } from 'vitest'
import {
  walkStreak, freezesToSpend, holdDays, ruleOn, cleanRules, addDays, dowOf,
} from '../engine'

// 2026-11-10 is a Tuesday.
const TODAY = '2026-11-10'
const back = (n: number) => addDays(TODAY, -n)
const s = (n: number, minutes = 20) => ({ date: back(n), durationMinutes: minutes })
const run = (n: number, from = 0, minutes = 20) => Array.from({ length: n }, (_, i) => s(from + i, minutes))

describe('days and rules', () => {
  it('knows the weekday', () => {
    expect(dowOf(TODAY)).toBe(1)
    expect(dowOf('2026-11-09')).toBe(0)
    expect(dowOf('2026-11-15')).toBe(6)
  })
  it('uses the rule in force on each day', () => {
    const rules = cleanRules([{ from: '2026-11-05', min: 15, lessonDay: 3 }, { from: '2026-11-01', min: 5, lessonDay: null }])
    expect(ruleOn(rules, '2026-10-30').min).toBe(0)
    expect(ruleOn(rules, '2026-11-03').min).toBe(5)
    expect(ruleOn(rules, '2026-11-08')).toMatchObject({ min: 15, lessonDay: 3 })
  })
  it('throws nothing away it cannot read, and keeps nothing it should not', () => {
    expect(cleanRules('nope')).toEqual([])
    expect(cleanRules([{ from: 'bad' }, { from: '2026-01-01', min: -4, lessonDay: 9 }])).toEqual([{ from: '2026-01-01', min: 0, lessonDay: null }])
  })
})

describe('the streak', () => {
  it('is nothing with no practice', () => {
    expect(walkStreak({ today: TODAY })).toMatchObject({ current: 0, longest: 0, todayLit: false })
  })
  it('counts practised days in a row, today included', () => {
    expect(walkStreak({ sessions: run(5), today: TODAY })).toMatchObject({ current: 5, todayLit: true })
  })
  it('is still alive before today is practised', () => {
    const w = walkStreak({ sessions: run(4, 1), today: TODAY })
    expect(w).toMatchObject({ current: 4, todayLit: false })
  })
  it('breaks on a missed day', () => {
    expect(walkStreak({ sessions: [s(0), s(2), s(3)], today: TODAY }).current).toBe(1)
  })
  it('counts a day only once the minimum is reached', () => {
    const rules = [{ from: back(30), min: 15, lessonDay: null }]
    const w = walkStreak({ sessions: [s(0, 5), s(1, 10), s(1, 10), s(2)], rules, today: TODAY })
    expect(w).toMatchObject({ current: 2, todayLit: false, todayMinutes: 5 })
  })
  it('judges each day by the rule of its own day, so raising the minimum rewrites nothing', () => {
    const rules = [{ from: TODAY, min: 30, lessonDay: null }]
    const w = walkStreak({ sessions: run(4, 1, 10), rules, today: TODAY })
    expect(w.current).toBe(4)
  })
  it('a missed lesson day holds the streak but adds nothing', () => {
    // back(5) is Thursday 5 Nov.
    expect(dowOf(back(5))).toBe(3)
    const rules = [{ from: back(30), min: 0, lessonDay: 3 }]
    const sessions = [...run(5, 0), ...run(3, 6)]
    expect(walkStreak({ sessions, today: TODAY }).current).toBe(5)
    expect(walkStreak({ sessions, rules, today: TODAY }).current).toBe(8)
  })
  it('a practised lesson day counts like any other', () => {
    const rules = [{ from: back(30), min: 0, lessonDay: 3 }]
    expect(walkStreak({ sessions: run(8), rules, today: TODAY }).current).toBe(8)
  })
  it('ignores sessions dated after today', () => {
    expect(walkStreak({ sessions: [{ date: addDays(TODAY, 2), durationMinutes: 20 }], today: TODAY }).current).toBe(0)
  })
  it('keeps the longest run', () => {
    expect(walkStreak({ sessions: [...run(2), ...run(9, 5)], today: TODAY })).toMatchObject({ current: 2, longest: 9 })
  })
})

describe('freezes', () => {
  it('earns one every 7 days in a row, up to 2', () => {
    expect(walkStreak({ sessions: run(6), today: TODAY })).toMatchObject({ held: 0, nextFreezeIn: 1 })
    expect(walkStreak({ sessions: run(7), today: TODAY })).toMatchObject({ held: 1, nextFreezeIn: 7 })
    expect(walkStreak({ sessions: run(21), today: TODAY })).toMatchObject({ held: 2, nextFreezeIn: null })
  })
  it('a frozen day holds the streak, adds nothing, and uses one', () => {
    const sessions = [...run(1, 1), ...run(8, 3)]
    const w = walkStreak({ sessions, frozen: [back(2)], today: TODAY })
    expect(w).toMatchObject({ current: 9, held: 0 })
    expect(w.days.find((d) => d.date === back(2))?.status).toBe('frozen')
  })
  it('freezes the flame until you practise, through a lesson day', () => {
    const rules = [{ from: back(30), min: 0, lessonDay: dowOf(back(1)) }]
    const sessions = run(8, 3)
    expect(walkStreak({ sessions, rules, frozen: [back(2)], today: TODAY }).flameFrozen).toBe(true)
    expect(walkStreak({ sessions: [s(0), ...sessions], rules, frozen: [back(2)], today: TODAY }).flameFrozen).toBe(false)
  })
  it('spends freezes on the missed run ending yesterday when enough are held', () => {
    expect(freezesToSpend(walkStreak({ sessions: run(7, 2), today: TODAY }))).toEqual([back(1)])
    expect(freezesToSpend(walkStreak({ sessions: run(14, 3), today: TODAY }))).toEqual([back(2), back(1)])
    // One held, two missed: nothing — a freeze that cannot save the streak is not spent.
    expect(freezesToSpend(walkStreak({ sessions: run(7, 3), today: TODAY }))).toEqual([])
  })
  it('spends nothing without a streak, or when nothing was missed', () => {
    expect(freezesToSpend(walkStreak({ sessions: run(3, 1), today: TODAY }))).toEqual([])
    expect(freezesToSpend(walkStreak({ sessions: run(10), today: TODAY }))).toEqual([])
    expect(freezesToSpend(walkStreak({ sessions: [], today: TODAY }))).toEqual([])
  })
  it('skips a lesson day inside the gap rather than freezing it', () => {
    const rules = [{ from: back(30), min: 0, lessonDay: dowOf(back(1)) }]
    expect(freezesToSpend(walkStreak({ sessions: run(7, 2), rules, today: TODAY }))).toEqual([])
    expect(freezesToSpend(walkStreak({ sessions: run(7, 3), rules, today: TODAY }))).toEqual([back(2)])
  })
  it('spends even when today is already practised', () => {
    expect(freezesToSpend(walkStreak({ sessions: [s(0), ...run(7, 2)], today: TODAY }))).toEqual([back(1)])
  })
  it('is idempotent once recorded', () => {
    const w = walkStreak({ sessions: run(7, 2), frozen: [back(1)], today: TODAY })
    expect(freezesToSpend(w)).toEqual([])
    expect(w.current).toBe(7)
  })
})

describe('comeback', () => {
  it('is offered the day after a streak breaks, with nothing to cover it', () => {
    const w = walkStreak({ sessions: run(5, 2), today: TODAY })
    expect(w.current).toBe(0)
    expect(w.comeback).toEqual({ missed: back(1), restore: 5, done: 0, complete: false })
  })
  it('counts the days back, and completes on the second', () => {
    expect(walkStreak({ sessions: [s(0), ...run(5, 2)], today: TODAY }).comeback).toMatchObject({ done: 1, complete: false })
    expect(walkStreak({ sessions: [s(0), s(1), ...run(5, 3)], today: TODAY }).comeback).toMatchObject({ done: 2, complete: true })
  })
  it('once recorded, brings the whole streak back', () => {
    const w = walkStreak({ sessions: [s(0), s(1), ...run(5, 3)], repaired: [back(2)], today: TODAY })
    expect(w.current).toBe(7)
    expect(w.comeback).toBeNull()
  })
  it('is gone after a second missed day', () => {
    expect(walkStreak({ sessions: run(5, 3), today: TODAY }).comeback).toBeNull()
    expect(walkStreak({ sessions: [s(1), ...run(5, 3)], today: '2026-11-11' }).comeback).toBeNull()
  })
  it('is never for an old gap, however long the run since', () => {
    // Missed 20 days ago after a 10-day run; practised every day since.
    const sessions = [...run(20), ...run(10, 21)]
    const w = walkStreak({ sessions, today: TODAY })
    expect(w.current).toBe(20)
    expect(w.comeback).toBeNull()
  })
  it('lasts until the morning after its two days, and no longer', () => {
    // Missed back(3), practised back(2) and back(1): complete, still recordable today.
    expect(walkStreak({ sessions: [s(1), s(2), ...run(5, 4)], today: TODAY }).comeback).toMatchObject({ complete: true })
    // A day later — practised today too — it is history.
    expect(walkStreak({ sessions: [s(0), s(1), s(2), ...run(5, 4)], today: addDays(TODAY, 1) }).comeback).toBeNull()
  })
  it('skips a lesson day inside its two days', () => {
    // Missed back(3); back(2) is the lesson day; back(1) and today are its two days.
    const rules = [{ from: back(30), min: 0, lessonDay: dowOf(back(2)) }]
    const w = walkStreak({ sessions: [s(0), s(1), ...run(5, 4)], rules, today: TODAY })
    expect(w.comeback).toMatchObject({ missed: back(3), done: 2, complete: true })
  })
  it('is not for a tiny streak', () => {
    expect(walkStreak({ sessions: run(2, 2), today: TODAY }).comeback).toBeNull()
  })
  it('happens once a month', () => {
    expect(walkStreak({ sessions: run(5, 2), repaired: ['2026-11-01'], today: TODAY }).comeback).toBeNull()
    expect(walkStreak({ sessions: run(5, 2), repaired: ['2026-10-20'], today: TODAY }).comeback).not.toBeNull()
  })
})

describe('days that hold the league streak', () => {
  const from = '2026-11-02'
  const to = '2026-11-15'
  it('lesson days, one a week', () => {
    const held = holdDays({ rules: [{ from: '2026-10-01', min: 0, lessonDay: 3 }], from, to })
    expect([...held].sort()).toEqual(['2026-11-05', '2026-11-12'])
  })
  it('at most two frozen days in any seven', () => {
    const held = holdDays({ frozen: ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-11'], from, to })
    expect([...held].sort()).toEqual(['2026-11-03', '2026-11-04', '2026-11-11'])
  })
  it('one repaired day a month, and nothing junk', () => {
    const held = holdDays({ repaired: ['2026-11-03', '2026-11-09', 'x', 7], from, to })
    expect([...held]).toEqual(['2026-11-03'])
  })
})
