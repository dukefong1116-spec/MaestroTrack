import { format } from 'date-fns'
import { addDays, cleanRules, ruleOn, type StreakRule } from './engine'
import type { UserProfile } from '@/types'

/**
 * Your streak rules and the days already decided, as the engine reads them.
 * Everything here lives on the profile.
 */
export interface StreakPlan {
  rules?: ReadonlyArray<StreakRule>
  frozen?: ReadonlyArray<string>
  repaired?: ReadonlyArray<string>
}

type PlanFields = Pick<UserProfile, 'streakRules' | 'streakFreezesUsed' | 'streakRepaired'>

export function planOf(profile: Partial<PlanFields> | null | undefined): StreakPlan {
  return {
    rules: profile?.streakRules ?? [],
    frozen: profile?.streakFreezesUsed ?? [],
    repaired: profile?.streakRepaired ?? [],
  }
}

/** Local-time yyyy-MM-dd, as session dates are written. */
export const localDay = (now: Date = new Date()) => format(now, 'yyyy-MM-dd')

export interface RuleChoice {
  min: number
  /** Monday = 0 … Sunday = 6, or null for none. */
  lessonDay: number | null
}

/** What applies today, and what you have chosen from tomorrow if different. */
export function currentRules(rules: unknown, today: string): { now: RuleChoice; next: RuleChoice | null } {
  const plan = cleanRules(rules)
  const now = ruleOn(plan, today)
  const later = plan.filter((r) => r.from > today)
  const next = later.length ? later[later.length - 1] : null
  return {
    now: { min: now.min, lessonDay: now.lessonDay },
    next: next ? { min: next.min, lessonDay: next.lessonDay } : null,
  }
}

/**
 * The rules list after choosing `choice`. It always starts tomorrow, so
 * today — and every day before it — keeps the rule it had; choosing
 * today's rule again simply cancels a change not yet started.
 */
export function withChoice(rules: unknown, choice: RuleChoice, today: string): StreakRule[] {
  const kept = cleanRules(rules).filter((r) => r.from <= today)
  const now = ruleOn(kept, today)
  if (now.min === choice.min && now.lessonDay === choice.lessonDay) return kept
  return [...kept, { from: addDays(today, 1), min: choice.min, lessonDay: choice.lessonDay }]
}
