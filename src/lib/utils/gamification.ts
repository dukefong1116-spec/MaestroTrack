import { format } from 'date-fns'
import { computeStreak } from './analytics'
import type { PracticeSession } from '@/types'

/**
 * Derived reward state for a freshly logged session.
 *
 * Everything here is a pure function of the sessions the app already has —
 * no new Firestore fields, no writes, no migration. Streaks, totals and
 * milestones are recomputed from scratch each time.
 */

export type StreakState =
  | 'started'    // first day of a new streak
  | 'extended'   // streak grew
  | 'same-day'   // already practised today; streak unchanged
  | 'restarted'  // had a streak before, broke it, starting again
  | 'backdated'  // logged for a past date — no streak claim

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
}

const MILESTONES = [7, 14, 30, 50, 100, 200, 365]

interface ComputeArgs {
  /** Sessions as they were *before* the new one was added. */
  sessionsBefore: PracticeSession[]
  newSession: PracticeSession
  dailyGoalMinutes: number
}

export function computeSessionReward({
  sessionsBefore,
  newSession,
  dailyGoalMinutes,
}: ComputeArgs): SessionReward {
  const after = [newSession, ...sessionsBefore]

  const { current: streakBefore } = computeStreak(sessionsBefore)
  const { current: streakAfter, longest: longestAfter } = computeStreak(after)

  const day = newSession.date.substring(0, 10)
  const today = format(new Date(), 'yyyy-MM-dd')
  const isBackdated = day !== today

  const sameDay = after.filter((s) => s.date.substring(0, 10) === day)
  const sessionsToday = sameDay.length
  const minutesToday = sameDay.reduce((sum, s) => sum + s.durationMinutes, 0)

  const isFirstEver = sessionsBefore.length === 0

  let streakState: StreakState
  if (isBackdated) {
    streakState = 'backdated'
  } else if (sessionsToday > 1) {
    // Streaks count unique days, so a second session today changes nothing.
    streakState = 'same-day'
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
    return { headline: 'Back on track', sub: "Day one again — let's build it up." }
  }
  return {
    headline: `${r.streakAfter} day streak`,
    sub: r.isLongestStreak ? 'Your longest run yet.' : 'Keep the momentum going.',
  }
}
