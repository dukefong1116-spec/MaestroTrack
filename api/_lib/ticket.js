/**
 * Practice tickets: what makes "only timer sessions count" enforceable.
 *
 * When the timer starts, the server hands out a ticket stamped with the
 * current time and signed with a secret only the server holds. The
 * session carries it when it is saved. A session's minutes can then never
 * count for more than the real time between the ticket and the moment
 * Firestore stored the session — a time the phone cannot choose.
 *
 * Faking an hour therefore means waiting an hour, and the daily cap
 * limits even that.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { HttpError, usingEmulator } from './admin.js'

/** A ticket older than this when its session is saved counts for nothing. */
export const TICKET_LIFETIME_MS = 16 * 3_600_000

function secret() {
  const s = process.env.LEAGUE_TICKET_SECRET
  if (s) return s
  // Never a fallback in production: a guessable secret would let anyone
  // sign their own tickets.
  if (usingEmulator) return 'emulator-only-league-secret'
  throw new HttpError(500, 'League is not configured on the server yet.')
}

const sign = (uid, startMs) => createHmac('sha256', secret()).update(`${uid}.${startMs}`).digest('base64url')

export function issueTicket(uid, nowMs = Date.now()) {
  return `${nowMs}.${sign(uid, nowMs)}`
}

/** The ticket's start time if it is genuine and this user's, otherwise null. */
export function ticketStart(uid, ticket) {
  if (typeof ticket !== 'string') return null
  const dot = ticket.indexOf('.')
  if (dot < 1) return null
  const startMs = Number(ticket.slice(0, dot))
  if (!Number.isSafeInteger(startMs)) return null
  const given = Buffer.from(ticket.slice(dot + 1))
  const expected = Buffer.from(sign(uid, startMs))
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  return startMs
}

/**
 * The minutes each timer session really earns.
 *
 * `sessions` are `{ id, date, durationMinutes, timedMinutes, ticket,
 * source, createdMs }`. A session counts only if it came from the timer,
 * carries a genuine ticket, and was stored within the ticket's lifetime
 * and within a day and a half of its own date. Its minutes are the
 * smallest of what it says and what the timer measured — and, across all
 * the sessions on one ticket, never more than the real time since that
 * ticket was issued, so one ticket cannot be spent twice.
 */
export function creditedSessions(uid, sessions) {
  const byTicket = new Map()
  for (const s of sessions) {
    if (s.source !== 'timer') continue
    const start = ticketStart(uid, s.ticket)
    if (start === null) continue
    if (!(s.createdMs >= start) || s.createdMs - start > TICKET_LIFETIME_MS) continue
    const dateMs = Date.parse(`${s.date}T12:00:00Z`)
    if (!Number.isFinite(dateMs) || Math.abs(dateMs - s.createdMs) > 36 * 3_600_000) continue
    const minutes = Math.min(Number(s.durationMinutes) || 0, Number(s.timedMinutes) || 0)
    if (!(minutes > 0)) continue
    const list = byTicket.get(s.ticket) ?? []
    list.push({ ...s, start, minutes })
    byTicket.set(s.ticket, list)
  }
  const out = []
  for (const list of byTicket.values()) {
    list.sort((a, b) => a.createdMs - b.createdMs)
    let allowance = Math.ceil((list[list.length - 1].createdMs - list[0].start) / 60_000) + 1
    for (const s of list) {
      const minutes = Math.min(s.minutes, allowance)
      allowance -= minutes
      if (minutes > 0) out.push({ date: s.date, minutes })
    }
  }
  return out
}
