import { format } from 'date-fns'
import { walkStreak } from '@/lib/streak/engine'
import type { StreakPlan } from '@/lib/streak/plan'
import type { PracticeSession } from '@/types'

/**
 * Derived reward state for a freshly logged session.
 *
 * Everything here is a pure function of the sessions the app already has
 * and your streak plan — no writes. Streaks, totals and milestones are
 * recomputed from scratch each time, through the streak engine.
 */

export type StreakState =
  | 'started'    // first day of a new streak
  | 'extended'   // streak grew
  | 'same-day'   // already practised today; streak unchanged
  | 'restarted'  // had a streak before, broke it, starting again
  | 'backdated'  // logged for a past date — no streak claim
  | 'short'      // today, but not yet up to your daily minimum

export interface SessionReward {
  minutes: number
  streakBefore: number
  streakAfter: number
  streakState: StreakState
  /** Total sessions logged on the new session's date, including this one. */
  sessionsToday: number
  /** Total minutes on that date, including this one. */
  minutesToday: number
  isFirstEver: boolean
  hitDailyGoal: boolean
  /** Set when this session pushed the streak onto a milestone (7/14/30/50/100/365). */
  milestone: number | null
  isLongestStreak: boolean
  /** Minutes still to go today before it counts; 0 once it does. */
  minutesToLight: number
  /** The flame was frozen, and this session thawed it. */
  thawed: boolean
  /** Still frozen after this session — it was not enough to thaw. */
  stillFrozen: boolean
  /** Freezes now held, when this session earned one. */
  freezeEarned: number | null
  /** A comeback under way after this session. */
  comeback: { done: number; restore: number } | null
  /** The comeback finished with this session: the streak it brought back. */
  restored: number | null
}

const MILESTONES = [7, 14, 30, 50, 100, 200, 365]

interface ComputeArgs {
  /** Sessions as they were *before* the new one was added. */
  sessionsBefore: PracticeSession[]
  newSession: PracticeSession
  dailyGoalMinutes: number
  /** Your daily minimum, lesson day and decided days. */
  plan?: StreakPlan
}

export function computeSessionReward({
  sessionsBefore,
  newSession,
  dailyGoalMinutes,
  plan = {},
}: ComputeArgs): SessionReward {
  const after = [newSession, ...sessionsBefore]

  const day = newSession.date.substring(0, 10)
  const today = format(new Date(), 'yyyy-MM-dd')
  const isBackdated = day !== today

  const walk = (list: PracticeSession[], repaired = plan.repaired) =>
    walkStreak({ sessions: list, rules: plan.rules, frozen: plan.frozen, repaired, today })
  const b = walk(sessionsBefore)
  const a = walk(after)

  // A comeback finishing here: the streak it brings back is the one the
  // app is about to record, so it is shown now.
  const finished = !isBackdated && a.comeback?.complete && !b.comeback?.complete ? a.comeback : null
  const restoredWalk = finished ? walk(after, [...(plan.repaired ?? []), finished.missed]) : null

  const streakBefore = b.current
  const streakAfter = restoredWalk ? restoredWalk.current : a.current
  const longestAfter = Math.max(a.longest, restoredWalk?.longest ?? 0)

  const sameDay = after.filter((s) => s.date.substring(0, 10) === day)
  const sessionsToday = sameDay.length
  const minutesToday = sameDay.reduce((sum, s) => sum + s.durationMinutes, 0)

  const isFirstEver = sessionsBefore.length === 0

  let streakState: StreakState
  if (isBackdated) {
    streakState = 'backdated'
  } else if (!a.todayLit) {
    streakState = 'short'
  } else if (b.todayLit) {
    // A day counts once, so another session on a day already counted
    // changes nothing.
    streakState = 'same-day'
  } else if (finished) {
    streakState = 'extended'
  } else if (streakBefore === 0) {
    // Distinguish a genuine first streak from picking one back up.
    streakState = sessionsBefore.length > 0 ? 'restarted' : 'started'
  } else {
    streakState = 'extended'
  }

  const crossed =
    streakState === 'extended' || streakState === 'started' || streakState === 'restarted'
  const milestone = crossed
    ? MILESTONES.find((m) => streakAfter === m && streakBefore < m) ?? null
    : null

  return {
    minutes: newSession.durationMinutes,
    streakBefore,
    streakAfter,
    streakState,
    sessionsToday,
    minutesToday,
    isFirstEver,
    hitDailyGoal: minutesToday >= dailyGoalMinutes && dailyGoalMinutes > 0,
    milestone,
    isLongestStreak: streakAfter > 0 && streakAfter >= longestAfter && streakAfter > streakBefore,
    minutesToLight: !isBackdated && !a.todayLit ? Math.max(1, a.todayRule.min - a.todayMinutes) : 0,
    thawed: !isBackdated && b.flameFrozen && a.todayLit && !b.todayLit,
    stillFrozen: !isBackdated && a.flameFrozen,
    freezeEarned: !isBackdated && (restoredWalk ?? a).held > b.held ? (restoredWalk ?? a).held : null,
    comeback: !isBackdated && !finished && a.comeback && a.comeback.done > (b.comeback?.done ?? 0)
      ? { done: a.comeback.done, restore: a.comeback.restore }
      : null,
    restored: finished ? streakAfter : null,
  }
}

/** Headline + supporting line for the celebration overlay. */
export function rewardCopy(r: SessionReward): { headline: string; sub: string } {
  if (r.isFirstEver) {
    return { headline: 'First note logged', sub: 'Your practice history starts here.' }
  }
  if (r.streakState === 'backdated') {
    return { headline: 'Session logged', sub: 'Added to your history.' }
  }
  if (r.streakState === 'short') {
    return {
      headline: 'Session logged',
      sub: `${r.minutesToLight} more minute${r.minutesToLight === 1 ? '' : 's'} today to ${r.stillFrozen ? 'thaw' : 'light'} your flame.`,
    }
  }
  if (r.restored) {
    return { headline: 'Streak brought back', sub: 'Comeback complete. Two days in a row did it.' }
  }
  if (r.thawed) {
    return { headline: 'Flame thawed', sub: `${r.streakAfter} days in a row. The freeze did its job.` }
  }
  if (r.streakState === 'same-day') {
    return {
      headline: `Session ${r.sessionsToday} today`,
      sub: `${r.minutesToday} minutes practised today.`,
    }
  }
  if (r.milestone) {
    return {
      headline: `${r.milestone} day streak`,
      sub: 'A real milestone. Keep it burning.',
    }
  }
  if (r.streakState === 'started') {
    return { headline: 'Streak started', sub: 'Come back tomorrow to keep it alive.' }
  }
  if (r.streakState === 'restarted') {
    if (r.comeback) {
      return { headline: 'Back on track', sub: `One more day tomorrow brings back your ${r.comeback.restore}-day streak.` }
    }
    return { headline: 'Back on track', sub: "Day one again — let's build it up." }
  }
  return {
    headline: `${r.streakAfter} day streak`,
    sub: r.isLongestStreak ? 'Your longest run yet.' : 'Keep the momentum going.',
  }
}
