import { useEffect, useMemo, useState } from 'react'
import { parseISO, differenceInCalendarDays } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { getAnalyticsSummary } from '@/lib/utils/analytics'
import { streakRisk, riskCopy } from '@/lib/utils/streakRisk'
import { freezesAvailable } from '@/lib/utils/streakFreeze'
import type { StickerName } from '@/components/stickers/Sticker'

export type NudgeTone = 'info' | 'warning' | 'success'

export interface Nudge {
  id: string
  sticker: StickerName
  text: string
  tone: NudgeTone
  /**
   * Higher shows first, and survives a low `limit`. Nudges were previously
   * ordered by the order they happened to be pushed, so on a page asking
   * for one nudge a cheerful "60 minutes from your goal" outranked
   * "2 hours left to save your 23-day streak" — the single most important
   * thing the app had to say, pushed off the page by a compliment.
   */
  priority: number
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

  // The streak warning counts down to midnight, so it has to age even
  // when nothing else changes. Without this, a tab left open at 6pm still
  // read "6 hours left" at 10pm and never escalated to urgent — the one
  // message whose whole value is being timely was the one going stale.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

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
        priority: 40,
      })
    }

    // A warning that reads the same at 9am and 11pm teaches people to
    // ignore it, so this names the hours left and sharpens through the
    // evening. See streakRisk for the rule.
    const risk = streakRisk(
      sessions,
      summary.currentStreak,
      freezesAvailable(summary.longestStreak, profile?.streakFreezesUsed ?? []),
      now
    )
    if (risk.level !== 'none') {
      out.push({
        id: 'streak-at-risk',
        sticker: 'flame',
        tone: risk.level === 'calm' ? 'info' : 'warning',
        text: riskCopy(risk),
        // Something is about to be lost; as the night closes in it
        // outranks everything else on the page.
        priority: risk.level === 'urgent' ? 100 : risk.level === 'firm' ? 80 : 50,
      })
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
      // parseISO + calendar days: new Date('yyyy-MM-dd') is UTC midnight, so
      // west of UTC the gap read hours too wide and neglect fired early.
      const days = differenceInCalendarDays(now, parseISO(last.date))
      return days >= 5
    })

    for (const piece of neglected.slice(0, 2)) {
      out.push({
        id: `neglected-${piece.id}`,
        sticker: 'note',
        tone: 'info',
        text: `You haven't touched "${piece.title}" in over 5 days.`,
        priority: 20,
      })
    }

    // Stable sort: equal priorities keep the order they were built in.
    return out.sort((a, b) => b.priority - a.priority).slice(0, limit)
  }, [sessions, pieces, summary, weeklyGoal, limit, profile?.streakFreezesUsed, now])
}
