import { describe, expect, it } from 'vitest'
import { piecesOf, onPiece, minutesOnPiece, pieceFields, pieceLabel } from '../sessionPieces'
import { derivePieceStats } from '../pieces'
import type { Piece, PracticeSession } from '@/types'

const one = { durationMinutes: 30, pieceName: 'p1' }
const shared = { durationMinutes: 30, pieceName: 'p1', pieceMinutes: { p1: 15, p2: 15 } }
const none = { durationMinutes: 30 }

describe('reading a session’s pieces', () => {
  it('a session on one piece reads exactly as it always has', () => {
    expect(piecesOf(one)).toEqual(['p1'])
    expect(minutesOnPiece(one, 'p1')).toBe(30)
    expect(minutesOnPiece(one, 'p2')).toBe(0)
  })

  it('a shared session is on every piece, with its share each', () => {
    expect(piecesOf(shared).sort()).toEqual(['p1', 'p2'])
    expect(onPiece(shared, 'p2')).toBe(true)
    expect(minutesOnPiece(shared, 'p2')).toBe(15)
  })

  it('a session on no piece is on none', () => {
    expect(piecesOf(none)).toEqual([])
    expect(onPiece(none, 'p1')).toBe(false)
  })
})

describe('saving a session’s pieces', () => {
  it('writes nothing for no piece, and just pieceName for one', () => {
    expect(pieceFields([], 30)).toEqual({})
    expect(pieceFields(['p1'], 30)).toEqual({ pieceName: 'p1' })
  })

  it('shares the minutes evenly, always adding up', () => {
    expect(pieceFields(['p1', 'p2'], 30)).toEqual({ pieceName: 'p1', pieceMinutes: { p1: 15, p2: 15 } })
    const three = pieceFields(['a', 'b', 'c'], 10).pieceMinutes!
    expect(Object.values(three).reduce((n, m) => n + m, 0)).toBe(10)
  })

  it('a one-minute session cannot split, so it keeps one piece', () => {
    expect(pieceFields(['p1', 'p2'], 1)).toEqual({ pieceName: 'p1' })
  })
})

describe('labels and Library totals', () => {
  const pieces = [{ id: 'p1', title: 'Clair de Lune' }, { id: 'p2', title: 'Für Elise' }]

  it('names every piece a session was on', () => {
    expect(pieceLabel(one, pieces)).toBe('Clair de Lune')
    expect(pieceLabel(shared, pieces).split(' + ').sort()).toEqual(['Clair de Lune', 'Für Elise'])
    expect(pieceLabel(none, pieces)).toBe('')
  })

  it('a piece’s total counts its share of a shared session', () => {
    const piece = { id: 'p2', title: 'Für Elise', status: 'active' } as Piece
    const sessions = [
      { ...shared, id: 's1', date: '2026-11-01', confidenceRating: 7 },
      { ...one, id: 's2', pieceName: 'p2', date: '2026-11-02', confidenceRating: 7 },
    ] as PracticeSession[]
    expect(derivePieceStats(piece, sessions).totalMinutes).toBe(15 + 30)
  })
})
