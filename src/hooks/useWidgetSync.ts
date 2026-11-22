import { useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStreak } from '@/hooks/useStreak'
import { usePracticeStore } from '@/stores/practiceStore'
import { useTeacherStore } from '@/stores/teacherStore'
import { useCalendar } from '@/hooks/useStudioData'
import { addDays, dayKey } from '@/lib/studio/dates'
import { needsReview } from '@/lib/utils/assignments'
import { isNativeApp } from '@/lib/native'
import type { LessonSlot } from '@/types'
import { updateWidgets } from '@/lib/nativeWidgets'
import { nextOccurrence } from '@/lib/utils/notifications'

/** Monday of the week `day` is in, and which weekday it is (0 = Monday). */
function weekOf(day: string): { monday: string; index: number } {
  const d = new Date(`${day}T12:00:00`)
  const index = (d.getDay() + 6) % 7
  return { monday: addDays(day, -index), index }
}

/** As many coming lessons as the large calendar widget shows. */
const AGENDA = 6

/** A student's coming lessons (weekly slots and one-offs), for the widgets. */
function lessonsAhead(lessons: LessonSlot[], teacherName: string | undefined) {
  const now = new Date()
  const horizon = now.getTime() + 14 * 86_400_000
  const title = teacherName ? `Lesson with ${teacherName.trim().split(/\s+/)[0]}` : 'Lesson'
  const agenda = lessons
    .flatMap((l) => {
      // A weekly slot comes round twice in two weeks.
      const first = nextOccurrence(l, now)
      const second = l.date ? null : nextOccurrence(l, new Date(first.getTime() + 60_000))
      return [first, second].filter((d): d is Date => !!d && d.getTime() <= horizon).map((d) => ({ title, start: d.getTime(), minutes: l.durationMinutes }))
    })
    .sort((a, b) => a.start - b.start)
    .slice(0, AGENDA)
  return agenda.length ? { agenda, nextLessonTitle: title, nextLessonStart: agenda[0].start } : { agenda }
}

/** Keeps the student's widgets current: streak, today, the week, the goal. */
export function useStudentWidgets(enabled: boolean) {
  const { profile } = useAuth()
  const live = useStreak()
  const sessions = usePracticeStore((s) => s.sessions)
  const lessons = usePracticeStore((s) => s.lessons)
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
      ...lessonsAhead(lessons, profile.teacherName),
    })
  }, [on, profile, live, practised, lessons])
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
    const ahead = items
      .filter((i) => !i.cancelled)
      .map((i) => ({ i, at: new Date(`${i.date}T${i.startTime}:00`).getTime() }))
      .filter((x) => x.at + x.i.durationMinutes * 60_000 > now)
      .sort((a, b) => a.at - b.at)
    const next = ahead.find((x) => x.at > now)
    updateWidgets({
      role: 'teacher',
      day: today,
      name: (profile.displayName ?? '').trim().split(/\s+/)[0] ?? '',
      streak: 0, todayLit: false, todayMinutes: 0, goalMinutes: 0, week: [], todayIndex: 0, streakGoal: 0,
      ...(next ? { nextLessonTitle: next.i.title, nextLessonStart: next.at } : {}),
      toReview,
      agenda: ahead.slice(0, AGENDA).map((x) => ({ title: x.i.title, start: x.at, minutes: x.i.durationMinutes })),
    })
  }, [on, profile, items, toReview, today])
}
