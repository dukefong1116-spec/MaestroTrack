import type { Piece, PracticeSession } from '@/types'

/**
 * A month of practice, summed up for a card: the minutes, the best run of
 * days in a row, the piece practised most, and a practice style — the
 * kind of thing people like to say about themselves (Duolingo's "learner
 * styles" are its most-shared Year in Review card).
 */

export type PracticeStyle = 'night-owl' | 'early-bird' | 'weekend-warrior' | 'marathoner' | 'little-and-often'

export const STYLES: Record<PracticeStyle, { name: string; emoji: string }> = {
  'night-owl': { name: 'Night Owl', emoji: '🦉' },
  'early-bird': { name: 'Early Bird', emoji: '🐦' },
  'weekend-warrior': { name: 'Weekend Warrior', emoji: '⚡' },
  marathoner: { name: 'Marathoner', emoji: '🏃' },
  'little-and-often': { name: 'Little-and-Often', emoji: '🌱' },
}

export interface MonthRecap {
  /** 'November' */
  month: string
  minutes: number
  days: number
  sessions: number
  bestStreak: number
  topPiece?: string
  style: PracticeStyle
  styleLine: string
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** When a session started, from when it was saved less its length. */
function startOf(s: PracticeSession): Date | null {
  if (!s.createdAt) return null
  const end = new Date(s.createdAt).getTime()
  if (Number.isNaN(end)) return null
  return new Date(end - (s.durationMinutes ?? 0) * 60_000)
}

export function monthRecap(sessions: PracticeSession[], pieces: Piece[], year: number, monthIndex: number): MonthRecap | null {
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
  const mine = sessions.filter((s) => s.date?.slice(0, 7) === prefix && (s.durationMinutes ?? 0) > 0)
  if (!mine.length) return null

  const minutes = mine.reduce((a, s) => a + s.durationMinutes, 0)
  const dayset = new Set(mine.map((s) => s.date.slice(0, 10)))

  // The longest run of days in a row, inside the month.
  let best = 0
  let run = 0
  const last = new Date(year, monthIndex + 1, 0).getDate()
  for (let d = 1; d <= last; d++) {
    run = dayset.has(dayKey(new Date(year, monthIndex, d))) ? run + 1 : 0
    best = Math.max(best, run)
  }

  // The piece with the most minutes.
  const per = new Map<string, number>()
  for (const s of mine) {
    const split = s.pieceMinutes ?? (s.pieceName ? { [s.pieceName]: s.durationMinutes } : {})
    for (const [id, m] of Object.entries(split)) per.set(id, (per.get(id) ?? 0) + m)
  }
  const topId = [...per].sort((a, b) => b[1] - a[1])[0]?.[0]
  const topPiece = topId ? (pieces.find((p) => p.id === topId)?.title ?? undefined) : undefined

  // The style: whichever habit stands out most.
  let late = 0
  let early = 0
  let weekend = 0
  for (const s of mine) {
    const start = startOf(s)
    if (start) {
      const h = start.getHours()
      if (h >= 20 || h < 4) late += s.durationMinutes
      else if (h >= 4 && h < 9) early += s.durationMinutes
    }
    const wd = new Date(`${s.date.slice(0, 10)}T12:00:00`).getDay()
    if (wd === 0 || wd === 6) weekend += s.durationMinutes
  }
  const avg = minutes / mine.length
  let style: PracticeStyle
  let styleLine: string
  if (late / minutes >= 0.5) { style = 'night-owl'; styleLine = 'Most practice after 8 pm' }
  else if (early / minutes >= 0.5) { style = 'early-bird'; styleLine = 'Most practice before 9 am' }
  else if (weekend / minutes >= 0.6 && dayset.size >= 2) { style = 'weekend-warrior'; styleLine = 'Weekends are for music' }
  else if (avg >= 45) { style = 'marathoner'; styleLine = `Long, deep sessions: ${Math.round(avg)} min on average` }
  else { style = 'little-and-often'; styleLine = `A little, most days: ${dayset.size} ${dayset.size === 1 ? 'day' : 'days'} this month` }

  return {
    month: new Date(year, monthIndex, 1).toLocaleDateString('en-US', { month: 'long' }),
    minutes: Math.round(minutes),
    days: dayset.size,
    sessions: mine.length,
    bestStreak: best,
    topPiece,
    style,
    styleLine,
  }
}

/** Which month to show: this one, or last month in the first days of a new one. */
export function recapMonth(sessions: PracticeSession[], now = new Date()): [number, number] {
  const y = now.getFullYear()
  const m = now.getMonth()
  if (now.getDate() <= 3) {
    const prev = new Date(y, m - 1, 1)
    const prefix = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
    if (sessions.some((s) => s.date?.startsWith(prefix))) return [prev.getFullYear(), prev.getMonth()]
  }
  return [y, m]
}
