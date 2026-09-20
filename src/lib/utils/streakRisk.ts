import { format, differenceInMinutes, startOfDay, addDays } from 'date-fns'
import type { PracticeSession } from '@/types'

/**
 * How much of today is left to save a streak, and how loudly to say so.
 *
 * "Practise today to keep your streak" reads identically at 9am and at
 * 11pm, which teaches people to ignore it. Loss aversion only works when
 * the loss is specific and close, so this derives both the time remaining
 * and an urgency that escalates through the evening.
 */

export type RiskLevel = 'none' | 'calm' | 'firm' | 'urgent'

export interface StreakRisk {
  level: RiskLevel
  streak: number
  minutesLeft: number
  /** "4 hours", "35 minutes" — the shape people actually read. */
  timeLeft: string
  /** True when a freeze would cover tonight if it is missed. */
  freezeCovers: boolean
}

const NONE: StreakRisk = {
  level: 'none', streak: 0, minutesLeft: 0, timeLeft: '', freezeCovers: false,
}

/**
 * Never overstates. Under two hours it stays in minutes — "90 minutes
 * left" is both accurate and more urgent than rounding to "an hour",
 * and rounding *up* to "2 hours" would soften a deadline this message
 * exists to sharpen.
 */
function humanise(minutes: number): string {
  if (minutes <= 1) return 'less than a minute'
  if (minutes < 120) return `${minutes} minutes`
  return `${Math.floor(minutes / 60)} hours`
}

export function streakRisk(
  sessions: PracticeSession[],
  currentStreak: number,
  freezesLeft: number,
  now: Date = new Date()
): StreakRisk {
  if (currentStreak <= 0) return NONE

  // Session dates are written with local formatting, so 'today' must be
  // local too — toISOString() is UTC and rolls over early for anyone
  // behind it.
  const today = format(now, 'yyyy-MM-dd')
  if (sessions.some((s) => s.date.substring(0, 10) === today)) return NONE

  // Midnight is the real deadline: it is when the day the streak needs
  // stops being available. endOfDay() is 23:59:59.999, which truncates a
  // minute off every reading — at 22:00 that reported "an hour left"
  // when there were two.
  const midnight = startOfDay(addDays(now, 1))
  const minutesLeft = Math.max(0, differenceInMinutes(midnight, now))
  const hour = now.getHours()

  const level: RiskLevel = hour >= 21 ? 'urgent' : hour >= 18 ? 'firm' : 'calm'

  return {
    level,
    streak: currentStreak,
    minutesLeft,
    timeLeft: humanise(minutesLeft),
    freezeCovers: freezesLeft > 0,
  }
}

/** The line itself. Kept beside the rule so tone and copy cannot drift. */
export function riskCopy(risk: StreakRisk): string {
  const { level, streak, timeLeft, freezeCovers } = risk
  if (level === 'none') return ''

  const stake = `${streak}-day streak`

  if (level === 'urgent') {
    return freezeCovers
      ? `${timeLeft} left to save your ${stake} — or a freeze covers tonight.`
      : `${timeLeft} left. Your ${stake} ends at midnight.`
  }
  if (level === 'firm') {
    return `${timeLeft} left to keep your ${stake} alive.`
  }
  return `Practise today to keep your ${stake} going.`
}
