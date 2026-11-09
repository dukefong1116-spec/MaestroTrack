import { useMemo } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import { Send } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAssignments } from '@/hooks/useAssignments'
import { useStudio } from '@/hooks/useStudio'
import { usePracticeStore } from '@/stores/practiceStore'
import AssignmentRow from '@/components/assignments/AssignmentRow'
import { nextOccurrence } from '@/lib/utils/notifications'
import { organise } from '@/lib/utils/assignmentGroups'

/**
 * A student's studio, at a glance: one panel, top to bottom — who it is,
 * the conversation with the teacher, and what is most pressing.
 *
 * The conversation shows its last few messages as a little chat, and
 * tapping it (or the box under it) opens the whole thing full-screen.
 * Assignments show the three most pressing; the full, organised list is
 * one tap away. Leaving the studio lives in Settings → Your studio, not
 * here: nobody needs to see it every day.
 *
 * The panel reaches the tab bar however little is in it, so the page never
 * ends in a band of empty background.
 */

const PREVIEW_MESSAGES = 3
const PREVIEW_ASSIGNMENTS = 3

export default function StudioPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { unreadMessages } = useStudio()
  const messages = usePracticeStore((s) => s.messages)
  const lessons = usePracticeStore((s) => s.lessons)
  const { all } = useAssignments()

  const teacherId = profile?.role === 'student' ? profile.teacherId : undefined
  const teacher = profile?.teacherName || 'your teacher'

  const thread = useMemo(
    () => (teacherId ? messages.filter((m) => m.teacherId === teacherId) : []),
    [messages, teacherId]
  )
  const mine = useMemo(() => all.filter((x) => x.assignment.teacherId === teacherId), [all, teacherId])
  // The same order as the full list: overdue, today (a daily target is
  // today's work), then soonest due. Work handed in or finished never
  // makes the top three.
  const top = useMemo(() => organise(mine, new Date()).mostPressing.slice(0, PREVIEW_ASSIGNMENTS), [mine])

  const next = useMemo(() => {
    const now = new Date()
    return lessons
      .map((slot) => ({ slot, when: nextOccurrence(slot, now) }))
      .sort((a, b) => a.when.getTime() - b.when.getTime())[0]
  }, [lessons])

  if (!profile) return null
  if (!teacherId) return <Navigate to="/student" replace />

  const recent = thread.slice(-PREVIEW_MESSAGES)
  const last = thread.at(-1)
  const initial = (profile.studioName || teacher).trim().charAt(0).toUpperCase()

  return (
    <div className="flex min-h-[calc(100dvh-8.5rem)] flex-col lg:min-h-[calc(100dvh-4rem)]">
      <h1 className="mb-4 text-[26px] font-bold" style={{ color: 'var(--clay-ink)' }}>Studio</h1>

      <div className="flex flex-1 flex-col overflow-hidden" style={{ background: 'var(--clay-surface)', borderRadius: 'var(--clay-r-md)' }}>
        {/* Who */}
        <div className="flex items-center gap-3 px-5 py-4">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[17px] font-bold"
            style={{ background: 'var(--clay-purple-bg)', color: 'var(--clay-purple-fg)' }}
          >
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[16px] font-bold" style={{ color: 'var(--clay-ink)' }}>{profile.studioName || 'Your studio'}</p>
            <p className="truncate text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>
              {profile.teacherName || 'Your teacher'}
              {next ? ` · Next lesson ${format(next.when, 'EEE h:mm a')}` : ''}
            </p>
          </div>
        </div>

        {/* The conversation, as a little chat */}
        <Link to="/student/studio/messages" className="block px-5 py-4" style={{ borderTop: '1px solid var(--clay-line)' }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10.5px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
              Messages
            </span>
            <span className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--clay-faint)' }}>
              {last && formatDistanceToNowStrict(parseISO(last.createdAt), { addSuffix: true })}
              {unreadMessages > 0 && <span className="h-2 w-2 rounded-full" style={{ background: 'var(--clay-accent)' }} />}
            </span>
          </div>
          {recent.length === 0 ? (
            <p className="py-2 text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>Say hi to {teacher} 👋</p>
          ) : (
            <div className="space-y-1.5">
              {recent.map((m) => {
                const fromMe = m.from === 'student'
                const words = m.text || (m.attachment?.kind === 'recording' ? '🎙️ Shared a recording' : '📋 Shared an assignment')
                return (
                  <div key={m.id} className={`flex ${fromMe ? 'justify-end' : 'justify-start'}`}>
                    <p
                      className="max-w-[80%] truncate px-3 py-1.5 text-[13px]"
                      style={{
                        background: fromMe ? 'var(--clay-accent-soft)' : 'var(--clay-bg-deep)',
                        color: 'var(--clay-ink)',
                        borderRadius: 14,
                        borderBottomRightRadius: fromMe ? 4 : 14,
                        borderBottomLeftRadius: fromMe ? 14 : 4,
                      }}
                    >
                      {m.attachment && m.text ? (m.attachment.kind === 'recording' ? '🎙️ ' : '📋 ') : ''}{words}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
          <span
            className="mt-3 flex h-10 items-center justify-between px-4 text-[13px]"
            style={{ background: 'var(--clay-bg)', color: 'var(--clay-faint)', borderRadius: 20 }}
          >
            Message {teacher}…
            <Send size={15} style={{ color: 'var(--clay-accent)' }} />
          </span>
        </Link>

        {/* What is most pressing; the rest one tap away. Grows to fill. */}
        <div className="flex-1 px-5 pb-2 pt-4" style={{ borderTop: '1px solid var(--clay-line)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
              Assignments
            </span>
            {mine.length > 0 && (
              <Link to="/student/studio/assignments" className="text-[12.5px] font-semibold" style={{ color: 'var(--clay-accent-ink)' }}>
                See all ({mine.length}) ›
              </Link>
            )}
          </div>
          {top.length === 0 ? (
            <p className="py-4 text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>
              {mine.length ? 'All caught up ✨' : `Nothing set yet. ${teacher} will add assignments here.`}
            </p>
          ) : (
            <div className="mt-1">
              {top.map((x, i) => (
                <div key={x.assignment.id} style={i ? { borderTop: '1px solid var(--clay-line)' } : undefined}>
                  <AssignmentRow
                    item={x}
                    onOpen={() => navigate(`/student/studio/assignments?open=${encodeURIComponent(x.assignment.id)}`)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
