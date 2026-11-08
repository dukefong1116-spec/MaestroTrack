import { beforeEach, describe, expect, it } from 'vitest'
import { useCategoryTimer } from '../categoryTimerStore'
import { apportion } from '@/lib/utils/categories'

/**
 * The per-category clock, driven by the session timer's elapsed seconds
 * exactly as SessionPage drives it.
 */
const t = () => useCategoryTimer.getState()

beforeEach(() => t().reset())

describe('timing categories within one session', () => {
  it('credits each stretch to the category it was spent in', () => {
    t().begin('Scales', 0)
    t().switchTo('Repertoire', 600)          // 10 min of scales
    expect(t().secondsAt(1800)).toEqual({ Scales: 600, Repertoire: 1200 })
  })

  it('treats a pause as time that did not pass', () => {
    // The timer's elapsed seconds stand still while paused, so a pause in
    // the middle of Repertoire adds nothing to it.
    t().begin('Scales', 0)
    t().switchTo('Repertoire', 300)
    // …paused for ten real minutes here; elapsed stays at 900 throughout…
    expect(t().secondsAt(900)).toEqual({ Scales: 300, Repertoire: 600 })
  })

  it('adds to a category you come back to, rather than starting it over', () => {
    t().begin('Scales', 0)
    t().switchTo('Repertoire', 300)
    t().switchTo('Scales', 900)
    expect(t().secondsAt(1200)).toEqual({ Scales: 600, Repertoire: 600 })
  })

  it('ignores tapping the category you are already in', () => {
    t().begin('Scales', 0)
    t().switchTo('Scales', 500)
    expect(t().secondsAt(600)).toEqual({ Scales: 600 })
  })

  it('reads without changing anything', () => {
    t().begin('Scales', 0)
    t().secondsAt(100)
    t().secondsAt(900)
    expect(t().secondsAt(300)).toEqual({ Scales: 300 })
  })
})

describe('"It was Scales" — correcting a session that should not have counted', () => {
  it('folds the whole session into one category, as the finish sheet promises', () => {
    // Timed as Repertoire then Technique; the student says it was all scales.
    t().begin('Repertoire', 0)
    t().switchTo('Technique', 600)
    t().relabelAll('Scales')
    expect(t().secondsAt(1500)).toEqual({ Scales: 1500 })
  })

  it('works before anything has been banked', () => {
    t().begin('Repertoire', 0)
    t().relabelAll('Scales')
    expect(t().secondsAt(900)).toEqual({ Scales: 900 })
  })
})

describe('into a saved session', () => {
  it('becomes whole minutes that sum to the session length', () => {
    t().begin('Scales', 0)
    t().switchTo('Repertoire', 1250)   // 20m50s of scales
    const total = 1800                  // a 30-minute session
    const split = apportion(t().secondsAt(total), Math.round(total / 60))
    expect(split).toEqual({ Scales: 21, Repertoire: 9 })
  })
})
