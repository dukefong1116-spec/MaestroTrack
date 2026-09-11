import { useMemo } from 'react'
import { format } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { getAnalyticsSummary } from '@/lib/utils/analytics'
import type { StickerName } from '@/components/stickers/Sticker'

export type NudgeTone = 'info' | 'warning' | 'success'

export interface Nudge {
  id: string
  sticker: StickerName
  text: string
  tone: NudgeTone
}

/**
 * Timely, data-derived prompts — the things worth telling someone the
 * moment they open the app, rather than burying on a page they'd have to
 * go looking for.
 *
 * Returns at most a handful; an unbounded list stops being a nudge.
 */
export function usePracticeNudges(limit = 3): Nudge[] {
  const { profile } = useAuth()
  const { sessions, pieces } = usePracticeStore()

  const weeklyGoal = profile?.weeklyGoalMinutes ?? 300
  const summary = useMemo(
    () => getAnalyticsSummary(sessions, weeklyGoal),
    [sessions, weeklyGoal]
  )

  return useMemo(() => {
    const out: Nudge[] = []

    const minsLeft = weeklyGoal - summary.totalMinutesThisWeek
    if (minsLeft > 0 && minsLeft <= 60) {
      out.push({
        id: 'near-goal',
        sticker: 'target',
        tone: 'success',
        text: `${minsLeft} minutes from your weekly goal.`,
      })
    }

    if (summary.currentStreak > 0) {
      // Session dates are written in local time (date-fns format), so
      // 'today' must be too. toISOString() is UTC and rolls over early
      // for anyone behind it — in PDT the nudge fired every evening even
      // right after practising.
      const today = format(new Date(), 'yyyy-MM-dd')
      const practisedToday = sessions.some((s) => s.date.substring(0, 10) === today)
      if (!practisedToday) {
        out.push({
          id: 'streak-at-risk',
          sticker: 'flame',
          tone: 'warning',
          text: `Practise today to keep your ${summary.currentStreak}-day streak.`,
        })
      }
    }

    // Sessions store the piece *id* in `pieceName` (every other read site
    // resolves it with `p.id === s.pieceName`). Comparing it against the
    // piece title never matched, which meant every active piece was
    // permanently reported as neglected.
    const neglected = pieces.filter((p) => {
      if (p.status !== 'active') return false
      const last = sessions
        .filter((s) => s.pieceName === p.id)
        .sort((a, b) => b.date.localeCompare(a.date))[0]
      if (!last) return false // never started — that's not neglect
      const days = Math.floor((Date.now() - new Date(last.date).getTime()) / 86_400_000)
      return days >= 5
    })

    for (const piece of neglected.slice(0, 2)) {
      out.push({
        id: `neglected-${piece.id}`,
        sticker: 'note',
        tone: 'info',
        text: `You haven't touched "${piece.title}" in over 5 days.`,
      })
    }

    return out.slice(0, limit)
  }, [sessions, pieces, summary, weeklyGoal, limit])
}
