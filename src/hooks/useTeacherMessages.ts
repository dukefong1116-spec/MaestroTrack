import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { create } from 'zustand'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { useTeacherStore } from '@/stores/teacherStore'
import { updateUserProfile } from '@/lib/firebase/teacher'
import { subscribeSharedRecordings } from '@/lib/firebase/recordings'
import type { Recording } from '@/types'

/** The docked messages panel (desktop): open or not, and whose thread. */
interface DockState {
  open: boolean
  studentId: string | null
  show: (studentId?: string | null) => void
  close: () => void
  back: () => void
}

export const useDock = create<DockState>((set) => ({
  open: false,
  studentId: null,
  show: (studentId = null) => set({ open: true, studentId }),
  close: () => set({ open: false, studentId: null }),
  back: () => set({ studentId: null }),
}))

const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches

/**
 * Opens a conversation: the dock on a desktop, the Messages screen on a
 * phone. One call for every "Message" button.
 */
export function useOpenMessages() {
  const navigate = useNavigate()
  const show = useDock((s) => s.show)
  return useCallback((studentId?: string | null) => {
    if (isDesktop()) show(studentId ?? null)
    else navigate(studentId ? `/teacher/messages?with=${encodeURIComponent(studentId)}` : '/teacher/messages')
  }, [navigate, show])
}

/** Students with a message from them newer than the last time you read the thread. */
export function useUnreadThreads(): Set<string> {
  const { profile } = useAuth()
  const messages = useTeacherStore((s) => s.messages)
  const readAt = profile?.threadsReadAt
  return useMemo(() => {
    const out = new Set<string>()
    for (const m of messages) {
      if (m.from === 'student' && m.createdAt > (readAt?.[m.studentId] ?? '')) out.add(m.studentId)
    }
    return out
  }, [messages, readAt])
}

/**
 * Having a thread open reads it: written only when something newer has
 * arrived since, so opening it again costs nothing.
 */
export function useMarkThreadRead(studentId: string | null | undefined) {
  const { profile } = useAuth()
  const messages = useTeacherStore((s) => s.messages)
  const latest = useMemo(
    () => messages.filter((m) => m.studentId === studentId && m.from === 'student').at(-1)?.createdAt ?? '',
    [messages, studentId]
  )
  const readAt = (studentId && profile?.threadsReadAt?.[studentId]) || ''
  useEffect(() => {
    const uid = profile?.uid
    if (!uid || !studentId || !latest || latest <= readAt) return
    const live = useAuthStore.getState().profile
    const threadsReadAt = { ...(live?.threadsReadAt ?? {}), [studentId]: new Date().toISOString() }
    if (live) useAuthStore.getState().setProfile({ ...live, threadsReadAt })
    void updateUserProfile(uid, { threadsReadAt }).catch(() => {})
  }, [profile?.uid, studentId, latest, readAt])
}

/** One conversation, with everything MessageThread needs for this student. */
export function useThreadData(studentId: string | null) {
  const assignments = useTeacherStore((s) => s.assignments)
  const messages = useTeacherStore((s) => s.messages)
  const [recordings, setRecordings] = useState<Recording[]>([])
  useEffect(() => {
    if (!studentId) { setRecordings([]); return }
    return subscribeSharedRecordings(studentId, setRecordings)
  }, [studentId])
  useMarkThreadRead(studentId)
  return {
    thread: useMemo(() => messages.filter((m) => m.studentId === studentId), [messages, studentId]),
    mine: useMemo(() => assignments.filter((a) => a.studentId === studentId), [assignments, studentId]),
    recordings,
  }
}

