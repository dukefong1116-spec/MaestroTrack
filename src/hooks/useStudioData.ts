import { useEffect, useMemo } from 'react'
import { doc, collection, writeBatch, arrayUnion } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useTeacherStore } from '@/stores/teacherStore'
import { useAuth } from '@/hooks/useAuth'
import { withDefaults, lessonMinutes } from '@/lib/studio/settings'
import { addDays } from '@/lib/studio/dates'
import { expandRange, lessonFromSlot, occurrenceId, type CalendarItem } from '@/lib/studio/calendar'
import { createRosterStudent, rosterIdFor, updateStudioLesson, updateRosterStudent, convertLegacySlot, saveOccurrence } from '@/lib/firebase/studio'
import type { LessonOccurrence, RosterStudent, StudioLesson, StudioSettings, UserProfile } from '@/types'

/**
 * One student as the studio pages see them: their roster row, and their
 * profile if they are on the app.
 */
export interface Member {
  id: string
  roster: RosterStudent
  profile?: UserProfile
  uid: string | null
  name: string
  instrument?: string
  onApp: boolean
}

export function useStudioSettings(): StudioSettings {
  const { profile } = useAuth()
  const stored = useTeacherStore((s) => s.settings)
  return useMemo(() => withDefaults(profile?.uid ?? '', stored), [profile?.uid, stored])
}

/**
 * Everyone the teacher currently teaches. A student on the app whose row
 * has not been written yet appears straight away from their profile; a
 * row whose account has since left the studio does not appear at all.
 */
export function useMembers(): Member[] {
  const { profile } = useAuth()
  const students = useTeacherStore((s) => s.students)
  const roster = useTeacherStore((s) => s.roster)
  return useMemo(() => {
    const teacherId = profile?.uid ?? ''
    const byUid = new Map(students.map((s) => [s.uid, s]))
    const out: Member[] = []
    const seen = new Set<string>()
    for (const r of roster) {
      if (r.status === 'left') continue
      if (r.uid) {
        const p = byUid.get(r.uid)
        if (!p || seen.has(r.uid)) continue
        seen.add(r.uid)
        out.push({ id: r.id, roster: r, profile: p, uid: r.uid, name: p.displayName || r.name, instrument: p.instrument ?? r.instrument, onApp: true })
      } else {
        out.push({ id: r.id, roster: r, uid: null, name: r.name, instrument: r.instrument, onApp: false })
      }
    }
    for (const p of students) {
      if (seen.has(p.uid)) continue
      const id = rosterIdFor(teacherId, p.uid)
      const r: RosterStudent = { id, teacherId, uid: p.uid, name: p.displayName, instrument: p.instrument, status: 'active', createdAt: '', updatedAt: '' }
      out.push({ id, roster: r, profile: p, uid: p.uid, name: p.displayName, instrument: p.instrument, onApp: true })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  }, [profile?.uid, students, roster])
}

/** Weekly lessons, the old Schedule page's slots included (as read-only weekly lessons). */
export function useAllLessons(): StudioLesson[] {
  const lessons = useTeacherStore((s) => s.lessons)
  const schedule = useTeacherStore((s) => s.schedule)
  const members = useMembers()
  return useMemo(() => {
    const rosterOf = new Map(members.filter((m) => m.uid).map((m) => [m.uid as string, m.id]))
    return [...lessons, ...schedule.map((slot) => lessonFromSlot(slot, rosterOf.get(slot.studentId)))]
  }, [lessons, schedule, members])
}

export function useCalendar(from: string, to: string): CalendarItem[] {
  const lessons = useAllLessons()
  const occurrences = useTeacherStore((s) => s.occurrences)
  return useMemo(() => expandRange(from, to, lessons, occurrences), [from, to, lessons, occurrences])
}

/**
 * Students being linked to a roster row right now: the row-for-every-
 * student upkeep below must not make them a second one meanwhile.
 */
export const linking = new Set<string>()

/**
 * Keeps the studio records in step, from the teacher's own app:
 *  - a roster row for every student on the app (written once each);
 *  - each weekly private lesson's length following its student's length
 *    and the studio default, so the student's app always reads the real
 *    length.
 * Only once every list involved is live — never from the copy saved on the
 * device — and a failed write is simply tried again next time.
 */
export function useStudioUpkeep(teacherId: string | undefined) {
  const live = useTeacherStore((s) => s.live)
  const students = useTeacherStore((s) => s.students)
  const roster = useTeacherStore((s) => s.roster)
  const lessons = useTeacherStore((s) => s.lessons)
  const settings = useStudioSettings()

  useEffect(() => {
    if (!teacherId || !live.students || !live.roster) return
    const have = new Set(roster.map((r) => r.uid).filter(Boolean))
    for (const p of students) {
      if (have.has(p.uid) || linking.has(p.uid)) continue
      linking.add(p.uid)
      void createRosterStudent(teacherId, { uid: p.uid, name: p.displayName || 'Student', instrument: p.instrument }, rosterIdFor(teacherId, p.uid))
        .catch(() => {})
        .finally(() => setTimeout(() => linking.delete(p.uid), 4000))
    }
  }, [teacherId, live.students, live.roster, students, roster])

  useEffect(() => {
    if (!teacherId || !live.roster || !live.lessons || !live.settings) return
    const byId = new Map(roster.map((r) => [r.id, r]))
    for (const l of lessons) {
      if (l.fixedMinutes != null || l.rosterIds.length !== 1) continue
      const r = byId.get(l.rosterIds[0])
      if (!r) continue
      const want = lessonMinutes(r, settings)
      if (want !== l.durationMinutes) void updateStudioLesson(l.id, { durationMinutes: want }).catch(() => {})
    }
  }, [teacherId, live.roster, live.lessons, live.settings, roster, lessons, settings])
}

/**
 * A student who was kept without an account has now joined: everything
 * kept for them becomes theirs, and the row made automatically for their
 * account (if one was) goes, so they are one student, not two.
 */
export async function linkRosterToAccount(rosterId: string, uid: string): Promise<void> {
  const st = useTeacherStore.getState()
  const batch = writeBatch(db)
  const at = new Date().toISOString()
  batch.update(doc(db, 'studioStudents', rosterId), { uid, updatedAt: at })
  for (const a of st.assignments) {
    if (a.rosterId === rosterId && a.studentId === '') batch.update(doc(db, 'assignments', a.id), { studentId: uid, updatedAt: at })
  }
  for (const n of st.notes) {
    if (n.rosterId === rosterId && !n.studentUid) batch.update(doc(db, 'lessonNotes', n.id), { studentUid: uid, updatedAt: at })
  }
  for (const e of st.teacherPractice) {
    if (e.rosterId === rosterId && !e.studentUid) batch.update(doc(db, 'teacherPractice', e.id), { studentUid: uid })
  }
  for (const l of st.lessons) {
    if (l.rosterIds.includes(rosterId)) batch.update(doc(db, 'studioLessons', l.id), { studentUids: arrayUnion(uid), updatedAt: at })
  }
  for (const o of st.occurrences) {
    if (o.rosterIds.includes(rosterId)) batch.update(doc(db, 'lessonOccurrences', o.id), { studentUids: arrayUnion(uid), updatedAt: at })
  }
  const auto = st.roster.find((r) => r.id !== rosterId && r.uid === uid)
  if (auto) batch.update(doc(db, 'studioStudents', auto.id), { status: 'left', uid: null, updatedAt: at })
  await batch.commit()
}

/* ── Writing to the calendar ─────────────────────────────────────────── */


/**
 * The weekly lesson behind a calendar item, made a studio lesson first if
 * it came from the old Schedule page (so the student never sees it twice).
 */
export async function ensureLesson(item: CalendarItem): Promise<string | undefined> {
  if (!item.lessonId) return undefined
  if (!item.legacySlotId) return item.lessonId
  // Converted once already (moments ago, say, by the drag a follow-up
  // "Every week" belongs to): the same lesson, never a second copy.
  const done = converted.get(item.legacySlotId)
  if (done) return done
  const st = useTeacherStore.getState()
  const slot = st.schedule.find((s) => s.id === item.legacySlotId)
  if (!slot) return item.lessonId
  // The slot's length becomes the student's own when it is not the
  // studio default, so the lesson keeps its length and still follows the
  // student's from then on.
  const r = st.roster.find((x) => x.id === item.rosterIds[0])
  const def = withDefaults(st.settings?.teacherId ?? '', st.settings).defaultLessonMinutes
  if (r && r.lessonMinutes == null && slot.durationMinutes !== def) {
    await updateRosterStudent(r.id, { lessonMinutes: slot.durationMinutes }).catch(() => {})
  }
  const pending = convertLegacySlot(slot, r ? item.rosterIds[0] : undefined, item.where, !!r)
  converted.set(item.legacySlotId, pending)
  return pending.catch((e) => { converted.delete(item.legacySlotId as string); throw e })
}
const converted = new Map<string, Promise<string> | string>()

/**
 * Save one dated lesson: its own document from now on (a weekly lesson's
 * date is keyed by the lesson and its original date, so saving again
 * replaces it rather than adding another).
 */
export async function saveItem(teacherId: string, item: CalendarItem, patch: Partial<LessonOccurrence> = {}): Promise<string> {
  const lessonId = await ensureLesson(item)
  const id = item.occurrenceId && !item.legacySlotId
    ? item.occurrenceId
    : lessonId && item.originalDate ? occurrenceId(lessonId, item.originalDate) : null
  const base: Omit<LessonOccurrence, 'id' | 'createdAt' | 'updatedAt'> = {
    teacherId,
    lessonId,
    originalDate: item.originalDate,
    rosterIds: item.rosterIds,
    studentUids: item.studentUids,
    title: item.title,
    tagId: item.tagId,
    date: item.date,
    startTime: item.startTime,
    durationMinutes: item.durationMinutes,
    where: item.where,
    cancelled: item.cancelled || undefined,
    attendance: item.attendance,
    carried: item.carried,
    makeupFor: item.makeupFor,
  }
  return saveOccurrence(id, { ...base, ...patch })
}

/**
 * "Every week from now on": the weekly lesson changes from this date, and
 * the weeks before keep what they were. The lesson is split in two — the
 * old one ends the day before, a new one starts here with the change — so
 * history (and anything already attended) is never rewritten.
 */
export async function updateSeries(item: CalendarItem, patch: { dayOfWeek?: StudioLesson['dayOfWeek']; startTime?: string; minutes?: number; tagId?: string }): Promise<void> {
  const lessonId = await ensureLesson(item)
  if (!lessonId || !item.originalDate) return
  let st = useTeacherStore.getState()
  let lesson = st.lessons.find((l) => l.id === lessonId)
  // Just converted: give the new lesson a moment to arrive.
  for (let i = 0; !lesson && i < 20; i++) {
    await new Promise((r) => setTimeout(r, 100))
    st = useTeacherStore.getState()
    lesson = st.lessons.find((l) => l.id === lessonId)
  }
  if (!lesson) throw new Error('The weekly lesson is not loaded yet.')
  const from = item.originalDate
  const next: Partial<StudioLesson> = {}
  if (patch.dayOfWeek !== undefined) next.dayOfWeek = patch.dayOfWeek
  if (patch.startTime) next.startTime = patch.startTime
  if (patch.tagId) next.tagId = patch.tagId
  if (patch.minutes !== undefined) {
    const solo = lesson.rosterIds.length === 1 ? st.roster.find((x) => x.id === lesson.rosterIds[0]) : undefined
    if (solo) {
      // A private lesson's length is the student's own: change theirs, and
      // this lesson follows it.
      await updateRosterStudent(solo.id, { lessonMinutes: patch.minutes })
      next.fixedMinutes = null
    } else {
      next.fixedMinutes = patch.minutes
    }
    next.durationMinutes = patch.minutes
  }

  const batch = writeBatch(db)
  const at = new Date().toISOString()
  // Dates already given their own document from here on, untouched by a
  // lesson or note, would double up with the new weekly lesson: they go.
  for (const o of st.occurrences) {
    if (o.lessonId === lessonId && o.originalDate && o.originalDate >= from && !Object.keys(o.attendance ?? {}).length && !(o.carried ?? []).length) {
      batch.delete(doc(db, 'lessonOccurrences', o.id))
    }
  }
  if (lesson.startsOn >= from) {
    batch.update(doc(db, 'studioLessons', lessonId), { ...next, updatedAt: at })
  } else {
    batch.update(doc(db, 'studioLessons', lessonId), { endsOn: addDays(from, -1), updatedAt: at })
    const { id: _old, ...rest } = lesson
    void _old
    const fresh = doc(collection(db, 'studioLessons'))
    batch.set(fresh, { ...rest, ...next, startsOn: from, endsOn: lesson.endsOn ?? null, createdAt: at, updatedAt: at })
  }
  await batch.commit()
}
