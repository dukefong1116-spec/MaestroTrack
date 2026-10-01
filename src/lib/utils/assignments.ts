import { differenceInCalendarDays, parseISO, format, addDays } from 'date-fns'
import type { Assignment, PracticeSession, Submission, TeacherFeedback } from '@/types'

/**
 * Assignment logic, with no I/O so it can be tested directly.
 *
 * An assignment used to be a to-do item: the student pressed a tick and the
 * status became 'completed'. That told the teacher only that a button had
 * been pressed. This models the loop instead — assigned, submitted,
 * reviewed, and either approved or handed back for another go.
 */

export type AssignmentState =
  | 'assigned'   // waiting on the student
  | 'submitted'  // waiting on the teacher
  | 'returned'   // teacher asked for another go
  | 'approved'   // done
  | 'cancelled'  // withdrawn by the teacher

/**
 * Reads both vocabularies.
 *
 * Documents created before the review loop carry 'active', 'completed' or
 * 'dismissed'. Rather than migrating them — which risks orphaning anything
 * missed — every read funnels through here, so old and new rows coexist
 * indefinitely and nothing in the database has to change.
 */
export function normaliseStatus(raw: string | undefined): AssignmentState {
  switch (raw) {
    case 'submitted': return 'submitted'
    case 'returned': return 'returned'
    case 'approved':
    case 'completed': return 'approved'
    case 'cancelled':
    case 'dismissed': return 'cancelled'
    case 'assigned':
    case 'active':
    default: return 'assigned'
  }
}

/** Still wants something from somebody. */
export function isOpen(a: Assignment): boolean {
  const s = normaliseStatus(a.status)
  return s === 'assigned' || s === 'submitted' || s === 'returned'
}

/** The teacher owes a response. */
export function needsReview(a: Assignment): boolean {
  return normaliseStatus(a.status) === 'submitted'
}

/** The student owes work. */
export function awaitingStudent(a: Assignment): boolean {
  const s = normaliseStatus(a.status)
  return s === 'assigned' || s === 'returned'
}

export function latestSubmission(a: Assignment): Submission | null {
  const subs = a.submissions ?? []
  return subs.length ? subs[subs.length - 1] : null
}

export function latestFeedback(a: Assignment): TeacherFeedback | null {
  const fb = a.feedback ?? []
  return fb.length ? fb[fb.length - 1] : null
}

/* ── progress ─────────────────────────────────────────────────────── */

export interface AssignmentProgress {
  /** Minutes practised against this assignment, derived from the log. */
  minutesDone: number
  /** 0–100, or null when the assignment sets no minutes target. */
  percent: number | null
  /** True when a minutes target exists and has been met. */
  targetMet: boolean
  /** True when progress can be derived at all. */
  tracked: boolean
}

/**
 * Minutes practised toward an assignment, read from the session log.
 *
 * `targetMinutes` has been written to every assignment since the feature
 * existed and read by nothing. Deriving against it turns a self-reported
 * tick into something the app can see for itself — the student does not
 * have to claim the work, and the teacher does not have to take their word.
 *
 * Only sessions logged after the assignment was created count, so an
 * assignment cannot be satisfied by practice that predates it. Sessions
 * reference their piece by id in the `pieceName` field.
 */
export function deriveProgress(a: Assignment, sessions: PracticeSession[]): AssignmentProgress {
  const target = a.targetMinutes ?? 0
  if (target <= 0) {
    return { minutesDone: 0, percent: null, targetMet: false, tracked: false }
  }

  const since = a.createdAt.substring(0, 10)
  const relevant = sessions.filter((s) => {
    if (s.date.substring(0, 10) < since) return false
    if (a.pieceId) return s.pieceName === a.pieceId
    if (a.category) return s.category === a.category
    return true
  })

  const minutesDone = relevant.reduce((sum, s) => sum + s.durationMinutes, 0)
  return {
    minutesDone,
    percent: Math.min(100, Math.round((minutesDone / target) * 100)),
    targetMet: minutesDone >= target,
    tracked: true,
  }
}

/* ── dueness ──────────────────────────────────────────────────────── */

export type Dueness = 'none' | 'later' | 'soon' | 'today' | 'overdue'

/**
 * How pressing an assignment is. Uses calendar days against a locally
 * parsed date — `new Date('yyyy-MM-dd')` is UTC midnight and shifts the
 * answer west of Greenwich, which this codebase has paid for twice.
 */
export function dueness(a: Assignment, now: Date = new Date()): Dueness {
  if (!a.dueDate || !awaitingStudent(a)) return 'none'
  const days = differenceInCalendarDays(parseISO(a.dueDate.substring(0, 10)), now)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days <= 2) return 'soon'
  return 'later'
}

export function dueLabel(a: Assignment, now: Date = new Date()): string {
  if (!a.dueDate) return ''
  const due = parseISO(a.dueDate.substring(0, 10))
  const days = differenceInCalendarDays(due, now)
  if (days < -1) return `${Math.abs(days)} days overdue`
  if (days === -1) return 'Due yesterday'
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days <= 6) return `Due ${format(due, 'EEEE')}`
  return `Due ${format(due, 'MMM d')}`
}

/* ── ordering ─────────────────────────────────────────────────────── */

/** Most pressing first: overdue, then today, then soon, then the rest. */
const URGENCY: Record<Dueness, number> = { overdue: 0, today: 1, soon: 2, later: 3, none: 4 }

export function sortForStudent(list: Assignment[], now: Date = new Date()): Assignment[] {
  return [...list].sort((a, b) => {
    const ua = URGENCY[dueness(a, now)]
    const ub = URGENCY[dueness(b, now)]
    if (ua !== ub) return ua - ub
    return a.createdAt.localeCompare(b.createdAt)
  })
}

/** Oldest submission first — whoever has been waiting longest is served first. */
export function sortForReview(list: Assignment[]): Assignment[] {
  return list.filter(needsReview).sort((a, b) => {
    const sa = latestSubmission(a)?.at ?? a.updatedAt
    const sb = latestSubmission(b)?.at ?? b.updatedAt
    return sa.localeCompare(sb)
  })
}

/* ── daily practice targets ───────────────────────────────────────── */

export interface DailyDay {
  date: string
  minutes: number
  met: boolean
  isToday: boolean
  /** Not yet arrived — shown but not counted against the student. */
  isFuture: boolean
}

export interface DailyProgress {
  tracked: boolean
  days: DailyDay[]
  /** Days meeting the target so far. */
  daysMet: number
  /** Days the assignment covers in total. */
  daysRequired: number
  minutesDone: number
  /** dailyTarget × daysRequired — what the teacher set in total. */
  minutesRequired: number
  /** Every day that has already passed met its target. */
  onTrack: boolean
  /** Enough days met to hand it in. */
  targetMet: boolean
}

/**
 * A "practise N minutes a day" assignment, measured against the log.
 *
 * The window runs from the day the assignment was set to its due date.
 * Without a due date there is no window and nothing to measure, so the
 * assignment is treated as untracked rather than as an infinite one.
 *
 * Days are walked with date-fns rather than by adding 86_400_000ms: a
 * fixed 24-hour step lands on the wrong local day across a DST change,
 * which this codebase has already paid for.
 */
export function deriveDailyProgress(
  a: Assignment,
  sessions: PracticeSession[],
  now: Date = new Date()
): DailyProgress {
  const target = a.dailyTargetMinutes ?? 0
  const empty: DailyProgress = {
    tracked: false, days: [], daysMet: 0, daysRequired: 0,
    minutesDone: 0, minutesRequired: 0, onTrack: true, targetMet: false,
  }
  if (target <= 0 || !a.dueDate) return empty

  const start = parseISO(a.createdAt.substring(0, 10))
  const end = parseISO(a.dueDate.substring(0, 10))
  if (differenceInCalendarDays(end, start) < 0) return empty

  // Minutes per day, filtered to the assigned piece or category when set.
  const byDay = new Map<string, number>()
  for (const s of sessions) {
    if (a.pieceId && s.pieceName !== a.pieceId) continue
    if (!a.pieceId && a.category && s.category !== a.category) continue
    const day = s.date.substring(0, 10)
    byDay.set(day, (byDay.get(day) ?? 0) + s.durationMinutes)
  }

  const today = format(now, 'yyyy-MM-dd')
  const days: DailyDay[] = []
  for (let d = start; differenceInCalendarDays(end, d) >= 0; d = addDays(d, 1)) {
    const date = format(d, 'yyyy-MM-dd')
    const minutes = byDay.get(date) ?? 0
    days.push({
      date,
      minutes,
      met: minutes >= target,
      isToday: date === today,
      isFuture: date > today,
    })
  }

  const elapsed = days.filter((d) => !d.isFuture)
  const daysMet = days.filter((d) => d.met).length
  const minutesDone = days.reduce((sum, d) => sum + d.minutes, 0)

  return {
    tracked: true,
    days,
    daysMet,
    daysRequired: days.length,
    minutesDone,
    minutesRequired: target * days.length,
    // Today is excluded: the day is not over, so missing it is not a miss.
    onTrack: elapsed.filter((d) => !d.isToday).every((d) => d.met),
    // Hand-in also unlocks once the window has closed, so missing one day
    // does not strand the student with no way to hand anything in at all.
    targetMet: daysMet >= days.length || (days.length > 0 && today > days[days.length - 1].date),
  }
}

/** Either kind of target, whichever this assignment uses. */
export function hasTarget(a: Assignment): boolean {
  return (a.dailyTargetMinutes ?? 0) > 0 || (a.targetMinutes ?? 0) > 0
}
