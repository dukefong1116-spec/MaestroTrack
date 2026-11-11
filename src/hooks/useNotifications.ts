import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useMinuteTick } from '@/hooks/useMinuteTick'
import { usePracticeStore } from '@/stores/practiceStore'
import { useTeacherStore } from '@/stores/teacherStore'
import { useLeagueStore } from '@/stores/leagueStore'
import { updateUserProfile } from '@/lib/firebase/teacher'
import { acceptedAt } from '@/lib/firebase/requests'
import {
  applyNotifyPrefs, buildStudentNotifications, buildTeacherNotifications, unreadCount,
  type AppNotification,
} from '@/lib/utils/notifications'

/**
 * The notification list for whoever is signed in.
 *
 * Reads from the subscriptions the app already has, and derives the rest.
 * Marking everything read writes a single timestamp to the profile, which
 * the existing rules already permit — `validProfileChange` pins only role,
 * teacherId and studioCode, so no rule changed for any of this.
 */
export function useNotifications(): {
  items: AppNotification[]
  unread: number
  markAllRead: () => void
} {
  const { profile, user } = useAuth()
  const uid = profile?.uid ?? user?.uid
  const isTeacher = profile?.role === 'teacher'
  const now = useMinuteTick()

  const lessons = usePracticeStore((s) => s.lessons)
  const students = useTeacherStore((s) => s.students)
  const requests = useTeacherStore((s) => s.requests)
  const teacherMessages = useTeacherStore((s) => s.messages)
  const studentMessages = usePracticeStore((s) => s.messages)
  // The app's one copy of each, kept by useStudentData / useTeacherData.
  const teacherAssignments = useTeacherStore((s) => s.assignments)
  const studentAssignments = usePracticeStore((s) => s.assignments)
  const assignments = isTeacher ? teacherAssignments : studentAssignments

  /**
   * Read state is optimistic.
   *
   * The watermark lives on the profile, which arrives through an auth
   * subscription that does not refresh on every write — so clicking the
   * bell and watching the badge stay lit would be the honest-but-useless
   * behaviour. The local copy wins until the profile catches up.
   */
  const [localReadAt, setLocalReadAt] = useState<string | undefined>()
  const readAt = useMemo(() => {
    const stored = profile?.notificationsReadAt
    if (!stored) return localReadAt
    if (!localReadAt) return stored
    return localReadAt > stored ? localReadAt : stored
  }, [profile?.notificationsReadAt, localReadAt])

  // Settings decides which categories reach the bell. Filtered after the
  // build rather than inside it, so the builders stay about what is true
  // and this stays about what you asked to see.
  const notify = profile?.notify
  const threadsReadAt = profile?.threadsReadAt
  const messagesReadAt = profile?.messagesReadAt
  const teacherId = profile?.teacherId
  const teacherName = profile?.teacherName
  const leagueRoom = useLeagueStore((s) => s.room)
  const leagueResult = profile?.league?.lastResult
  const leagueSeen = profile?.leagueSeen
  const leagueOff = profile?.leagueOptOut
  const joinedAt = useJoinedAt(isTeacher ? undefined : uid, teacherId)
  const studioName = profile?.studioName
  const items = useMemo(() => {
    if (!uid) return []
    // Only messages not yet read in the conversation itself: reading them
    // there is reading them.
    const all = isTeacher
      ? buildTeacherNotifications({
          assignments, students, requests, options: { now },
          messages: teacherMessages.filter((m) => m.from === 'student' && m.createdAt > (threadsReadAt?.[m.studentId] ?? '')),
        })
      : buildStudentNotifications({
          assignments, lessons, options: { now }, teacherName,
          league: uid && !leagueOff ? { uid, room: leagueRoom, result: leagueResult, seenWeek: leagueSeen } : undefined,
          joined: teacherId && joinedAt ? { teacherId, at: joinedAt, studioName } : undefined,
          messages: studentMessages.filter((m) => m.from === 'teacher' && m.teacherId === teacherId && m.createdAt > (messagesReadAt ?? '')),
        })
    return applyNotifyPrefs(all, notify ?? {})
  }, [uid, isTeacher, assignments, students, requests, lessons, now, notify,
      teacherMessages, studentMessages, threadsReadAt, messagesReadAt, teacherId, teacherName,
      leagueRoom, leagueResult, leagueSeen, leagueOff, joinedAt, studioName])

  const markAllRead = useCallback(() => {
    if (!uid) return
    const at = new Date().toISOString()
    setLocalReadAt(at)
    // Fire and forget: a failed write means the badge comes back next
    // visit, which is a far smaller problem than blocking the panel.
    void updateUserProfile(uid, { notificationsReadAt: at }).catch(() => {})
  }, [uid])

  return { items, unread: unreadCount(items, readAt), markAllRead }
}

// One read per student and teacher, however many places show the bell.
const joinedCache = new Map<string, Promise<string | null>>()

/** When the current teacher accepted you, for the "You've joined" item. */
function useJoinedAt(uid: string | undefined, teacherId: string | undefined): string | null {
  const [at, setAt] = useState<string | null>(null)
  useEffect(() => {
    setAt(null)
    if (!uid || !teacherId) return
    const key = `${uid}|${teacherId}`
    let p = joinedCache.get(key)
    if (!p) {
      // A failed read is forgotten, so the next showing tries again.
      p = acceptedAt(uid, teacherId).catch(() => { joinedCache.delete(key); return null })
      joinedCache.set(key, p)
    }
    let live = true
    void p.then((v) => { if (live) setAt(v) })
    return () => { live = false }
  }, [uid, teacherId])
  return at
}
