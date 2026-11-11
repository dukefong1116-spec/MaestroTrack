/**
 * The flame's looks — Spark, Blaze, Gold, Blue, Violet — by streak length — it changes colour at milestones,
 * not just size, so a long streak is recognisable at a glance.
 */
export interface FlameLook {
  id: 'spark' | 'blaze' | 'gold' | 'blue' | 'violet'
  name: string
  at: number
  outer: string
  mid: string
  core: string
}

export const FLAME_LOOKS: FlameLook[] = [
  { id: 'spark', name: 'Spark', at: 1, outer: '#E0702E', mid: '#F59A4A', core: '#FFD79A' },
  { id: 'blaze', name: 'Blaze', at: 7, outer: '#E8362A', mid: '#FF6B43', core: '#FFF0C4' },
  { id: 'gold', name: 'Gold', at: 30, outer: '#D99A06', mid: '#F7C531', core: '#FFF6D0' },
  { id: 'blue', name: 'Blue', at: 100, outer: '#2F7FD8', mid: '#58A8F5', core: '#E8F4FF' },
  { id: 'violet', name: 'Violet', at: 365, outer: '#6E4BD8', mid: '#9B7BF5', core: '#F0E9FF' },
]

export const UNLIT = { outer: '#BFBBB4', mid: '#D8D4CD', core: '#E8E4DC' }
export const ICED = { outer: '#6FA6DC', mid: '#A9CDF2', core: '#EAF4FD' }

export function lookFor(streak: number): FlameLook {
  let look = FLAME_LOOKS[0]
  for (const l of FLAME_LOOKS) if (streak >= l.at) look = l
  return look
}

/** The look this streak length has just reached, if it is a new one. */
export function lookReachedAt(streak: number): FlameLook | null {
  return FLAME_LOOKS.find((l) => l.at === streak && l.at > 1) ?? null
}

/** The flame's outline and core, on a 24×24 grid. */
export const FLAME_PATH =
  'M12.6 1.7c.2 2 1 3.3 2.4 4.9 1.9 2.2 3.5 4.1 3.5 7.2A6.5 6.5 0 0 1 5.5 14c0-2.2.9-3.6 2.2-5.2.5.6.7 1.3.7 2.2 1.6-1.1 2.8-3 2.8-5.2 0-1.5-.3-2.8-.9-4.1 1 .1 1.8.3 2.3 0Z'
export const CORE_PATH = 'M12 11.4c1.5 1.3 2.6 2.7 2.6 4.4a2.75 2.75 0 0 1-5.5 0c0-1.5.9-2.8 2.9-4.4Z'
