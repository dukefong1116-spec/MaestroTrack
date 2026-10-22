import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useMinuteTick } from '@/hooks/useMinuteTick'
import { usePracticeStore } from '@/stores/practiceStore'
import { useTeacherStore } from '@/stores/teacherStore'
import { subscribeStudentAssignments, subscribeTeacherAssignments } from '@/lib/firebase/assignments'
import { updateUserProfile } from '@/lib/firebase/teacher'
import {
  buildStudentNotifications, buildTeacherNotifications, unreadCount,
  type AppNotification,
} from '@/lib/utils/notifications'
import type { Assignment } from '@/types'

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
  const [assignments, setAssignments] = useState<Assignment[]>([])

  useEffect(() => {
    if (!uid) return
    return isTeacher
      ? subscribeTeacherAssignments(uid, setAssignments)
      : subscribeStudentAssignments(uid, setAssignments)
  }, [uid, isTeacher])

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

  const items = useMemo(() => {
    if (!uid) return []
    return isTeacher
      ? buildTeacherNotifications({ assignments, students, options: { now } })
      : buildStudentNotifications({ assignments, lessons, options: { now } })
  }, [uid, isTeacher, assignments, students, lessons, now])

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
