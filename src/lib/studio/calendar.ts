import type { AttendanceMark, LessonOccurrence, LessonSlot, StudioLesson } from '@/types'
import { addDays, fromMinutes, parseDay, toMinutes, weekday } from './dates'

/**
 * The calendar, worked out rather than stored.
 *
 * A weekly lesson is one document. A particular date only gets its own
 * document (an occurrence) once something happens to it — it is moved,
 * resized, cancelled, attended or written about — or when it is a
 * one-off. So a week is the weekly lessons laid onto its dates, with any
 * occurrence taking that date's place.
 */

export interface CalendarItem {
  /** Unique within a range: the occurrence id, or `${lessonId}_${date}`. */
  key: string
  lessonId?: string
  /** Present once this date has a document of its own. */
  occurrenceId?: string
  /** A weekly lesson's own date, before any move. */
  originalDate?: string
  /** Made the old way, on the Schedule page; editing it converts it first. */
  legacySlotId?: string
  date: string
  startTime: string
  durationMinutes: number
  title: string
  tagId: string
  rosterIds: string[]
  studentUids: string[]
  where?: string
  cancelled: boolean
  attendance: Record<string, AttendanceMark>
  makeupFor?: string
  carried: { text: string; state: 'open' | 'covered' | 'carried' }[]
}

export const occurrenceId = (lessonId: string, originalDate: string) => `${lessonId}_${originalDate}`

/** A slot from the old Schedule page, as a weekly lesson. */
export function lessonFromSlot(slot: LessonSlot, rosterId: string | undefined): StudioLesson {
  return {
    id: `legacy:${slot.id}`,
    teacherId: slot.teacherId,
    rosterIds: rosterId ? [rosterId] : [],
    studentUids: [slot.studentId],
    title: slot.studentName,
    tagId: 'private',
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    durationMinutes: slot.durationMinutes,
    fixedMinutes: slot.durationMinutes,
    startsOn: '2000-01-01',
    createdAt: slot.createdAt,
    updatedAt: slot.updatedAt,
  }
}

function fromLesson(l: StudioLesson, date: string): CalendarItem {
  const legacy = l.id.startsWith('legacy:') ? l.id.slice(7) : undefined
  return {
    key: occurrenceId(l.id, date),
    lessonId: l.id,
    originalDate: date,
    legacySlotId: legacy,
    date,
    startTime: l.startTime,
    durationMinutes: l.durationMinutes,
    title: l.title,
    tagId: l.tagId,
    rosterIds: l.rosterIds,
    studentUids: l.studentUids,
    where: l.where,
    cancelled: false,
    attendance: {},
    carried: [],
  }
}

function fromOccurrence(o: LessonOccurrence): CalendarItem {
  return {
    key: o.id,
    lessonId: o.lessonId,
    occurrenceId: o.id,
    originalDate: o.originalDate,
    date: o.date,
    startTime: o.startTime,
    durationMinutes: o.durationMinutes,
    title: o.title,
    tagId: o.tagId,
    rosterIds: o.rosterIds ?? [],
    studentUids: o.studentUids ?? [],
    where: o.where,
    cancelled: !!o.cancelled,
    attendance: o.attendance ?? {},
    makeupFor: o.makeupFor,
    carried: o.carried ?? [],
  }
}

/** Everything from `from` to `to`, both included, earliest first. */
export function expandRange(
  from: string,
  to: string,
  lessons: StudioLesson[],
  occurrences: LessonOccurrence[],
): CalendarItem[] {
  const overridden = new Set(occurrences.filter((o) => o.lessonId && o.originalDate).map((o) => o.id))
  const out: CalendarItem[] = []

  for (const l of lessons) {
    const first = l.startsOn > from ? l.startsOn : from
    const last = l.endsOn && l.endsOn < to ? l.endsOn : to
    if (first > last) continue
    // The first date on or after `first` that falls on the lesson's day.
    let d = addDays(first, (l.dayOfWeek - weekday(first) + 7) % 7)
    while (d <= last) {
      if (!overridden.has(occurrenceId(l.id, d))) out.push(fromLesson(l, d))
      d = addDays(d, 7)
    }
  }
  for (const o of occurrences) {
    if (o.date >= from && o.date <= to) out.push(fromOccurrence(o))
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
}

export function endTime(item: Pick<CalendarItem, 'startTime' | 'durationMinutes'>): string {
  return fromMinutes(toMinutes(item.startTime) + item.durationMinutes)
}

/** Free stretches on a date long enough for a lesson, between dayStart and dayEnd. */
export function freeTimes(
  date: string,
  items: CalendarItem[],
  minutes: number,
  dayStart: number,
  dayEnd: number,
  step = 30,
): string[] {
  const busy = items
    .filter((i) => i.date === date && !i.cancelled)
    .map((i) => [toMinutes(i.startTime), toMinutes(i.startTime) + i.durationMinutes] as const)
  const out: string[] = []
  for (let t = dayStart * 60; t + minutes <= dayEnd * 60; t += step) {
    if (busy.every(([a, b]) => t + minutes <= a || t >= b)) out.push(fromMinutes(t))
  }
  return out
}

/* ── Dragging ─────────────────────────────────────────────────────────── */

export const SNAP_MINUTES = 15

/** A pointer moved `dy` pixels on a grid of `pxPerHour`: whole 15-minute steps. */
export function snapSteps(dy: number, pxPerHour: number): number {
  return Math.round((dy / pxPerHour) * (60 / SNAP_MINUTES))
}

export function movedStart(start: string, dy: number, pxPerHour: number, duration: number, dayStart: number, dayEnd: number): string {
  const t = toMinutes(start) + snapSteps(dy, pxPerHour) * SNAP_MINUTES
  return fromMinutes(Math.min(Math.max(t, dayStart * 60), dayEnd * 60 - duration))
}

export function resizedLength(start: string, duration: number, dy: number, pxPerHour: number, dayEnd: number): number {
  const d = duration + snapSteps(dy, pxPerHour) * SNAP_MINUTES
  return Math.min(Math.max(d, SNAP_MINUTES), dayEnd * 60 - toMinutes(start))
}

/** Calendar cells for a month view: whole weeks, Monday first. */
export function monthGrid(year: number, month0: number): string[] {
  const first = new Date(year, month0, 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(year, month0, 1 - offset)
  const last = new Date(year, month0 + 1, 0)
  const cells = Math.ceil((offset + last.getDate()) / 7) * 7
  return Array.from({ length: cells }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
}

export function sameMonth(key: string, year: number, month0: number): boolean {
  const d = parseDay(key)
  return d.getFullYear() === year && d.getMonth() === month0
}
