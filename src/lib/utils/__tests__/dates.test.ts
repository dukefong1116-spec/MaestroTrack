import { describe, it, expect } from 'vitest'
import { startOfWeek, startOfMonth, parseISO, format, subDays } from 'date-fns'

/**
 * These cover two bug classes that have each bitten this codebase once:
 * date-only strings parsed as UTC, and day arithmetic done in fixed
 * milliseconds. Both are invisible in UTC, so the suite pins the timezone.
 */

// `npm test` pins TZ=America/Los_Angeles. Asserted rather than assumed: in
// UTC every "the bug" case below passes by accident, so an unpinned run
// would report green while proving nothing.
describe('harness', () => {
  it('runs in a non-UTC timezone', () => {
    expect(new Date('2026-09-06T00:00:00Z').getHours()).not.toBe(0)
  })
})

describe('date-only strings are local, not UTC', () => {
  const firstOfWeek = '2026-09-06' // a Sunday

  it('parseISO keeps the first day of the week inside the week', () => {
    const ws = startOfWeek(new Date('2026-09-10T12:00:00'))
    expect(parseISO(firstOfWeek) >= ws).toBe(true)
  })

  it('new Date() on the same string falls outside it — the bug', () => {
    const ws = startOfWeek(new Date('2026-09-10T12:00:00'))
    expect(new Date(firstOfWeek) >= ws).toBe(false)
  })

  it('holds for the first of the month too', () => {
    const ms = startOfMonth(new Date('2026-09-10T12:00:00'))
    expect(parseISO('2026-09-01') >= ms).toBe(true)
    expect(new Date('2026-09-01') >= ms).toBe(false)
  })
})

describe('day arithmetic survives DST', () => {
  // US clocks spring forward 2026-03-08.
  const justAfterMidnight = new Date('2026-03-09T00:30:00')

  it('subDays gives the real previous day', () => {
    expect(format(subDays(justAfterMidnight, 1), 'yyyy-MM-dd')).toBe('2026-03-08')
  })

  it('subtracting 86_400_000ms skips a day — the bug', () => {
    const naive = new Date(justAfterMidnight.getTime() - 86_400_000)
    expect(format(naive, 'yyyy-MM-dd')).toBe('2026-03-07')
  })

  it('a walk back from just after midnight visits every day', () => {
    // This mirrors decideFreezes, which walks back from `now` looking for the
    // last practised day.
    const walk = Array.from({ length: 3 }, (_, i) =>
      format(subDays(justAfterMidnight, i + 1), 'yyyy-MM-dd'))
    expect(walk).toEqual(['2026-03-08', '2026-03-07', '2026-03-06'])
  })

  it('the same walk in fixed ms never looks at 2026-03-08 — the bug', () => {
    const walk = Array.from({ length: 3 }, (_, i) =>
      format(new Date(justAfterMidnight.getTime() - (i + 1) * 86_400_000), 'yyyy-MM-dd'))
    expect(walk).toEqual(['2026-03-07', '2026-03-06', '2026-03-05'])
    expect(walk).not.toContain('2026-03-08')
  })
})
