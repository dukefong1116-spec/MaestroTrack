import type { Piece, PracticeSession } from '@/types'

/**
 * When to suggest calling a piece mastered.
 *
 * Marking a piece mastered was previously something you had to remember to
 * do from a dropdown, so the biggest achievement in the app depended on
 * admin. This derives the moment instead — but it is a *suggestion*, and
 * suggestions that repeat become nagging, so each piece gets exactly one
 * (tracked in `masteryPromptsSeen` on the profile).
 *
 * Like everything else here it is a pure function of the session log.
 * Sessions reference their piece by id, stored in the `pieceName` field.
 */

/** Consecutive recent sessions that must all read at least CONFIDENT. */
const RUN = 3
const CONFIDENT = 9
/** Below this a high confidence run says more about an easy piece than a mastered one. */
const MIN_SESSIONS = 5

export interface MasteryCandidate {
  piece: Piece
  totalMinutes: number
  sessionCount: number
  confidenceHistory: { date: string; value: number }[]
}

export function isMasteryCandidate(piece: Piece, sessions: PracticeSession[]): boolean {
  if (piece.status !== 'active') return false

  const mine = sessions
    .filter((s) => s.pieceName === piece.id)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (mine.length < MIN_SESSIONS) return false

  const recent = mine.slice(-RUN)
  if (recent.length < RUN) return false
  return recent.every((s) => s.confidenceRating >= CONFIDENT)
}

/**
 * The first piece worth suggesting, or null. One at a time — offering two
 * at once turns a celebration into a to-do list.
 */
export function findMasteryCandidate(
  pieces: Piece[],
  sessions: PracticeSession[],
  alreadyPrompted: Iterable<string> = []
): MasteryCandidate | null {
  const seen = new Set(alreadyPrompted)

  for (const piece of pieces) {
    if (seen.has(piece.id)) continue
    if (!isMasteryCandidate(piece, sessions)) continue

    const mine = sessions
      .filter((s) => s.pieceName === piece.id)
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      piece,
      totalMinutes: mine.reduce((sum, s) => sum + s.durationMinutes, 0),
      sessionCount: mine.length,
      confidenceHistory: mine.map((s) => ({ date: s.date, value: s.confidenceRating })),
    }
  }
  return null
}
