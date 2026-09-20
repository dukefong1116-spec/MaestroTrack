import { describe, it, expect } from 'vitest'
import { isMasteryCandidate, findMasteryCandidate } from '../mastery'
import type { Piece, PracticeSession } from '@/types'

const piece = (over: Partial<Piece> = {}): Piece => ({
  id: 'p1', userId: 'u', title: 'Ballade No. 1', difficulty: 4, status: 'active',
  totalMinutes: 0, sessionCount: 0, completionPercentage: 0, confidenceHistory: [],
  startedAt: '2026-01-01', updatedAt: '2026-01-01', ...over,
})

/** `date` ascending by index; confidence supplied per session. */
const sess = (confidences: number[], pieceId = 'p1'): PracticeSession[] =>
  confidences.map((c, i) => ({
    id: 's' + i, userId: 'u', date: `2026-03-${String(i + 1).padStart(2, '0')}`,
    durationMinutes: 30, category: 'Repertoire' as const, pieceName: pieceId,
    difficultyRating: 3, confidenceRating: c, createdAt: '',
  }))

describe('isMasteryCandidate', () => {
  it('fires when the last three sessions all read 9+', () => {
    expect(isMasteryCandidate(piece(), sess([5, 6, 9, 9, 9]))).toBe(true)
  })

  it('needs enough history — three good days on a new piece is not mastery', () => {
    expect(isMasteryCandidate(piece(), sess([9, 9, 9]))).toBe(false)
  })

  it('does not fire when the run is broken by a bad day', () => {
    expect(isMasteryCandidate(piece(), sess([9, 9, 9, 9, 6]))).toBe(false)
  })

  it('reads the most recent sessions, not the best ones', () => {
    expect(isMasteryCandidate(piece(), sess([10, 10, 10, 4, 4, 4]))).toBe(false)
  })

  it('ignores pieces already mastered or archived', () => {
    const good = sess([5, 9, 9, 9, 9])
    expect(isMasteryCandidate(piece({ status: 'mastered' }), good)).toBe(false)
    expect(isMasteryCandidate(piece({ status: 'archived' }), good)).toBe(false)
  })

  it('only counts sessions belonging to that piece', () => {
    expect(isMasteryCandidate(piece(), sess([9, 9, 9, 9, 9], 'other'))).toBe(false)
  })
})

describe('findMasteryCandidate', () => {
  const ready = sess([5, 6, 9, 9, 9])

  it('returns the piece with its totals', () => {
    const found = findMasteryCandidate([piece()], ready)
    expect(found?.piece.id).toBe('p1')
    expect(found?.sessionCount).toBe(5)
    expect(found?.totalMinutes).toBe(150)
  })

  it('never suggests the same piece twice', () => {
    expect(findMasteryCandidate([piece()], ready, ['p1'])).toBeNull()
  })

  it('offers one at a time even when two qualify', () => {
    const both = [...ready, ...sess([5, 6, 9, 9, 9], 'p2')]
    const pieces = [piece(), piece({ id: 'p2', title: 'Nocturne' })]
    expect(findMasteryCandidate(pieces, both)?.piece.id).toBe('p1')
    expect(findMasteryCandidate(pieces, both, ['p1'])?.piece.id).toBe('p2')
  })

  it('returns null when nothing qualifies', () => {
    expect(findMasteryCandidate([piece()], sess([5, 5, 5, 5, 5]))).toBeNull()
  })
})
