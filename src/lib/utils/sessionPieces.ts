import type { PracticeSession } from '@/types'
import { splitEvenly } from './categories'

/**
 * Which pieces a session was on, and how its minutes divide between them.
 *
 * The same shape as categories (see ./categories): `pieceName` holds the
 * main piece's id, as it always has, and `pieceMinutes` is added only when
 * a session covered more than one. A session saved before this, or on one
 * piece, reads exactly as it did. Everything that asks "was this session
 * on that piece?" or "how long on it?" asks here.
 */

type SessionLike = Pick<PracticeSession, 'durationMinutes'> & {
  pieceName?: string
  pieceMinutes?: Record<string, number>
}

/** The pieces this session was on, most time first. */
export function piecesOf(s: SessionLike): string[] {
  const split = s.pieceMinutes
  if (split && Object.keys(split).length > 0) {
    return Object.entries(split).filter(([, m]) => m > 0).sort(([, a], [, b]) => b - a).map(([id]) => id)
  }
  return s.pieceName ? [s.pieceName] : []
}

/** Whether this session was on a piece at all. */
export function onPiece(s: SessionLike, pieceId: string): boolean {
  return piecesOf(s).includes(pieceId)
}

/** This session's minutes on one piece — its share, not its whole length. */
export function minutesOnPiece(s: SessionLike, pieceId: string): number {
  const split = s.pieceMinutes
  if (split && Object.keys(split).length > 0) return split[pieceId] ?? 0
  return s.pieceName === pieceId ? s.durationMinutes : 0
}

/**
 * The fields a session is saved with, for the pieces picked. One piece
 * writes exactly what a session always has; more share the minutes evenly.
 */
export function pieceFields(ids: string[], minutes: number): { pieceName?: string; pieceMinutes?: Record<string, number> } {
  if (ids.length === 0) return {}
  if (ids.length === 1) return { pieceName: ids[0] }
  const split = splitEvenly(ids, minutes) as Record<string, number>
  const kept = ids.filter((id) => (split[id] ?? 0) > 0)
  // A session too short to give every piece a minute keeps the ones it can.
  return kept.length > 1 ? { pieceName: kept[0], pieceMinutes: split } : { pieceName: kept[0] ?? ids[0] }
}

/** "Clair de Lune + Für Elise", for a row in the history. */
export function pieceLabel(s: SessionLike, pieces: { id: string; title: string }[]): string {
  return piecesOf(s)
    .map((id) => pieces.find((p) => p.id === id)?.title ?? id)
    .join(' + ')
}
