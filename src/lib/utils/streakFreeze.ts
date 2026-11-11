import { addDays, dowOf, ruleOn, cleanRules, type StreakWalk } from '@/lib/streak/engine'

/**
 * The week strip on Today, from the streak engine's walk.
 *
 * Freezes themselves — earning, holding, spending — now live in the
 * engine (src/lib/streak/engine.js), beside the rest of the streak rules.
 */

export { MAX_FREEZES } from '@/lib/streak/engine'

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** One day of the strip, Monday first. */
export interface WeekDay {
  date: string
  label: string
  practised: boolean
  frozen: boolean
  /** Your lesson day: missed, it held the streak; still to come, it will. */
  lesson: boolean
  isToday: boolean
  isFuture: boolean
}

export function weekStrip(walk: StreakWalk, today: string, rules?: unknown): WeekDay[] {
  const byDate = new Map(walk.days.map((d) => [d.date, d]))
  const plan = cleanRules(rules)
  const monday = addDays(today, -dowOf(today))
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i)
    const status = byDate.get(date)?.status
    const isFuture = date > today
    return {
      date,
      label: LETTERS[i],
      practised: status === 'done',
      frozen: status === 'frozen' || status === 'repaired',
      lesson: status === 'lesson' || (isFuture && ruleOn(plan, date).lessonDay === i),
      isToday: date === today,
      isFuture,
    }
  })
}
