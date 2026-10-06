import { format, subDays } from 'date-fns'
import { computeStreak } from './analytics'
import type {
  PracticeSession, PracticeSummary, StudioStats, UserProfile, PracticeCategory,
} from '@/types'

/**
 * Rolled-up practice, so nobody has to read the raw sessions.
 *
 * A teacher's page never renders an individual session — every figure on
 * it feeds an aggregate: totals, the fourteen-day chart, the category
 * breakdown, the heatmap. But reading those sessions meant the whole
 * document arrived in the teacher's browser, thoughts pad included. The
 * notes were hidden by the interface and present in the data.
 *
 * Summarising fixes that and the performance problem together: a teacher
 * with twenty students was downloading every session all of them had ever
 * logged, one student at a time, on every dashboard open.
 */

/**
 * How much history to keep. Two years and a bit bounds the document well
 * under Firestore's 1MB limit while outlasting any chart in the app.
 */
const RETAIN_DAYS = 800

export function buildSummaries(
  sessions: PracticeSession[],
  profile: Pick<UserProfile, 'uid' | 'displayName' | 'instrument' | 'teacherId'>,
  now: Date = new Date()
): { studio: StudioStats; summary: PracticeSummary } {
  const cutoff = format(subDays(now, RETAIN_DAYS), 'yyyy-MM-dd')

  const dailyMinutes: Record<string, number> = {}
  const dailyCategories: Record<string, Record<string, number>> = {}

  for (const s of sessions) {
    const day = s.date.substring(0, 10)
    if (day < cutoff) continue
    dailyMinutes[day] = (dailyMinutes[day] ?? 0) + s.durationMinutes
    const cats = (dailyCategories[day] ??= {})
    cats[s.category] = (cats[s.category] ?? 0) + s.durationMinutes
  }

  const { current } = computeStreak(sessions)
  const updatedAt = new Date().toISOString()

  return {
    studio: {
      uid: profile.uid,
      displayName: profile.displayName,
      instrument: profile.instrument,
      teacherId: profile.teacherId,
      currentStreak: current,
      dailyMinutes,
      updatedAt,
    },
    summary: {
      uid: profile.uid,
      dailyMinutes,
      dailyCategories,
      totalSessions: sessions.length,
      updatedAt,
    },
  }
}

/**
 * Synthetic sessions reconstructed from a summary.
 *
 * The teacher's charts are built on arrays of sessions, and they are good
 * charts. Rather than rewrite four analytics functions and everything that
 * calls them, the summary is expanded back into one stand-in session per
 * day and category — enough for every aggregate those functions compute,
 * and carrying none of what a summary deliberately left out.
 *
 * The missing fields are the point: no notes, no piece, and ratings fixed
 * at neutral, because a summary never knew them.
 */
export function sessionsFromSummary(summary: PracticeSummary | null): PracticeSession[] {
  if (!summary) return []
  const out: PracticeSession[] = []

  for (const [date, cats] of Object.entries(summary.dailyCategories ?? {})) {
    for (const [category, minutes] of Object.entries(cats)) {
      if (minutes <= 0) continue
      out.push({
        id: `${date}:${category}`,
        userId: summary.uid,
        date,
        durationMinutes: minutes,
        category: category as PracticeCategory,
        difficultyRating: 3,
        confidenceRating: 7,
        createdAt: date,
      })
    }
  }

  return out.sort((a, b) => b.date.localeCompare(a.date))
}

/** Minutes practised on a given day, read straight from a summary. */
export function minutesOn(
  stats: Pick<StudioStats, 'dailyMinutes'> | null,
  date: string
): number {
  return stats?.dailyMinutes?.[date] ?? 0
}
