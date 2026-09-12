import { format, differenceInDays, parseISO, addDays, subDays } from 'date-fns'
import type { PracticeSession } from '@/types'

/**
 * Streak freezes.
 *
 * A freeze is the one piece of gamification state that cannot be derived
 * from the session log: it records a decision the app made on a day where,
 * by definition, no session exists. Freezes *earned* are still derived
 * (one per completed week of streak); only the dates *spent* are stored.
 */

/** One freeze per this many consecutive days. */
const DAYS_PER_FREEZE = 7
/** Never hold more than this — unlimited freezes make a streak meaningless. */
export const MAX_FREEZES = 2

export const toDay = (date: Date = new Date()) => format(date, 'yyyy-MM-dd')

/** Local-time yyyy-MM-dd for n days before today. */
export function dayOffset(n: number): string {
  const x = new Date()
  x.setDate(x.getDate() - n)
  return toDay(x)
}

/**
 * Total freezes ever earned, from the best streak the user has reached.
 * Derived, so it can never drift.
 */
export function freezesEarned(longestStreak: number): number {
  return Math.floor(longestStreak / DAYS_PER_FREEZE)
}

export function freezesAvailable(longestStreak: number, used: string[]): number {
  const net = freezesEarned(longestStreak) - used.length
  return Math.max(0, Math.min(MAX_FREEZES, net))
}

export interface FreezeDecision {
  /** Days to newly freeze. Empty when nothing needs saving. */
  freeze: string[]
  /** Streak length that will be preserved by doing so. */
  rescuedStreak: number
}

/**
 * Decide whether to spend freezes to rescue a lapsed streak.
 *
 * Rules:
 *  - Only ever freezes days that have already ended. Today is still live,
 *    so it is never frozen — the user can still practise.
 *  - Only rescues a streak that actually existed before the gap.
 *  - Won't span a gap longer than the freezes available.
 *  - Idempotent: days already in `used` are never re-frozen.
 */
export function decideFreezes(
  sessions: PracticeSession[],
  used: string[],
  longestStreak: number,
  now: Date = new Date()
): FreezeDecision {
  const none: FreezeDecision = { freeze: [], rescuedStreak: 0 }
  if (sessions.length === 0) return none

  const usedSet = new Set(used)
  const active = new Set<string>([...sessions.map((s) => s.date.substring(0, 10)), ...used])

  const today = toDay(now)
  // A streak is only at risk once yesterday has passed without practice.
  if (active.has(today)) return none

  // Walk back from yesterday collecting unbroken missed days.
  const gap: string[] = []
  for (let back = 1; back <= MAX_FREEZES + 1; back++) {
    const day = format(subDays(now, back), 'yyyy-MM-dd')
    if (active.has(day)) {
      // Found the last practised day — everything before `gap` is intact.
      if (gap.length === 0) return none // nothing missed; streak is fine
      const budget = freezesAvailable(longestStreak, used)
      const needed = gap.filter((g) => !usedSet.has(g))
      if (needed.length === 0 || needed.length > budget) return none

      // Confirm a streak actually existed to rescue.
      const priorStreak = countBack(day, active)
      if (priorStreak === 0) return none

      return { freeze: needed, rescuedStreak: priorStreak + needed.length }
    }
    gap.push(day)
  }

  // Gap is wider than we could ever bridge.
  return none
}

/** Length of the unbroken run of active days ending at `day`, inclusive. */
function countBack(day: string, active: Set<string>): number {
  let n = 0
  let cursor = parseISO(day)
  while (active.has(format(cursor, 'yyyy-MM-dd'))) {
    n++
    cursor = subDays(cursor, 1)
  }
  return n
}

/** Days in the last 7 (Mon-first), flagged for the week strip. */
export interface WeekDay {
  date: string
  label: string
  practised: boolean
  frozen: boolean
  isToday: boolean
  isFuture: boolean
}

export function weekStrip(
  sessions: PracticeSession[],
  frozen: string[],
  now: Date = new Date()
): WeekDay[] {
  const practisedSet = new Set(sessions.map((s) => s.date.substring(0, 10)))
  const frozenSet = new Set(frozen)
  const today = toDay(now)

  // Start from Monday of the current week. date-fns day arithmetic, not
  // ±86_400_000ms: a fixed 24h offset shifts the local clock across a DST
  // boundary, which repeated or skipped a day in the strip for anyone
  // opening the app near midnight on changeover week.
  const dow = (now.getDay() + 6) % 7 // 0 = Monday
  const monday = subDays(now, dow)

  return Array.from({ length: 7 }, (_, i) => {
    const dt = addDays(monday, i)
    const date = format(dt, 'yyyy-MM-dd')
    return {
      date,
      label: format(dt, 'EEEEE'),
      practised: practisedSet.has(date),
      frozen: !practisedSet.has(date) && frozenSet.has(date),
      isToday: date === today,
      isFuture: differenceInDays(dt, now) > 0,
    }
  })
}
