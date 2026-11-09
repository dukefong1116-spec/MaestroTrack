import { useEffect, useMemo } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import MessageThread from '@/components/messages/MessageThread'
import SubmitSheet from '@/components/assignments/SubmitSheet'
import { useAuth } from '@/hooks/useAuth'
import { useAssignments } from '@/hooks/useAssignments'
import { usePracticeStore } from '@/stores/practiceStore'
import { useAuthStore } from '@/stores/authStore'
import { updateUserProfile } from '@/lib/firebase/teacher'

/**
 * The conversation with the teacher, full-screen: a back arrow and who it
 * is at the top, the messages filling the screen, the box at the bottom —
 * the shape of any messaging app.
 *
 * Opening it reads it. Written only when something newer than the last
 * read has arrived, not on every render.
 */
export default function StudioMessagesPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const messages = usePracticeStore((s) => s.messages)
  const recordings = usePracticeStore((s) => s.recordings)
  const { all } = useAssignments()

  const uid = profile?.uid
  const teacherId = profile?.role === 'student' ? profile.teacherId : undefined
  const teacher = profile?.teacherName || 'your teacher'

  const thread = useMemo(
    () => (teacherId ? messages.filter((m) => m.teacherId === teacherId) : []),
    [messages, teacherId]
  )
  const mine = useMemo(
    () => all.map((x) => x.assignment).filter((a) => a.teacherId === teacherId),
    [all, teacherId]
  )
  const opened = mine.find((a) => a.id === params.get('open')) ?? null

  const latestFromTeacher = thread.filter((m) => m.from === 'teacher').at(-1)?.createdAt ?? ''
  const readAt = profile?.messagesReadAt ?? ''
  useEffect(() => {
    if (!uid || !latestFromTeacher || latestFromTeacher <= readAt) return
    const at = new Date().toISOString()
    const live = useAuthStore.getState().profile
    if (live) useAuthStore.getState().setProfile({ ...live, messagesReadAt: at })
    void updateUserProfile(uid, { messagesReadAt: at }).catch(() => {})
  }, [uid, latestFromTeacher, readAt])

  if (!profile) return null
  if (!teacherId) return <Navigate to="/student" replace />

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col"
      style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)', fontFamily: 'var(--clay-font)' }}
    >
      <div
        className="flex shrink-0 items-center gap-3 px-3 pb-3"
        style={{
          background: 'var(--clay-surface)',
          borderBottom: '1px solid var(--clay-line)',
          paddingTop: 'calc(12px + env(safe-area-inset-top))',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/student/studio')}
          aria-label="Back to Studio"
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: 'var(--clay-bg)' }}
        >
          <ChevronLeft size={19} />
        </button>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-bold"
          style={{ background: 'var(--clay-purple-bg)', color: 'var(--clay-purple-fg)' }}
        >
          {teacher.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold">{profile.teacherName || 'Your teacher'}</p>
          <p className="truncate text-[11.5px]" style={{ color: 'var(--clay-dim)' }}>{profile.studioName}</p>
        </div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
        <MessageThread
          full
          me="student"
          teacherId={teacherId}
          studentId={profile.uid}
          otherName={teacher}
          messages={thread}
          recordings={recordings}
          assignments={mine}
          onOpenAssignment={(a) => setParams({ open: a.id })}
        />
      </div>

      <SubmitSheet assignment={opened} open={!!opened} onClose={() => setParams({}, { replace: true })} />
    </div>
  )
}
