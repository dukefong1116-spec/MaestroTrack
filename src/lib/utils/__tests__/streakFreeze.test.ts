import { describe, it, expect } from 'vitest'
import { weekStrip } from '../streakFreeze'
import { walkStreak, addDays } from '@/lib/streak/engine'

/**
 * The strip on Today, from the engine's walk. Earning and spending
 * freezes are tested beside the engine, in lib/streak/__tests__.
 *
 * Pinned to a Wednesday, so a few days either side fall in the same
 * Monday-first week.
 */
const TODAY = '2026-10-21'
const d = (n: number) => addDays(TODAY, -n)
const S = (date: string) => ({ date, durationMinutes: 30 })
const strip = (sessions: { date: string; durationMinutes: number }[], frozen: string[] = [], rules: unknown = []) =>
  weekStrip(walkStreak({ sessions, frozen, rules: rules as never, today: TODAY }), TODAY, rules)

describe('week strip', () => {
  const s = strip([S(d(0))])

  it('is seven days, Monday first', () => {
    expect(s).toHaveLength(7)
    expect(s[0].label).toBe('M')
    expect(s[0].date).toBe('2026-10-19')
  })

  it('marks exactly one day as today', () => {
    expect(s.filter((x) => x.isToday)).toHaveLength(1)
  })

  it('flags the practised day', () => {
    expect(s.find((x) => x.date === d(0))?.practised).toBe(true)
  })

  it('distinguishes frozen from practised', () => {
    const t = strip([S(d(0)), S(d(2))], [d(1)])
    expect(t.find((x) => x.date === d(1))?.frozen).toBe(true)
    expect(t.find((x) => x.date === d(1))?.practised).toBe(false)
  })

  it('does not mark a practised day as frozen even if both are recorded', () => {
    expect(strip([S(d(0))], [d(0)]).find((x) => x.date === d(0))?.frozen).toBe(false)
  })

  it('shows lesson days, past and still to come', () => {
    // Tuesday is the lesson day: yesterday, and next week's is outside the strip.
    const rules = [{ from: '2026-10-01', min: 0, lessonDay: 1 }]
    const t = strip([S(d(0)), S(d(2))], [], rules)
    expect(t.find((x) => x.date === d(1))?.lesson).toBe(true)
    const thu = [{ from: '2026-10-01', min: 0, lessonDay: 3 }]
    expect(strip([S(d(0))], [], thu).find((x) => x.date === '2026-10-22')?.lesson).toBe(true)
  })
})
