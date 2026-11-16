// @ts-nocheck — exercises the plain-JavaScript server code in api/, which
// carries no type declarations; the assertions are what matter here.
import { describe, expect, it } from 'vitest'

/**
 * What the league credits a timer session with, and in particular that
 * real time is spent once across tickets: several timers running at once
 * must not multiply the minutes.
 */

process.env.LEAGUE_TICKET_SECRET = 'unit-test-secret'
const { issueTicket, creditedSessions } = await import('../../../../api/_lib/ticket.js')

const UID = 'student-1'
const T0 = Date.parse('2026-11-10T12:00:00Z')
const MIN = 60_000
const session = (ticket: string, createdMs: number, minutes: number, id = Math.random().toString(36)) => ({
  id, date: '2026-11-10', durationMinutes: minutes, timedMinutes: minutes, ticket, source: 'timer', createdMs,
})
const total = (list: { minutes: number }[]) => list.reduce((a, s) => a + s.minutes, 0)

describe('creditedSessions', () => {
  it('credits an honest session in full', () => {
    const t = issueTicket(UID, T0)
    expect(total(creditedSessions(UID, [session(t, T0 + 30 * MIN, 30)]))).toBe(30)
  })

  it('three timers started together earn the real time once, not three times', () => {
    const tickets = [0, 1, 2].map((i) => issueTicket(UID, T0 + i * 1000))
    const credited = creditedSessions(UID, tickets.map((t) => session(t, T0 + 40 * MIN, 40)))
    expect(total(credited)).toBeLessThanOrEqual(41)
    expect(total(credited)).toBeGreaterThanOrEqual(40)
  })

  it('back-to-back sessions on separate tickets both count in full', () => {
    const a = issueTicket(UID, T0)
    const b = issueTicket(UID, T0 + 31 * MIN)
    const credited = creditedSessions(UID, [session(a, T0 + 30 * MIN, 30), session(b, T0 + 61 * MIN, 30)])
    expect(total(credited)).toBe(60)
  })

  it('a timer started inside another adds nothing beyond the real span', () => {
    const outer = issueTicket(UID, T0)
    const inner = issueTicket(UID, T0 + 10 * MIN)
    const credited = creditedSessions(UID, [session(outer, T0 + 60 * MIN, 60), session(inner, T0 + 20 * MIN, 10)])
    expect(total(credited)).toBeLessThanOrEqual(61)
  })

  it('partly overlapping timers earn only the time between them that is new', () => {
    const a = issueTicket(UID, T0)
    const b = issueTicket(UID, T0 + 20 * MIN)
    const credited = creditedSessions(UID, [session(a, T0 + 30 * MIN, 30), session(b, T0 + 50 * MIN, 30)])
    // Real time is T0 → T0+50: fifty minutes, however it is split.
    expect(total(credited)).toBeLessThanOrEqual(51)
    expect(total(credited)).toBeGreaterThanOrEqual(50)
  })

  it('one ticket cannot be spent twice', () => {
    const t = issueTicket(UID, T0)
    const credited = creditedSessions(UID, [session(t, T0 + 30 * MIN, 30), session(t, T0 + 31 * MIN, 30)])
    expect(total(credited)).toBeLessThanOrEqual(32)
  })

  it('a ticket issued to someone else earns nothing', () => {
    const t = issueTicket('someone-else', T0)
    expect(creditedSessions(UID, [session(t, T0 + 30 * MIN, 30)])).toEqual([])
  })

  it('a session saved before its ticket was issued earns nothing', () => {
    const t = issueTicket(UID, T0)
    expect(creditedSessions(UID, [session(t, T0 - MIN, 30)])).toEqual([])
  })
})
