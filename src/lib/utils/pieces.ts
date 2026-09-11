import type { Piece, PracticeSession } from '@/types'

export interface PieceStats {
  totalMinutes: number
  sessionCount: number
  /** 0–100. Derived from how confident you've felt playing it. */
  completionPercentage: number
  /** ISO date of the most recent session, or null if never practised. */
  lastPractisedAt: string | null
  confidenceHistory: { date: string; value: number }[]
}

/**
 * Piece statistics computed from the session log rather than stored on the
 * piece document.
 *
 * These used to be denormalised counters incremented on every logged
 * session, which had three problems: deleting a session never reverted
 * them (so the numbers only ever grew), the increment was a
 * read-modify-write against a possibly-stale local snapshot (so
 * back-to-back sessions could silently lose one), and the two write paths
 * could drift apart. Sessions are already loaded client-side wherever
 * pieces are shown, so deriving is both free and always correct.
 *
 * Sessions reference their piece by *id*, stored in the `pieceName` field.
 */
export function derivePieceStats(piece: Piece, sessions: PracticeSession[]): PieceStats {
  const mine = sessions.filter((s) => s.pieceName === piece.id)

  const totalMinutes = mine.reduce((sum, s) => sum + s.durationMinutes, 0)

  const confidenceHistory = mine
    .map((s) => ({ date: s.date, value: s.confidenceRating }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const avgConfidence = confidenceHistory.length
    ? confidenceHistory.reduce((sum, h) => sum + h.value, 0) / confidenceHistory.length
    : 0

  // A piece you've explicitly marked mastered reads as complete regardless
  // of how timid the confidence ratings were along the way.
  const completionPercentage =
    piece.status === 'mastered' ? 100 : Math.min(100, Math.round(avgConfidence * 10))

  const lastPractisedAt = mine.length
    ? mine.reduce((latest, s) => (s.date > latest ? s.date : latest), mine[0].date)
    : null

  return {
    totalMinutes,
    sessionCount: mine.length,
    completionPercentage,
    lastPractisedAt,
    confidenceHistory,
  }
}
