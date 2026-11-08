import { describe, expect, it } from 'vitest'
import {
  apportion, splitEvenly, primaryOf, categoryFields, minutesByCategory,
  minutesIn, categoriesOf, categoryLabel,
} from '../categories'
import type { PracticeCategory } from '@/types'

const sum = (m: Partial<Record<string, number>>) => Object.values(m).reduce<number>((a, b) => a + (b ?? 0), 0)

describe('apportion', () => {
  it('always adds up to the session’s length exactly', () => {
    // Rounding each third on its own gives 3 + 3 + 3 = 9, and a total
    // that disagrees with the history by a minute.
    const thirds = apportion({ Scales: 1, Technique: 1, Repertoire: 1 }, 10)
    expect(sum(thirds)).toBe(10)

    for (const total of [1, 7, 29, 45, 61, 599]) {
      expect(sum(apportion({ Scales: 13, Technique: 7, Repertoire: 41 }, total))).toBe(total)
    }
  })

  it('follows the timed seconds', () => {
    // 20 minutes of scales then 10 of repertoire, in seconds.
    expect(apportion({ Scales: 1200, Repertoire: 600 }, 30)).toEqual({ Scales: 20, Repertoire: 10 })
  })

  it('drops a category that was tapped but not really practised', () => {
    // Four seconds in Technique by a mis-tap is not a minute of Technique.
    const out = apportion({ Scales: 1796, Technique: 4 }, 30)
    expect(out).toEqual({ Scales: 30 })
  })

  it('returns nothing rather than inventing minutes', () => {
    expect(apportion({}, 30)).toEqual({})
    expect(apportion({ Scales: 0 }, 30)).toEqual({})
    expect(apportion({ Scales: 60 }, 0)).toEqual({})
  })
})

describe('splitEvenly — a logged session, with no clock to go on', () => {
  it('shares the minutes and still adds up', () => {
    expect(splitEvenly(['Scales', 'Repertoire'], 30)).toEqual({ Scales: 15, Repertoire: 15 })
    const three = splitEvenly(['Scales', 'Technique', 'Repertoire'], 10)
    expect(sum(three)).toBe(10)
  })

  it('gives one category all of it', () => {
    expect(splitEvenly(['Scales'], 45)).toEqual({ Scales: 45 })
  })
})

describe('primaryOf / categoryFields — what gets saved', () => {
  it('names the category with the most time', () => {
    expect(primaryOf({ Scales: 10, Repertoire: 20 }, 'Technique')).toBe('Repertoire')
  })

  it('writes a single-category session exactly as it always was', () => {
    // No categoryMinutes at all: the common case is unchanged on disk.
    expect(categoryFields({ Scales: 30 }, 'Repertoire')).toEqual({ category: 'Scales' })
  })

  it('writes the split only when there is one', () => {
    expect(categoryFields({ Scales: 20, Repertoire: 10 }, 'Technique'))
      .toEqual({ category: 'Scales', categoryMinutes: { Scales: 20, Repertoire: 10 } })
  })

  it('falls back when nothing was timed', () => {
    expect(categoryFields({}, 'Repertoire')).toEqual({ category: 'Repertoire' })
  })
})

describe('reading — old sessions and split ones look the same', () => {
  const old = { category: 'Scales' as PracticeCategory, durationMinutes: 30 }
  const split = {
    category: 'Scales' as PracticeCategory, durationMinutes: 30,
    categoryMinutes: { Scales: 20, Repertoire: 10 },
  }

  it('reads a session saved before splits existed as all one category', () => {
    expect(minutesByCategory(old)).toEqual({ Scales: 30 })
    expect(minutesIn(old, 'Scales')).toBe(30)
    expect(minutesIn(old, 'Repertoire')).toBe(0)
  })

  it('reads a split session’s share, not its whole length', () => {
    // The point of the whole change, for a teacher's assignment: a Scales
    // target gets the 20 minutes of scales, not all 30.
    expect(minutesIn(split, 'Scales')).toBe(20)
    expect(minutesIn(split, 'Repertoire')).toBe(10)
    expect(minutesIn(split, 'Technique')).toBe(0)
  })

  it('lists and labels categories, most time first', () => {
    expect(categoriesOf(split)).toEqual(['Scales', 'Repertoire'])
    expect(categoryLabel(split)).toBe('Scales + Repertoire')
    expect(categoryLabel(old)).toBe('Scales')
  })
})
