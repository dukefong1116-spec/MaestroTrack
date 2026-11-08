import type { PracticeCategory, PracticeSession } from '@/types'

/**
 * How one session's minutes divide between categories.
 *
 * A session used to have exactly one category, and every chart, badge and
 * assignment counted its whole length there. Now one can cover several:
 * timed per category when it is a live session, split evenly when it is
 * logged afterwards. Everything that counts minutes by category reads it
 * through here, so a split session and an old single-category one are the
 * same shape to every reader — and nothing saved before this needed
 * migrating.
 */

export type CategoryMinutes = Partial<Record<PracticeCategory, number>>

type SessionLike = Pick<PracticeSession, 'category' | 'durationMinutes'> & {
  categoryMinutes?: CategoryMinutes
}

/** Minutes per category for one session. */
export function minutesByCategory(s: SessionLike): CategoryMinutes {
  const split = s.categoryMinutes
  if (split && Object.keys(split).length > 0) return split
  return { [s.category]: s.durationMinutes }
}

/** This session's minutes in one category — its share, not its whole length. */
export function minutesIn(s: SessionLike, category: PracticeCategory | string): number {
  return minutesByCategory(s)[category as PracticeCategory] ?? 0
}

/** Every category this session spent any time in. */
export function categoriesOf(s: SessionLike): PracticeCategory[] {
  return (Object.entries(minutesByCategory(s)) as [PracticeCategory, number][])
    .filter(([, m]) => m > 0)
    .map(([c]) => c)
}

/**
 * Whole minutes per category, from any weights, summing exactly to `total`.
 *
 * Largest-remainder rounding. Rounding each category on its own does not
 * add up — three thirds of 10 minutes round to 3 + 3 + 3 = 9 — and a split
 * that does not sum to the session's length makes every total that reads
 * it disagree with the history. Categories that come out at nothing are
 * dropped: they were tapped, not practised.
 */
export function apportion(weights: Partial<Record<PracticeCategory, number>>, total: number): CategoryMinutes {
  const entries = (Object.entries(weights) as [PracticeCategory, number][]).filter(([, w]) => w > 0)
  const sum = entries.reduce((n, [, w]) => n + w, 0)
  if (entries.length === 0 || sum <= 0 || total <= 0) return {}

  const exact = entries.map(([c, w]) => ({ c, v: (w / sum) * total }))
  const out = exact.map((e) => ({ c: e.c, n: Math.floor(e.v), r: e.v - Math.floor(e.v) }))
  let left = total - out.reduce((n, e) => n + e.n, 0)
  // Hand the leftover minutes to the largest remainders; ties keep order.
  for (const e of [...out].sort((a, b) => b.r - a.r)) {
    if (left <= 0) break
    e.n += 1
    left -= 1
  }

  const result: CategoryMinutes = {}
  for (const e of out) if (e.n > 0) result[e.c] = e.n
  return result
}

/** The even split a logged session gets: there is no clock to say otherwise. */
export function splitEvenly(categories: PracticeCategory[], total: number): CategoryMinutes {
  const weights: Partial<Record<PracticeCategory, number>> = {}
  for (const c of categories) weights[c] = 1
  return apportion(weights, total)
}

/** The category with the most minutes; on a tie, the one listed first. */
export function primaryOf(split: CategoryMinutes, fallback: PracticeCategory): PracticeCategory {
  let best: PracticeCategory | null = null
  let most = -1
  for (const [c, m] of Object.entries(split) as [PracticeCategory, number][]) {
    if (m > most) { best = c; most = m }
  }
  return best ?? fallback
}

/**
 * The fields a session is saved with, from minutes per category.
 *
 * One category writes exactly what a session always has — no
 * `categoryMinutes` at all — so the common case is byte-for-byte unchanged.
 */
export function categoryFields(
  split: CategoryMinutes,
  fallback: PracticeCategory
): { category: PracticeCategory; categoryMinutes?: CategoryMinutes } {
  const category = primaryOf(split, fallback)
  return Object.keys(split).length > 1 ? { category, categoryMinutes: split } : { category }
}

/** "Scales + Repertoire", most time first, for a row in the history. */
export function categoryLabel(s: SessionLike): string {
  const entries = (Object.entries(minutesByCategory(s)) as [PracticeCategory, number][])
    .filter(([, m]) => m > 0)
    .sort(([, a], [, b]) => b - a)
  return entries.length ? entries.map(([c]) => c).join(' + ') : s.category
}
