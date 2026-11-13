import type { PracticeSession } from '@/types'

/**
 * A session at a different length, its breakdowns kept in proportion so
 * they still add up exactly — the rest of the app relies on per-category
 * and per-piece minutes summing to the whole.
 */
export function correctedSession(s: Pick<PracticeSession, 'durationMinutes' | 'categoryMinutes' | 'pieceMinutes'>, toMinutes: number): Partial<PracticeSession> {
  const to = Math.max(0, Math.round(toMinutes))
  const out: Partial<PracticeSession> = { durationMinutes: to }
  const scale = <K extends string>(parts: Partial<Record<K, number>> | undefined): Partial<Record<K, number>> | undefined => {
    if (!parts) return undefined
    const entries = Object.entries(parts) as [K, number][]
    const total = entries.reduce((a, [, v]) => a + (v ?? 0), 0)
    if (!total) return undefined
    const scaled = entries.map(([k, v]) => [k, Math.floor(((v ?? 0) * to) / total)] as [K, number])
    // Hand the rounding remainder to the largest part.
    const rem = to - scaled.reduce((a, [, v]) => a + v, 0)
    const biggest = scaled.reduce((best, cur, i) => (cur[1] > scaled[best][1] ? i : best), 0)
    if (scaled.length) scaled[biggest] = [scaled[biggest][0], scaled[biggest][1] + rem]
    return Object.fromEntries(scaled.filter(([, v]) => v > 0)) as Partial<Record<K, number>>
  }
  if (s.categoryMinutes) out.categoryMinutes = scale(s.categoryMinutes)
  if (s.pieceMinutes) out.pieceMinutes = scale(s.pieceMinutes) as Record<string, number> | undefined
  return out
}
