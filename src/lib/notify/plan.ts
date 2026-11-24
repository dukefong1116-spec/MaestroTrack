import { compose, DAILY_CAP, isQuiet, type NotifyCategory } from './copy'
import type { LocalItem } from './push'

/**
 * The phone's own reminders for the next week, worked out from what the
 * app already knows. No server: rebuilt whenever the data changes, so the
 * moment you practise, tonight's nudges are simply not in the next plan.
 *
 * Pure (no React, no clock, no storage) so every path is unit-tested.
 */

const DAY = 86_400_000
const HORIZON_DAYS = 7

export interface StudentPlanInput {
  role: 'student'
  now: Date
  on: Partial<Record<NotifyCategory, boolean>>
  name: string
  instrument?: string
  teacherName?: string
  /** "HH:mm" when they chose a time; otherwise the planner learns one. */
  reminderTime?: string
  /** When they usually practise, 0–23, learned from their sessions. */
  usualHour?: number
  streak: number
  todayLit: boolean
  todayMinutes: number
  goalMinutes: number
  freezes: number
  favouritePiece?: string
  neglected?: { title: string; days: number }
  performances: { name: string; date: string }[]
  assignments: { title: string; due: string }[]
  lessons: { at: number; minutes: number }[]
  leagueEndsAt?: number
}

export interface TeacherPlanInput {
  role: 'teacher'
  now: Date
  on: Partial<Record<NotifyCategory, boolean>>
  lessons: { key: string; at: number; minutes: number; title: string; noted: boolean }[]
  quiet: string[]
}

/** A local time on `day` days from `now`'s date. */
function at(now: Date, day: number, hour: number, minute = 0): number {
  const d = new Date(now)
  d.setDate(d.getDate() + day)
  d.setHours(hour, minute, 0, 0)
  return d.getTime()
}

function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** A stable number from a string, so a reminder keeps its words between rebuilds. */
function seedOf(s: string): number {
  let h = 7
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

interface Draft { kind: string; at: number; vars: Record<string, string | number | undefined>; key?: string; priority: number }

/** Words, picture and link for each draft; the cap and quiet hours applied. */
function finish(drafts: Draft[], input: { now: Date; on: Partial<Record<NotifyCategory, boolean>> }): LocalItem[] {
  const now = input.now.getTime()
  const out: (LocalItem & { priority: number; exempt: boolean })[] = []
  for (const d of drafts) {
    if (d.at <= now || d.at > now + HORIZON_DAYS * DAY) continue
    const id = `${d.kind}.${dayKey(d.at)}${d.key ? `.${d.key}` : ''}`
    // The same kind on neighbouring days never reads the same.
    const c = compose(d.kind, d.vars, [], seedOf(d.kind) + Math.floor(d.at / DAY))
    if (!c || input.on[c.cat] === false) continue
    const quiet = isQuiet(new Date(d.at).getHours())
    out.push({
      id, kind: d.kind, title: c.title, body: c.body, at: d.at, mood: c.mood,
      url: `femata://go?to=${encodeURIComponent(c.to)}`,
      // In quiet hours it arrives silently, in the list, unless it is one
      // allowed through (the late streak alert, if left on).
      passive: quiet && !c.exempt,
      priority: d.priority, exempt: c.exempt,
    })
  }
  // At most DAILY_CAP a day (exempt ones aside), the most important kept.
  const byDay = new Map<string, typeof out>()
  for (const i of out) {
    const k = dayKey(i.at)
    byDay.set(k, [...(byDay.get(k) ?? []), i])
  }
  const kept: LocalItem[] = []
  for (const items of byDay.values()) {
    const counted = items.filter((i) => !i.exempt).sort((a, b) => b.priority - a.priority).slice(0, DAILY_CAP)
    for (const i of [...counted, ...items.filter((i) => i.exempt)]) {
      const { priority: _p, exempt: _e, ...item } = i
      kept.push(item)
    }
  }
  return kept.sort((a, b) => a.at - b.at)
}

export function planStudent(i: StudentPlanInput): LocalItem[] {
  const drafts: Draft[] = []
  const [rh, rm] = (i.reminderTime ?? '').split(':').map(Number)
  const hour = Number.isFinite(rh) ? rh : i.usualHour ?? 18
  const minute = Number.isFinite(rm) ? rm : 0
  const base = { name: i.name, piece: i.favouritePiece, instrument: i.instrument, teacher: i.teacherName }

  for (let d = 0; d < HORIZON_DAYS; d++) {
    // Today is only reminded about while it is not lit; a later day, the
    // app plans as if it will not be (opening it to practise replans).
    if (d === 0 && i.todayLit) continue
    const today = d === 0
    const streakVars = today ? { streak: i.streak || undefined, next: i.streak + 1, left: Math.max(1, i.goalMinutes - i.todayMinutes) } : {}
    const daily = i.streak > 0 || !today ? 'streak-daily' : 'streak-start'
    drafts.push({ kind: daily, at: at(i.now, d, hour, minute), vars: { ...base, ...streakVars }, priority: 90 })
    // A nudge at another time of day too — it moves around (late morning
    // to mid-afternoon, a different hour each day) so it never feels like
    // a second alarm, and keeps clear of the set time.
    const nudgeHour = 11 + ((at(i.now, d, 12, 0) / DAY + 2) % 5 | 0)
    if (Math.abs(nudgeHour - hour) >= 2) drafts.push({ kind: 'practice-nudge', at: at(i.now, d, nudgeHour, 15), vars: { ...base }, priority: 50 })
    // The evening one only when the daily one was well before it.
    if (hour <= 17) drafts.push({ kind: 'streak-evening', at: at(i.now, d, 19, 30), vars: { ...base, ...streakVars }, priority: 80 })
    // Two hours to midnight with nothing to catch a fall.
    if (today && i.streak > 0 && i.freezes === 0) drafts.push({ kind: 'streak-danger', at: at(i.now, 0, 22), vars: { ...base, streak: i.streak }, priority: 100 })
  }

  // Tomorrow morning, if today ends unlit: a freeze held it, or it broke.
  if (!i.todayLit && i.streak > 0) {
    drafts.push({ kind: i.freezes > 0 ? 'streak-frozen' : 'streak-lost', at: at(i.now, 1, Math.max(8, Math.min(hour, 10)), 0), vars: { ...base, streak: i.streak }, priority: 95 })
  }

  if (i.neglected) drafts.push({ kind: 'piece-neglected', at: at(i.now, 1, 16), vars: { ...base, piece: i.neglected.title, days: i.neglected.days }, priority: 40 })

  for (const p of i.performances) {
    const days = Math.round((new Date(`${p.date}T12:00:00`).getTime() - at(i.now, 0, 12)) / DAY)
    if (days === 1) drafts.push({ kind: 'performance-tomorrow', at: at(i.now, 0, 18), vars: { ...base, performance: p.name }, key: p.date, priority: 70 })
    for (const before of [14, 7, 3]) {
      if (days >= before) drafts.push({ kind: 'performance-soon', at: at(i.now, days - before, 9), vars: { ...base, performance: p.name, days: before }, key: `${p.date}.${before}`, priority: 60 })
    }
  }

  for (const a of i.assignments) {
    const days = Math.round((new Date(`${a.due.slice(0, 10)}T12:00:00`).getTime() - at(i.now, 0, 12)) / DAY)
    if (days >= 2) drafts.push({ kind: 'assignment-due', at: at(i.now, days - 2, 17), vars: { ...base, title: a.title, when: 'in 2 days' }, key: a.title, priority: 65 })
    if (days >= 0) drafts.push({ kind: 'assignment-due', at: at(i.now, days, 8, 30), vars: { ...base, title: a.title, when: 'today' }, key: a.title, priority: 75 })
  }

  for (const l of i.lessons) {
    const eve = new Date(l.at); eve.setDate(eve.getDate() - 1); eve.setHours(19, 0, 0, 0)
    drafts.push({ kind: 'lesson-tomorrow', at: eve.getTime(), vars: { ...base, time: clock(l.at) }, key: String(l.at), priority: 70 })
    drafts.push({ kind: 'lesson-soon', at: l.at - 3_600_000, vars: { ...base, time: clock(l.at) }, key: String(l.at), priority: 85 })
  }

  // The league's last evening.
  if (i.leagueEndsAt) drafts.push({ kind: 'league-last-day', at: i.leagueEndsAt - 6 * 3_600_000, vars: base, priority: 55 })

  // Away three days: Femata misses you (replanned every time you come back).
  drafts.push({ kind: 'miss-you', at: at(i.now, 3, hour, minute), vars: base, priority: 30 })

  // The first of the month: last month's recap.
  const first = new Date(i.now.getFullYear(), i.now.getMonth() + 1, 1, 10)
  const lastMonth = new Date(i.now.getFullYear(), i.now.getMonth(), 1).toLocaleDateString([], { month: 'long' })
  drafts.push({ kind: 'month-recap', at: first.getTime(), vars: { ...base, month: lastMonth }, priority: 35 })

  return finish(drafts, i)
}

export function planTeacher(i: TeacherPlanInput): LocalItem[] {
  const drafts: Draft[] = []
  for (const l of i.lessons) {
    const student = l.title.trim().split(/\s+/)[0] || 'your student'
    drafts.push({ kind: 'teacher-lesson-soon', at: l.at - 15 * 60_000, vars: { student, time: clock(l.at), minutes: l.minutes }, key: l.key, priority: 80 })
    // Ten minutes after it ends, unless a note is already written.
    if (!l.noted) drafts.push({ kind: 'lesson-note-due', at: l.at + (l.minutes + 10) * 60_000, vars: { student }, key: l.key, priority: 75 })
  }
  // Monday morning: who went quiet. Sunday evening: the week.
  const toMonday = ((8 - i.now.getDay()) % 7) || 7
  if (i.quiet.length) {
    drafts.push({ kind: 'students-quiet', at: at(i.now, toMonday, 9), vars: { count: i.quiet.length > 1 ? i.quiet.length : undefined, student: i.quiet.length === 1 ? i.quiet[0] : undefined }, priority: 40 })
  }
  const toSunday = (7 - i.now.getDay()) % 7
  drafts.push({ kind: 'studio-week', at: at(i.now, toSunday, 19), vars: {}, priority: 30 })
  return finish(drafts, i)
}
