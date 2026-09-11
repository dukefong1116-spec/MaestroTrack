import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, differenceInDays } from 'date-fns'
import type { PracticeSession, DailyPracticeData, CategoryData, AnalyticsSummary, PracticeCategory } from '@/types'

export function getDailyData(sessions: PracticeSession[], days = 30): DailyPracticeData[] {
  const end = new Date()
  const start = subDays(end, days - 1)
  const interval = eachDayOfInterval({ start, end })

  return interval.map((date) => {
    const daySessions = sessions.filter((s) => isSameDay(parseISO(s.date), date))
    return {
      date: format(date, 'MMM dd'),
      minutes: daySessions.reduce((sum, s) => sum + s.durationMinutes, 0),
      sessions: daySessions.length,
    }
  })
}

export function getWeeklyData(sessions: PracticeSession[], weeks = 12) {
  const data: { week: string; minutes: number }[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = startOfWeek(subDays(new Date(), i * 7))
    const weekEnd = endOfWeek(weekStart)
    const weekSessions = sessions.filter((s) => {
      const d = parseISO(s.date)
      return d >= weekStart && d <= weekEnd
    })
    data.push({
      week: format(weekStart, 'MMM dd'),
      minutes: weekSessions.reduce((sum, s) => sum + s.durationMinutes, 0),
    })
  }
  return data
}

export function getMonthlyData(sessions: PracticeSession[], months = 6) {
  const data: { month: string; minutes: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const monthStart = startOfMonth(date)
    const monthEnd = endOfMonth(date)
    const monthSessions = sessions.filter((s) => {
      const d = parseISO(s.date)
      return d >= monthStart && d <= monthEnd
    })
    data.push({
      month: format(monthStart, 'MMM yyyy'),
      minutes: monthSessions.reduce((sum, s) => sum + s.durationMinutes, 0),
    })
  }
  return data
}

export function getCategoryData(sessions: PracticeSession[]): CategoryData[] {
  const totals: Partial<Record<PracticeCategory, number>> = {}
  let totalMinutes = 0
  for (const s of sessions) {
    totals[s.category] = (totals[s.category] ?? 0) + s.durationMinutes
    totalMinutes += s.durationMinutes
  }
  return Object.entries(totals).map(([category, minutes]) => ({
    category: category as PracticeCategory,
    minutes: minutes ?? 0,
    percentage: totalMinutes > 0 ? Math.round(((minutes ?? 0) / totalMinutes) * 100) : 0,
  }))
}

export function getHeatmapData(sessions: PracticeSession[], days = 365) {
  const end = new Date()
  const start = subDays(end, days - 1)
  const map: Record<string, number> = {}
  for (const s of sessions) {
    const d = parseISO(s.date)
    if (d >= start && d <= end) {
      const key = format(d, 'yyyy-MM-dd')
      map[key] = (map[key] ?? 0) + s.durationMinutes
    }
  }
  return map
}

/**
 * Current and longest run of consecutive practice days.
 *
 * `frozenDates` are days with no session that should nonetheless count —
 * streak freezes the user has spent. A freeze only bridges a gap; it never
 * starts a streak on its own, so a user with no sessions has no streak
 * however many freezes they hold.
 */
export function computeStreak(
  sessions: PracticeSession[],
  frozenDates: Iterable<string> = []
): { current: number; longest: number } {
  if (sessions.length === 0) return { current: 0, longest: 0 }

  const days = new Set(sessions.map((s) => s.date.substring(0, 10)))
  for (const f of frozenDates) days.add(f.substring(0, 10))
  const uniqueDays = [...days].sort().reverse()
  let current = 0
  let longest = 0
  let streak = 0
  let prev: Date | null = null

  for (const dayStr of uniqueDays) {
    const day = parseISO(dayStr)
    if (prev === null) {
      const today = new Date()
      const diff = differenceInDays(today, day)
      if (diff > 1) break
      streak = 1
    } else {
      const diff = differenceInDays(prev, day)
      if (diff === 1) streak++
      else break
    }
    prev = day
    if (streak > longest) longest = streak
  }
  current = streak

  // compute longest from scratch
  let maxStreak = 0
  let curStreak = 0
  let prevDay: Date | null = null
  for (const dayStr of [...uniqueDays].reverse()) {
    const day = parseISO(dayStr)
    if (prevDay === null) {
      curStreak = 1
    } else {
      const diff = differenceInDays(day, prevDay)
      if (diff === 1) curStreak++
      else curStreak = 1
    }
    prevDay = day
    if (curStreak > maxStreak) maxStreak = curStreak
  }

  return { current, longest: maxStreak }
}

export function computeConsistencyScore(sessions: PracticeSession[], days = 30): number {
  const end = new Date()
  const start = subDays(end, days - 1)
  const interval = eachDayOfInterval({ start, end })
  const practicedDays = new Set(sessions.filter((s) => {
    const d = parseISO(s.date)
    return d >= start && d <= end
  }).map((s) => s.date.substring(0, 10)))
  return Math.round((practicedDays.size / interval.length) * 100)
}

export function getAnalyticsSummary(
  sessions: PracticeSession[],
  weeklyGoalMinutes: number
): AnalyticsSummary {
  const now = new Date()
  const weekStart = startOfWeek(now)
  const monthStart = startOfMonth(now)

  const weekSessions = sessions.filter((s) => parseISO(s.date) >= weekStart)
  const monthSessions = sessions.filter((s) => parseISO(s.date) >= monthStart)

  const totalMinutesThisWeek = weekSessions.reduce((s, p) => s + p.durationMinutes, 0)
  const totalMinutesThisMonth = monthSessions.reduce((s, p) => s + p.durationMinutes, 0)

  const { current, longest } = computeStreak(sessions)
  const consistencyScore = computeConsistencyScore(sessions)
  const weeklyGoalPercentage = weeklyGoalMinutes > 0
    ? Math.min(100, Math.round((totalMinutesThisWeek / weeklyGoalMinutes) * 100))
    : 0

  const categoryTotals: Partial<Record<PracticeCategory, number>> = {}
  for (const s of sessions) {
    categoryTotals[s.category] = (categoryTotals[s.category] ?? 0) + s.durationMinutes
  }
  const mostPracticedCategory = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a)[0]?.[0] as PracticeCategory | null

  const last30 = sessions.filter((s) => parseISO(s.date) >= subDays(now, 30))
  const avgDailyMinutes = last30.length > 0
    ? Math.round(last30.reduce((s, p) => s + p.durationMinutes, 0) / 30)
    : 0

  return {
    totalMinutesThisWeek,
    totalMinutesThisMonth,
    currentStreak: current,
    longestStreak: longest,
    weeklyGoalPercentage,
    consistencyScore,
    mostPracticedCategory,
    avgDailyMinutes,
  }
}

export function generateInsights(sessions: PracticeSession[], pieces: { id: string; title: string; status?: string }[]) {
  const insights: { title: string; description: string; type: 'positive' | 'warning' | 'info' }[] = []

  const summary = getAnalyticsSummary(sessions, 300)

  if (summary.currentStreak >= 7) {
    insights.push({ title: `${summary.currentStreak}-day streak!`, description: 'You are on fire. Keep the momentum going.', type: 'positive' })
  }

  if (summary.consistencyScore >= 80) {
    insights.push({ title: 'Excellent consistency', description: `You practiced ${summary.consistencyScore}% of days this month.`, type: 'positive' })
  }

  if (summary.consistencyScore < 40) {
    insights.push({ title: 'Consistency needs work', description: 'Try to practice at least 5 days per week for best results.', type: 'warning' })
  }

  const categoryData = getCategoryData(sessions.slice(0, 50))
  const weakCategory = categoryData.sort((a, b) => a.minutes - b.minutes)[0]
  if (weakCategory) {
    insights.push({ title: `Low ${weakCategory.category} practice`, description: `Consider dedicating more time to ${weakCategory.category}.`, type: 'warning' })
  }

  const dayTotals: Record<string, number> = {}
  for (const s of sessions) {
    const day = format(parseISO(s.date), 'EEEE')
    dayTotals[day] = (dayTotals[day] ?? 0) + s.durationMinutes
  }
  const bestDay = Object.entries(dayTotals).sort(([, a], [, b]) => b - a)[0]
  if (bestDay) {
    insights.push({ title: `Most productive day: ${bestDay[0]}`, description: `You average ${Math.round(bestDay[1] / 4)} minutes on ${bestDay[0]}s.`, type: 'info' })
  }

  // Neglect is measured from the session log, not the piece's updatedAt.
  // updatedAt only moves when the piece record itself is edited, so keying
  // off it flagged pieces you practise daily and missed ones you don't.
  const now = new Date()
  const neglected = pieces.filter((p) => {
    if (p.status && p.status !== 'active') return false
    const last = sessions
      .filter((s) => s.pieceName === p.id)
      .reduce<string | null>((latest, s) => (latest === null || s.date > latest ? s.date : latest), null)
    if (last === null) return false // never started isn't neglect
    return differenceInDays(now, parseISO(last)) > 5
  })
  if (neglected.length > 0) {
    insights.push({ title: `${neglected[0].title} neglected`, description: `You haven't practiced "${neglected[0].title}" in over 5 days.`, type: 'warning' })
  }

  return insights
}
