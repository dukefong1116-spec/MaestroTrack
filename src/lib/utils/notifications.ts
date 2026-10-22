import { addDays, getDay, parseISO, set, startOfDay, differenceInCalendarDays } from 'date-fns'
import type { Assignment, LessonSlot, UserProfile } from '@/types'
import type { StickerName } from '@/components/stickers/Sticker'

/**
 * Notifications, derived rather than stored.
 *
 * Nothing writes a notification. Every one of them is already implied by
 * data the app subscribes to — an assignment that exists, a feedback entry
 * that was appended, a lesson whose weekly slot comes round again — so
 * they are recomputed from that data instead of being fanned out into a
 * collection of their own. No new documents, no new queries, and nothing
 * for the security rules to govern.
 *
 * The only thing worth persisting is whether they have been seen, and
 * that is one timestamp on the profile: everything older has been read.
 */

export type NotificationKind =
  | 'assignment-new'
  | 'assignment-returned'
  | 'assignment-approved'
  | 'lesson-tomorrow'
  | 'lesson-soon'
  | 'submission-received'

export interface AppNotification {
  /** Deterministic, so "seen" survives a reload without storing anything. */
  id: string
  kind: NotificationKind
  title: string
  body?: string
  /** When this became true. Compared against the read watermark. */
  at: string
  /** Where clicking it should go. */
  to: string
  priority: number
  sticker: StickerName
}

export interface BuildOptions {
  now: Date
  /** Ignore anything older than this. Unbounded history is unbounded work. */
  sinceDays?: number
  /** A list nobody will scroll is a list nobody will read. */
  cap?: number
}

const DEFAULTS = { sinceDays: 30, cap: 40 }

/**
 * When does this weekly slot next come round?
 *
 * LessonSlot is a recurring weekday and time, not a dated appointment, so
 * there is no timestamp to compare against — it has to be built. Done with
 * date-fns `addDays` rather than arithmetic on milliseconds, because a
 * week containing a daylight-saving change is not 7 × 86,400,000 ms and
 * this app has shipped that bug more than once.
 */
export function nextOccurrence(slot: LessonSlot, now: Date): Date {
  const [h, m] = slot.startTime.split(':').map((n) => parseInt(n, 10))
  const daysAhead = (slot.dayOfWeek - getDay(now) + 7) % 7
  let when = set(addDays(startOfDay(now), daysAhead), {
    hours: Number.isFinite(h) ? h : 0,
    minutes: Number.isFinite(m) ? m : 0,
    seconds: 0,
    milliseconds: 0,
  })
  // Today, but already gone: the next one is next week.
  if (when.getTime() <= now.getTime()) when = addDays(when, 7)
  return when
}

/** 'yyyy-MM-dd' without going through UTC, which shifts the day west of Greenwich. */
function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function withinHorizon(iso: string, now: Date, sinceDays: number): boolean {
  try {
    return differenceInCalendarDays(now, parseISO(iso)) <= sinceDays
  } catch {
    return false
  }
}

function finish(out: AppNotification[], cap: number): AppNotification[] {
  return out
    .sort((a, b) => (b.priority - a.priority) || b.at.localeCompare(a.at))
    .slice(0, cap)
}

/* ── the student's side ───────────────────────────────────────────── */

export function buildStudentNotifications(input: {
  assignments: Assignment[]
  lessons: LessonSlot[]
  options: BuildOptions
}): AppNotification[] {
  const { assignments, lessons } = input
  const { now, sinceDays = DEFAULTS.sinceDays, cap = DEFAULTS.cap } = input.options
  const out: AppNotification[] = []

  for (const a of assignments) {
    if (withinHorizon(a.createdAt, now, sinceDays)) {
      out.push({
        id: `assignment:${a.id}:new`,
        kind: 'assignment-new',
        title: 'New assignment',
        body: a.title,
        at: a.createdAt,
        to: '/student',
        priority: 60,
        sticker: 'book',
      })
    }

    // One per entry rather than one per assignment: a second round of
    // feedback is a second thing to be told about, and keying the id on
    // the entry's own timestamp means marking the first read does not
    // swallow the second.
    for (const f of a.feedback ?? []) {
      if (!withinHorizon(f.at, now, sinceDays)) continue
      const approved = f.verdict === 'approved'
      out.push({
        id: `assignment:${a.id}:fb:${f.at}`,
        kind: approved ? 'assignment-approved' : 'assignment-returned',
        title: approved ? 'Work approved' : 'Sent back for another go',
        body: f.note ? `${a.title} — ${f.note}` : a.title,
        at: f.at,
        to: '/student',
        priority: approved ? 70 : 85,
        sticker: approved ? 'trophy' : 'note',
      })
    }
  }

  for (const slot of lessons) {
    const when = nextOccurrence(slot, now)
    const minutesAway = (when.getTime() - now.getTime()) / 60_000
    const key = dayKey(when)

    // Each window gets its own id, keyed to the occurrence, so next week's
    // lesson is a new notification rather than a repeat of this week's.
    if (minutesAway <= 60) {
      out.push({
        id: `lesson:${slot.id}:${key}:1h`,
        kind: 'lesson-soon',
        title: 'Lesson within the hour',
        body: `${slot.startTime} — ${Math.max(1, Math.round(minutesAway))} min away`,
        at: new Date(when.getTime() - 60 * 60_000).toISOString(),
        to: '/student',
        priority: 95,
        sticker: 'calendar',
      })
    } else if (minutesAway <= 24 * 60) {
      out.push({
        id: `lesson:${slot.id}:${key}:24h`,
        kind: 'lesson-tomorrow',
        title: 'Lesson tomorrow',
        body: `${slot.startTime}`,
        at: new Date(when.getTime() - 24 * 60 * 60_000).toISOString(),
        to: '/student',
        priority: 65,
        sticker: 'calendar',
      })
    }
  }

  return finish(out, cap)
}

/* ── the teacher's side ───────────────────────────────────────────── */

export function buildTeacherNotifications(input: {
  assignments: Assignment[]
  students: UserProfile[]
  options: BuildOptions
}): AppNotification[] {
  const { assignments, students } = input
  const { now, sinceDays = DEFAULTS.sinceDays, cap = DEFAULTS.cap } = input.options
  const nameOf = new Map(students.map((s) => [s.uid, s.displayName]))
  const out: AppNotification[] = []

  for (const a of assignments) {
    for (const s of a.submissions ?? []) {
      if (!withinHorizon(s.at, now, sinceDays)) continue
      // Already reviewed: a teacher does not need telling about work they
      // have answered. Feedback later than the submission settles it.
      const answered = (a.feedback ?? []).some((f) => f.at > s.at)
      if (answered) continue
      out.push({
        id: `submission:${a.id}:${s.at}`,
        kind: 'submission-received',
        title: `${nameOf.get(a.studentId) ?? 'A student'} handed work in`,
        body: a.title,
        at: s.at,
        to: '/teacher',
        priority: 90,
        sticker: 'book',
      })
    }
  }

  return finish(out, cap)
}

/* ── read state ───────────────────────────────────────────────────── */

export function isUnread(n: AppNotification, readAt?: string): boolean {
  if (!readAt) return true
  return n.at > readAt
}

export function unreadCount(all: AppNotification[], readAt?: string): number {
  return all.reduce((n, item) => n + (isUnread(item, readAt) ? 1 : 0), 0)
}
