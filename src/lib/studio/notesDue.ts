import type { LessonNote } from '@/types'
import { endTime, type CalendarItem } from './calendar'

/** How long after a lesson the teacher is reminded to write it up. */
const WINDOW_HOURS = 48

/**
 * Lessons that have finished (in the last two days) with no note yet:
 * the moment to write down what was covered and what comes next, while
 * it is fresh. Soonest-finished first.
 */
export function lessonsNeedingNotes(items: CalendarItem[], notes: LessonNote[], now: Date): { item: CalendarItem; endedAt: Date }[] {
  const written = new Set(notes.map((n) => n.occurrenceId).filter(Boolean))
  return items
    .filter((i) => !i.cancelled && i.rosterIds.length > 0 && !written.has(i.key))
    .map((item) => ({ item, endedAt: new Date(`${item.date}T${endTime(item)}:00`) }))
    .filter(({ endedAt }) => endedAt.getTime() <= now.getTime() && now.getTime() - endedAt.getTime() <= WINDOW_HOURS * 3_600_000)
    .sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime())
}
