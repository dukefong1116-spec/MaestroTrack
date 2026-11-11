export const MAX_FREEZES: number
export const DAYS_PER_FREEZE: number
export const COMEBACK_MIN_STREAK: number
export const COMEBACK_DAYS: number

/** One change to your streak rules. `lessonDay`: Monday = 0 … Sunday = 6. */
export interface StreakRule {
  from: string
  min: number
  lessonDay: number | null
}

export type DayStatus = 'done' | 'lesson' | 'frozen' | 'repaired' | 'missed' | 'today'

export interface StreakDay {
  date: string
  status: DayStatus
  minutes: number
  /** The streak at the end of this day. */
  streak: number
  /** Freezes held at the end of this day. */
  held: number
}

export interface Comeback {
  missed: string
  restore: number
  done: number
  complete: boolean
}

export interface StreakWalk {
  current: number
  longest: number
  held: number
  /** Practised days until the next freeze; null while holding the most. */
  nextFreezeIn: number | null
  todayLit: boolean
  todayMinutes: number
  todayRule: { min: number; lessonDay: number | null }
  flameFrozen: boolean
  comeback: Comeback | null
  days: StreakDay[]
}

export interface StreakInput {
  sessions?: ReadonlyArray<{ date: string; durationMinutes: number }>
  rules?: ReadonlyArray<StreakRule>
  frozen?: ReadonlyArray<string>
  repaired?: ReadonlyArray<string>
  today: string
}

export function addDays(day: string, n: number): string
export function dowOf(day: string): number
export function cleanRules(rules: unknown): StreakRule[]
export function ruleOn(rules: StreakRule[], day: string): StreakRule
export function walkStreak(input: StreakInput): StreakWalk
export function freezesToSpend(walk: StreakWalk): string[]
export function holdDays(input: {
  rules?: unknown
  frozen?: unknown
  repaired?: unknown
  from: string
  to: string
}): Set<string>
