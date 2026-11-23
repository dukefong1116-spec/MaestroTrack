import type { TeacherTourCheckpoint } from '@/types'
import type { Decision, Show } from './tour'

/**
 * The teacher's first-run tutorial: Femata walks a teacher through every
 * page of the studio, one tap at a time — Today, Students, Calendar,
 * Review and Billing. Like the student tour, the steps that matter can
 * only be passed by tapping the thing lit up, and the rest of the screen
 * is blocked meanwhile. Every teacher sees it once, accounts from before
 * it included; from Settings it can be replayed, skippable then.
 *
 * Only data and one decision, so every path is unit-tested; TourLayer
 * draws whatever this returns.
 *
 * A step that asks for a tab to be tapped is done when its page opens
 * (TourLayer moves the checkpoint on), whether the tap came through this
 * page or through the iPhone app's own tab bar, which the page never sees.
 */

const TODAY = '/teacher'
const STUDENTS = '/teacher/students'
const CALENDAR = '/teacher/calendar'
const REVIEW = '/teacher/review'
const MORE = '/teacher/more'
const BILLING = '/teacher/families'

/** The checkpoints in order, for the progress dots. */
const ORDER: Exclude<TeacherTourCheckpoint, 'done'>[] = [
  'welcome', 'today', 'students', 'add-student', 'calendar', 'new-lesson', 'lessons',
  'review', 'review-tip', 'billing', 'billing-tip', 'finish',
]

/** Where each checkpoint's step is shown. */
const PAGE: Record<Exclude<TeacherTourCheckpoint, 'done'>, string> = {
  welcome: TODAY, today: TODAY, students: TODAY,
  'add-student': STUDENTS, calendar: STUDENTS,
  'new-lesson': CALENDAR, lessons: CALENDAR, review: CALENDAR,
  'review-tip': REVIEW, billing: REVIEW,
  'billing-tip': BILLING, finish: BILLING,
}

/** The steps done by opening a page, and what comes after. */
export const TEACHER_TAB_STEPS: Partial<Record<TeacherTourCheckpoint, { to: string; next: TeacherTourCheckpoint }>> = {
  students: { to: STUDENTS, next: 'add-student' },
  calendar: { to: CALENDAR, next: 'new-lesson' },
  review: { to: REVIEW, next: 'review-tip' },
  billing: { to: BILLING, next: 'billing-tip' },
}

/** Where a step's fallback button goes, when what it points at can't be found. */
export const TEACHER_FALLBACK_TO: Partial<Record<Show['id'], string>> = {
  't-students': STUDENTS, 't-calendar': CALENDAR, 't-review': REVIEW, 't-more': MORE, 't-billing': BILLING, 't-more-billing': BILLING,
}

/** The one-time tips, by the `seen` id each one writes. */
export const TEACHER_INTRO_SEEN: Partial<Record<Show['id'], string>> = {
  't-record': 'teacher-record',
}

export interface TeacherTourInput {
  /** Absent: never started — every teacher is shown it once. */
  tour?: TeacherTourCheckpoint
  seen?: string[]
  path: string
  firstName: string
  /** A phone: tabs at the bottom and Billing under More. Otherwise the side menu. */
  compact: boolean
}

const NONE: Decision = { kind: 'none' }

export function whatToShowTeacher(i: TeacherTourInput): Decision {
  const path = i.path.replace(/\/+$/, '') || '/'
  if (path !== TODAY && !path.startsWith(TODAY + '/')) return NONE
  const at = i.tour ?? 'welcome'

  if (at !== 'done') {
    const dots: [number, number] = [ORDER.indexOf(at) + 1, ORDER.length]
    const step = (s: Omit<Show, 'progress' | 'block'> & { block?: boolean }): Decision =>
      ({ kind: 'show', show: { block: true, ...s, progress: dots } })
    const tab = (name: string) => (i.compact ? `tab-${name}` : `rail-${name}`)

    // The tab was tapped and its page is open: TourLayer moves on.
    if (TEACHER_TAB_STEPS[at]?.to === path) return NONE
    // Billing is under More on a phone: on More itself, point at it.
    if (at === 'billing' && i.compact && path === MORE) return step({
      id: 't-more-billing', target: 'more-billing', mustTap: true,
      text: 'Tap Billing 💳',
    })
    // Anywhere else in the tour: back to where it carries on.
    if (path !== PAGE[at]) return { kind: 'redirect', to: PAGE[at] }

    switch (at) {
      case 'welcome': return step({
        id: 't-welcome', button: "Let's go", big: true,
        title: `Hi ${i.firstName}! 👋`,
        text: "I'm Femata 🎵 Let me show you around your studio.",
      })
      case 'today': return step({
        id: 't-today', target: 'teacher-today', button: 'Next',
        text: 'This is Today ☀️ lessons, reviews and payments at a glance.',
      })
      case 'students': return step({
        id: 't-students', target: tab('students'), mustTap: true,
        text: 'Your students 👥 Tap Students.',
      })
      case 'add-student': return step({
        id: 't-add-student', target: 'add-student', mustTap: true,
        text: 'Add students here ➕ Tap Add student.',
      })
      case 'calendar': return step({
        id: 't-calendar', target: tab('calendar'), mustTap: true,
        text: 'Your week 📅 Tap Calendar.',
      })
      case 'new-lesson': return step({
        id: 't-new-lesson', target: 'calendar-add', mustTap: true,
        text: 'Add lessons here 🗓️ Tap +.',
      })
      case 'lessons': return step({
        id: 't-lessons', button: 'Next',
        text: 'Tap a lesson for attendance and notes 📝 Drag it to move it.',
      })
      case 'review': return step({
        id: 't-review', target: tab('review'), mustTap: true,
        text: 'Handed-in work ✅ Tap Review.',
      })
      case 'review-tip': return step({
        id: 't-review-tip', target: 'review-status', button: 'Next',
        text: 'Filter by status. Tap a row to listen and approve 🎧',
      })
      case 'billing': return i.compact
        ? step({ id: 't-more', target: 'tab-more', mustTap: true, text: 'Billing and settings ⋯ Tap More.' })
        : step({ id: 't-billing', target: 'rail-billing', mustTap: true, text: 'Billing 💳 Tap Billing.' })
      case 'billing-tip': return step({
        id: 't-billing-tip', button: 'Next',
        text: 'Invoice everyone in one tap 💳 Set prices first in Settings › Lessons and prices.',
      })
      case 'finish': return step({
        id: 't-finish', button: "Let's teach", big: true,
        title: "You're all set! 🎉",
        text: 'Happy teaching! 🎶',
      })
    }
  }

  // After the tour: tips the first time something comes up.
  const seen = new Set(i.seen ?? [])
  if (/^\/teacher\/students\/[^/]+$/.test(path) && !seen.has('teacher-record')) return {
    kind: 'show',
    show: {
      id: 't-record', button: 'Got it', block: true,
      text: 'One student, everything in one place 🎻 Tap a lesson to write notes.',
    },
  }
  return NONE
}
