import { format, parseISO } from 'date-fns'

/**
 * What a take is called before anyone names it.
 *
 * It used to be "Take 1", "Take 2" — its position in one session's list,
 * which said nothing once you were looking at more than one session, and
 * gave every session its own "Take 1". Now it is the day it was recorded:
 * "Nov 5, 2026", then "Nov 5, 2026 2", "Nov 5, 2026 3", numbered across
 * the whole day, so two sessions that day never share a name.
 *
 * Only a fallback. A take somebody has named keeps its name, and these
 * are never written to the take itself — renaming stays an explicit act.
 */

/** "Nov 5, 2026", and from the second take that day on, " 2", " 3"… */
export function takeLabel(date: string, nth: number): string {
  const day = format(parseISO(date.substring(0, 10)), 'MMM d, yyyy')
  return nth > 1 ? `${day} ${nth}` : day
}

interface TakeLike {
  id: string
  date: string
  createdAt?: string
}

/**
 * The fallback name for every take, numbered within its day in the order
 * they were recorded. Pass every take you have — not one session's — or
 * two sessions on the same day would each produce a "Nov 5, 2026".
 */
export function takeNamesByDay(takes: TakeLike[]): Map<string, string> {
  const byDay = new Map<string, TakeLike[]>()
  for (const t of takes) {
    const day = t.date.substring(0, 10)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(t)
  }
  const names = new Map<string, string>()
  for (const [day, list] of byDay) {
    // Recorded order; ties fall back to id so the order is stable.
    list.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id))
    list.forEach((t, i) => names.set(t.id, takeLabel(day, i + 1)))
  }
  return names
}
