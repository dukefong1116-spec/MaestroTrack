import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { useStudentStudioStore } from '@/stores/studentStudioStore'

/**
 * Whether this student is in a studio, and how many of their teacher's
 * messages they have not read.
 *
 * In a studio, the Studio tab takes Settings' place in the bottom bar
 * (Settings opens from the photo on Today instead); a solo musician sees
 * no Studio at all. Unread is everything from the current teacher newer
 * than the moment the student last had the conversation open.
 */
export function useStudio() {
  const { profile } = useAuth()
  const messages = usePracticeStore((s) => s.messages)
  const teacherId = profile?.role === 'student' ? profile.teacherId : undefined
  const readAt = profile?.messagesReadAt ?? ''
  const unreadMessages = useMemo(
    () => (teacherId
      ? messages.filter((m) => m.from === 'teacher' && m.teacherId === teacherId && m.createdAt > readAt).length
      : 0),
    [messages, teacherId, readAt]
  )
  // A correction to the log waits for their answer: shown with the same
  // dot on the Studio tab as an unread message.
  const pending = useStudentStudioStore((s) => s.corrections.filter((c) => c.status === 'pending' && c.teacherId === teacherId).length)
  return { inStudio: !!teacherId, unreadMessages, studioAttention: unreadMessages + pending }
}
