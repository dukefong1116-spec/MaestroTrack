import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import PageHeader from '@/components/common/PageHeader'
import { Panel, Block, Legend } from '@/components/ui/Panel'
import Button from '@/components/ui/Button'
import ConfirmSheet from '@/components/ui/ConfirmSheet'
import Sticker from '@/components/stickers/Sticker'
import MessageThread from '@/components/messages/MessageThread'
import AssignmentsPanel from './panels/AssignmentsPanel'
import { useAuth } from '@/hooks/useAuth'
import { useAssignments } from '@/hooks/useAssignments'
import { usePracticeStore } from '@/stores/practiceStore'
import { useAuthStore } from '@/stores/authStore'
import { leaveStudio } from '@/lib/firebase/requests'
import { updateUserProfile } from '@/lib/firebase/teacher'
import { nextOccurrence } from '@/lib/utils/notifications'

/**
 * A student's studio: what their teacher has set them, their conversation
 * with their teacher, and their next lesson.
 *
 * Only for a student in a studio — a solo musician has no teacher, so has
 * no such page, and is sent to Today. Assignments live here rather than in
 * the Library for the same reason.
 */
export default function StudioPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [, setParams] = useSearchParams()
  const messages = usePracticeStore((s) => s.messages)
  const recordings = usePracticeStore((s) => s.recordings)
  const lessons = usePracticeStore((s) => s.lessons)
  const { all } = useAssignments()
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState('')

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

  // Opening the conversation reads it. Written only when something newer
  // than the last read has arrived, not on every render.
  const latestFromTeacher = thread.filter((m) => m.from === 'teacher').at(-1)?.createdAt ?? ''
  const readAt = profile?.messagesReadAt ?? ''
  useEffect(() => {
    if (!uid || !latestFromTeacher || latestFromTeacher <= readAt) return
    const at = new Date().toISOString()
    const live = useAuthStore.getState().profile
    if (live) useAuthStore.getState().setProfile({ ...live, messagesReadAt: at })
    void updateUserProfile(uid, { messagesReadAt: at }).catch(() => {})
  }, [uid, latestFromTeacher, readAt])

  const next = useMemo(() => {
    const now = new Date()
    return lessons
      .map((slot) => ({ slot, when: nextOccurrence(slot, now) }))
      .sort((a, b) => a.when.getTime() - b.when.getTime())[0]
  }, [lessons])

  if (!profile) return null
  if (!teacherId) return <Navigate to="/student" replace />

  async function leave() {
    if (!uid) return
    setLeaving(false)
    try {
      await leaveStudio(uid)
      navigate('/student', { replace: true })
    } catch (e) {
      console.error('[Studio] leave failed', e)
      setLeaveError('Could not leave the studio. Try again.')
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title={profile.studioName || 'Your studio'} subtitle={`Taught by ${teacher}`} />

      <Panel>
        <Block first>
          <Legend title="Assignments" />
        </Block>
        <AssignmentsPanel />
      </Panel>

      <Panel>
        <Block first>
          <Legend title={`Messages with ${teacher}`} />
          <MessageThread
            me="student"
            teacherId={teacherId}
            studentId={profile.uid}
            otherName={teacher}
            messages={thread}
            recordings={recordings}
            assignments={mine}
            onOpenAssignment={(a) => setParams({ open: a.id })}
          />
        </Block>
      </Panel>

      <Panel>
        <Block first>
          <Legend title="Next lesson" />
          {next ? (
            <div className="flex items-center gap-3">
              <Sticker name="calendar" size={22} tone="accent" />
              <p className="text-[15px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
                {format(next.when, 'EEE, MMM d')} · {format(next.when, 'h:mm a')}
                <span className="font-normal" style={{ color: 'var(--clay-dim)' }}> · {next.slot.durationMinutes} min</span>
              </p>
            </div>
          ) : (
            <p className="text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>No lesson scheduled yet.</p>
          )}
        </Block>
        <Block>
          <Button variant="outline" size="sm" onClick={() => setLeaving(true)}>Leave this studio</Button>
          {leaveError && <p className="mt-2 text-[12.5px]" style={{ color: 'var(--clay-danger)' }}>{leaveError}</p>}
        </Block>
      </Panel>

      <ConfirmSheet
        open={leaving}
        onCancel={() => setLeaving(false)}
        onConfirm={leave}
        title="Leave this studio?"
        body={`${profile.teacherName || 'Your teacher'} will no longer see your practice. You can be invited back later.`}
        confirmLabel="Leave"
      />
    </div>
  )
}
