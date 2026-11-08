import { create } from 'zustand'
import type { PracticeCategory } from '@/types'

/**
 * Which category the clock is running in, and how long each has had.
 *
 * A live session can now cover several categories: tap the one you have
 * moved on to, and the time from then on is credited there. Nothing here
 * keeps its own clock. It is handed the session timer's elapsed seconds at
 * every change, so it can never disagree with the time on the screen, and
 * a pause is simply time that did not pass.
 *
 * Its own store rather than more fields on practiceStore, but the same
 * lifetime: module-level, so it survives leaving a session and coming back
 * through "Resume", and gone on a reload exactly as the timer is.
 */

type Seconds = Partial<Record<PracticeCategory, number>>

interface CategoryTimerState {
  /** The category being practised now. Null before a session begins. */
  current: PracticeCategory | null
  /** Seconds banked in categories already left. */
  banked: Seconds
  /** The session timer's elapsed seconds when `current` began. */
  since: number

  /** A new session, timing from `atSec`. */
  begin: (category: PracticeCategory, atSec: number) => void
  /** Moved on: bank the time so far, and time the next category from here. */
  switchTo: (category: PracticeCategory, atSec: number) => void
  /**
   * The whole session was this category after all — "I forgot to switch".
   * Folds everything banked into it, and keeps timing it.
   */
  relabelAll: (category: PracticeCategory) => void
  /** Seconds per category at `atSec`, the live stretch included. Changes nothing. */
  secondsAt: (atSec: number) => Seconds
  reset: () => void
}

export const useCategoryTimer = create<CategoryTimerState>((set, get) => ({
  current: null,
  banked: {},
  since: 0,

  begin: (category, atSec) => set({ current: category, banked: {}, since: Math.max(0, atSec) }),

  switchTo: (category, atSec) => {
    const { current, banked, since } = get()
    if (current === category) return
    if (!current) { set({ current: category, since: Math.max(0, atSec) }); return }
    const spent = Math.max(0, atSec - since)
    set({
      current: category,
      banked: { ...banked, [current]: (banked[current] ?? 0) + spent },
      since: Math.max(0, atSec),
    })
  },

  relabelAll: (category) => {
    const { banked } = get()
    const total = Object.values(banked).reduce((n, s) => n + (s ?? 0), 0)
    // The live stretch is not banked yet; it simply carries on, now in
    // `category`, because that is current.
    set({ current: category, banked: total > 0 ? { [category]: total } : {} })
  },

  secondsAt: (atSec) => {
    const { current, banked, since } = get()
    if (!current) return { ...banked }
    return { ...banked, [current]: (banked[current] ?? 0) + Math.max(0, atSec - since) }
  },

  reset: () => set({ current: null, banked: {}, since: 0 }),
}))
