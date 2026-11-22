import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePrefs } from '@/hooks/usePrefs'
import { useStreak } from '@/hooks/useStreak'
import { useCalendar, useMembers } from '@/hooks/useStudioData'
import { usePracticeStore } from '@/stores/practiceStore'
import { useTeacherStore } from '@/stores/teacherStore'
import { useLeagueStore } from '@/stores/leagueStore'
import { isNativeApp } from '@/lib/native'
import { addDays, dayKey } from '@/lib/studio/dates'
import { awaitingStudent } from '@/lib/utils/assignments'
import { nextOccurrence } from '@/lib/utils/notifications'
import { planStudent, planTeacher } from '@/lib/notify/plan'
import { GRANTED, notifyPermission, registerDevice, scheduleReminders, type LocalItem } from '@/lib/notify/push'
import type { PracticeSession } from '@/types'

/**
 * Keeps the phone's scheduled reminders in step with the data: a fresh
 * week's plan (lib/notify/plan) whenever anything it depends on changes,
 * and when the app comes back to the front. iPhone app only, and only
 * once notifications are allowed. Also keeps this device registered for
 * pushes for whoever is signed in.
 */

/** When they usually practise: the average start hour of the last two weeks. */
function usualHour(sessions: PracticeSession[], today: string): number | undefined {
  const since = addDays(today, -14)
  const hours = sessions
    .filter((s) => s.date.slice(0, 10) >= since && s.createdAt)
    .map((s) => new Date(new Date(s.createdAt).getTime() - s.durationMinutes * 60_000).getHours())
  if (hours.length < 3) return undefined
  // Rounded down a little: a nudge just before you usually start.
  return Math.max(8, Math.min(20, Math.floor(hours.reduce((a, h) => a + h, 0) / hours.length)))
}

function useSchedule(items: LocalItem[] | null) {
  const last = useRef('')
  // Asked again when notifications are allowed (here, or in the iPhone's
  // Settings while the app was away): a plan made before that was skipped.
  const [wake, setWake] = useState(0)
  useEffect(() => {
    const bump = () => { if (document.visibilityState === 'visible') setWake((n) => n + 1) }
    window.addEventListener(GRANTED, bump)
    document.addEventListener('visibilitychange', bump)
    return () => { window.removeEventListener(GRANTED, bump); document.removeEventListener('visibilitychange', bump) }
  }, [])
  useEffect(() => {
    if (!isNativeApp || !items) return
    const key = JSON.stringify(items)
    if (key === last.current) return
    // A moment's pause: data arrives in bursts at start-up.
    const t = setTimeout(() => {
      void notifyPermission().then((p) => {
        if (p !== 'granted') return
        last.current = key
        void scheduleReminders(items)
      })
    }, 1500)
    return () => clearTimeout(t)
  }, [items, wake])
}

/** The app back in front: replan (the day may have changed) and re-register. */
function useWake() {
  const { profile } = useAuth()
  const uid = profile?.uid
  useEffect(() => {
    if (!uid) return
    void registerDevice()
    const onShow = () => { if (document.visibilityState === 'visible') void registerDevice() }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [uid])
}

export function useStudentReminders(enabled: boolean) {
  const { profile } = useAuth()
  const { prefs } = usePrefs()
  const live = useStreak()
  const sessions = usePracticeStore((s) => s.sessions)
  const pieces = usePracticeStore((s) => s.pieces)
  const performances = usePracticeStore((s) => s.performances)
  const assignments = usePracticeStore((s) => s.assignments)
  const lessons = usePracticeStore((s) => s.lessons)
  const loaded = usePracticeStore((s) => s.sessionsLoaded)
  const room = useLeagueStore((s) => s.room)
  useWake()

  const items = useMemo(() => {
    if (!enabled || !profile || !loaded) return null
    const now = new Date()
    const today = live.today
    // The piece you play most lately, and the one left longest.
    const minutes = new Map<string, number>()
    const lastPlayed = new Map<string, string>()
    for (const s of sessions) {
      const per = s.pieceMinutes ?? (s.pieceName ? { [s.pieceName]: s.durationMinutes } : {})
      for (const [id, m] of Object.entries(per)) {
        if (s.date.slice(0, 10) >= addDays(today, -14)) minutes.set(id, (minutes.get(id) ?? 0) + m)
        const d = s.date.slice(0, 10)
        if (d > (lastPlayed.get(id) ?? '')) lastPlayed.set(id, d)
      }
    }
    const active = pieces.filter((p) => !p.status || p.status === 'active')
    const titleOf = (id: string) => active.find((p) => p.id === id)?.title
    const favourite = [...minutes].sort((a, b) => b[1] - a[1]).map(([id]) => titleOf(id)).find(Boolean)
    const neglected = active
      .map((p) => {
        const last = lastPlayed.get(p.id) ?? p.startedAt.slice(0, 10)
        return { title: p.title, days: Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${last}T12:00:00`).getTime()) / 86_400_000) }
      })
      .filter((p) => p.days >= 5)
      .sort((a, b) => b.days - a.days)[0]
    const lessonTimes = lessons.flatMap((l) => {
      const a = nextOccurrence(l, now)
      const b = l.date ? null : nextOccurrence(l, new Date(a.getTime() + 60_000))
      return [a, b].filter((d): d is Date => !!d && d.getTime() < now.getTime() + 8 * 86_400_000).map((d) => ({ at: d.getTime(), minutes: l.durationMinutes }))
    })
    return planStudent({
      role: 'student',
      now,
      on: prefs.notify,
      name: (profile.displayName ?? '').trim().split(/\s+/)[0] || 'there',
      instrument: profile.instrument,
      teacherName: profile.teacherName?.trim().split(/\s+/)[0],
      reminderTime: prefs.reminderEnabled ? prefs.reminderTime : undefined,
      usualHour: usualHour(sessions, today),
      streak: live.current,
      todayLit: live.todayLit,
      todayMinutes: Math.round(live.todayMinutes),
      goalMinutes: live.todayRule.min,
      freezes: live.held,
      favouritePiece: favourite,
      neglected,
      performances: performances.filter((p) => p.date.slice(0, 10) >= today).map((p) => ({ name: p.eventName, date: p.date.slice(0, 10) })),
      assignments: assignments.filter((a) => awaitingStudent(a) && a.dueDate).map((a) => ({ title: a.title, due: a.dueDate! })),
      lessons: lessonTimes,
      leagueEndsAt: room?.status === 'open' && !profile.leagueOptOut ? room.endsAt : undefined,
    })
  }, [enabled, profile, loaded, live, sessions, pieces, performances, assignments, lessons, room, prefs])

  useSchedule(items)
}

export function useTeacherReminders(enabled: boolean) {
  const { profile } = useAuth()
  const { prefs } = usePrefs()
  const today = dayKey(new Date())
  const calendar = useCalendar(today, addDays(today, 7))
  const notes = useTeacherStore((s) => s.notes)
  const sessions = useTeacherStore((s) => s.studentSessions)
  const members = useMembers()
  useWake()

  const items = useMemo(() => {
    if (!enabled || !profile) return null
    const noted = new Set(notes.map((n) => n.occurrenceId).filter(Boolean))
    const quiet = members.filter((m) => {
      const s = m.uid ? sessions[m.uid] ?? [] : []
      return s.length > 0 && !s.some((x) => x.date.slice(0, 10) >= addDays(today, -5))
    }).map((m) => m.name.split(' ')[0])
    return planTeacher({
      role: 'teacher',
      now: new Date(),
      on: prefs.notify,
      lessons: calendar
        .filter((i) => !i.cancelled && i.rosterIds.length > 0)
        .map((i) => ({ key: i.key, at: new Date(`${i.date}T${i.startTime}:00`).getTime(), minutes: i.durationMinutes, title: i.title, noted: noted.has(i.key) })),
      quiet,
    })
  }, [enabled, profile, calendar, notes, members, sessions, today, prefs])

  useSchedule(items)
}
