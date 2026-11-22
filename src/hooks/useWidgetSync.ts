import { useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStreak } from '@/hooks/useStreak'
import { usePracticeStore } from '@/stores/practiceStore'
import { useTeacherStore } from '@/stores/teacherStore'
import { useCalendar } from '@/hooks/useStudioData'
import { addDays, dayKey } from '@/lib/studio/dates'
import { needsReview } from '@/lib/utils/assignments'
import { isNativeApp } from '@/lib/native'
import { updateWidgets } from '@/lib/nativeWidgets'

/** Monday of the week `day` is in, and which weekday it is (0 = Monday). */
function weekOf(day: string): { monday: string; index: number } {
  const d = new Date(`${day}T12:00:00`)
  const index = (d.getDay() + 6) % 7
  return { monday: addDays(day, -index), index }
}

/** Keeps the student's widgets current: streak, today, the week, the goal. */
export function useStudentWidgets(enabled: boolean) {
  const { profile } = useAuth()
  const live = useStreak()
  const sessions = usePracticeStore((s) => s.sessions)
  const on = enabled && isNativeApp && !!profile

  const practised = useMemo(() => new Set(sessions.map((s) => s.date)), [sessions])
  useEffect(() => {
    if (!on || !profile) return
    const { monday, index } = weekOf(live.today)
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i)
      return i === index ? live.todayLit : practised.has(d)
    })
    updateWidgets({
      role: 'student',
      day: live.today,
      name: (profile.displayName ?? '').trim().split(/\s+/)[0] ?? '',
      streak: live.current,
      todayLit: live.todayLit,
      todayMinutes: Math.round(live.todayMinutes),
      goalMinutes: Math.round((profile.weeklyGoalMinutes ?? 300) / 7),
      week,
      todayIndex: index,
      streakGoal: profile.streakGoal ?? 0,
      toReview: 0,
    })
  }, [on, profile, live, practised])
}

/** Keeps the teacher's widgets current: the next lesson and what's waiting. */
export function useTeacherWidgets(enabled: boolean) {
  const { profile } = useAuth()
  const toReview = useTeacherStore((s) => s.assignments.filter(needsReview).length)
  const today = dayKey(new Date())
  const items = useCalendar(today, addDays(today, 14))
  const on = enabled && isNativeApp && !!profile

  useEffect(() => {
    if (!on || !profile) return
    const now = Date.now()
    const next = items
      .filter((i) => !i.cancelled)
      .map((i) => ({ i, at: new Date(`${i.date}T${i.startTime}:00`).getTime() }))
      .filter((x) => x.at > now)
      .sort((a, b) => a.at - b.at)[0]
    updateWidgets({
      role: 'teacher',
      day: today,
      name: (profile.displayName ?? '').trim().split(/\s+/)[0] ?? '',
      streak: 0, todayLit: false, todayMinutes: 0, goalMinutes: 0, week: [], todayIndex: 0, streakGoal: 0,
      ...(next ? { nextLessonTitle: next.i.title, nextLessonStart: next.at } : {}),
      toReview,
    })
  }, [on, profile, items, toReview, today])
}
