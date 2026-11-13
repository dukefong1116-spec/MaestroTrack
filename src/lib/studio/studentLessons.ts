import type { LessonOccurrence, LessonSlot, StudioLesson } from '@/types'
import { addDays, dayKey, weekday } from './dates'

/**
 * A student's lessons from the studio calendar, in the shape the student
 * app already understands (LessonSlot), so "next lesson", the reminders
 * and the dashboard work for both without knowing the difference.
 *
 * A weekly lesson becomes a weekly slot that skips the dates it was moved
 * from or cancelled on; a moved lesson or a one-off becomes a slot on its
 * date. Only lessons from the student's current teacher — a document
 * naming them from anyone else is ignored.
 */
export function studentSlots(
  uid: string,
  teacherId: string | undefined,
  lessons: StudioLesson[],
  occurrences: LessonOccurrence[],
  now: Date = new Date(),
): LessonSlot[] {
  if (!teacherId) return []
  const today = dayKey(now)
  const mineL = lessons.filter((l) => l.teacherId === teacherId && l.studentUids.includes(uid) && (!l.endsOn || l.endsOn >= today))
  const mineO = occurrences.filter((o) => o.teacherId === teacherId && o.studentUids.includes(uid))

  const slots: LessonSlot[] = mineL.map((l) => ({
    id: l.id,
    teacherId: l.teacherId,
    studentId: uid,
    studentName: l.title,
    dayOfWeek: l.dayOfWeek,
    startTime: l.startTime,
    durationMinutes: l.durationMinutes,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    skipDates: mineO
      .filter((o) => o.lessonId === l.id && o.originalDate && o.originalDate >= addDays(today, -1)
        && (o.cancelled || o.date !== o.originalDate || o.startTime !== l.startTime))
      .map((o) => o.originalDate as string),
  }))

  for (const o of mineO) {
    if (o.cancelled || o.date < today) continue
    const parent = o.lessonId ? mineL.find((l) => l.id === o.lessonId) : undefined
    // Unchanged from the weekly lesson: the weekly slot already covers it.
    if (parent && o.date === o.originalDate && o.startTime === parent.startTime) continue
    slots.push({
      id: o.id,
      teacherId: o.teacherId,
      studentId: uid,
      studentName: o.title,
      dayOfWeek: weekday(o.date),
      startTime: o.startTime,
      durationMinutes: o.durationMinutes,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      date: o.date,
    })
  }
  return slots
}
