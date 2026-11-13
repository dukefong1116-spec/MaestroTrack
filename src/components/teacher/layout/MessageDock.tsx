import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Megaphone, MessageCircle, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { useMembers, type Member } from '@/hooks/useStudioData'
import { useDock, useThreadData, useUnreadThreads } from '@/hooks/useTeacherMessages'
import MessageThread from '@/components/messages/MessageThread'
import { Avatar } from '@/components/teacher/studio/ui'
import { colorFor } from '@/components/teacher/studio/tokens'
import AnnouncementSheet from '@/components/teacher/AnnouncementSheet'

/**
 * Messages, docked bottom-right on a desktop: a list of every student,
 * then one conversation, without leaving the page you are on. A student
 * not on the app has no conversation here — their family is written to
 * by email instead.
 */
export default function MessageDock() {
  const { open, studentId, show, close, back } = useDock()
  const unread = useUnreadThreads()
  const [announcing, setAnnouncing] = useState(false)

  return (
    <div className="hidden lg:block">
      {!open ? (
        <button
          type="button"
          onClick={() => show(null)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-full py-2 pl-2 pr-5 transition-transform active:scale-95"
          style={{ background: 'var(--clay-surface)', border: '1px solid var(--clay-line)', boxShadow: '0 14px 30px -10px rgba(58,48,84,.35)', color: 'var(--clay-ink)' }}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: 'var(--clay-accent)' }}>
            <MessageCircle size={16} aria-hidden="true" />
          </span>
          <span className="text-[15px] font-bold">Messages</span>
          {unread.size > 0 && (
            <span className="rounded-full px-2 py-0.5 text-[12px] font-bold text-white" style={{ background: 'var(--clay-accent-ink)' }}>{unread.size}</span>
          )}
        </button>
      ) : (
        <section
          aria-label="Messages"
          className="fixed bottom-6 right-6 z-40 flex h-[560px] max-h-[calc(100dvh-48px)] w-[380px] flex-col overflow-hidden"
          style={{ background: 'var(--clay-surface)', border: '1px solid var(--clay-line)', borderRadius: 18, boxShadow: '0 24px 60px -16px rgba(58,48,84,.45)' }}
        >
          {studentId
            ? <DockThread studentId={studentId} onBack={back} onClose={close} />
            : <DockList onOpen={(id) => show(id)} onClose={close} onAnnounce={() => setAnnouncing(true)} />}
        </section>
      )}
      <AnnouncementSheet open={announcing} onClose={() => setAnnouncing(false)} />
    </div>
  )
}

export function ConversationList({ onOpen }: { onOpen: (studentId: string) => void }) {
  const members = useMembers()
  const messages = useTeacherStore((s) => s.messages)
  const unread = useUnreadThreads()
  const rows = useMemo(() => {
    const last = new Map<string, (typeof messages)[number]>()
    for (const m of messages) last.set(m.studentId, m)
    return members
      .filter((m) => m.onApp)
      .map((m) => ({ m, last: last.get(m.uid as string), unread: unread.has(m.uid as string) }))
      .sort((a, b) => Number(b.unread) - Number(a.unread) || (b.last?.createdAt ?? '').localeCompare(a.last?.createdAt ?? '') || a.m.name.localeCompare(b.m.name))
  }, [members, messages, unread])
  const offline = members.filter((m) => !m.onApp)

  return (
    <div className="flex-1 overflow-y-auto">
      {rows.map(({ m, last, unread: isNew }) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onOpen(m.uid as string)}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--clay-bg)]"
        >
          <Avatar name={m.name} color={colorFor(m.id)} size={44} />
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px]" style={{ color: 'var(--clay-ink)', fontWeight: isNew ? 800 : 600 }}>{m.name}</span>
            <span className="block truncate text-[13px]" style={{ color: 'var(--clay-dim)' }}>
              {last ? `${last.from === 'teacher' ? 'You: ' : ''}${last.text || (last.attachment ? 'Shared an item' : '')}` : 'Say hello'}
            </span>
          </span>
          {isNew && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: 'var(--clay-accent)' }} aria-label="Unread" />}
        </button>
      ))}
      {rows.length === 0 && (
        <p className="px-4 py-6 text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>
          Conversations appear here once a student joins your studio on the app.
        </p>
      )}
      {offline.length > 0 && (
        <p className="px-4 pb-4 pt-2 text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>
          Not on the app: {offline.map((m) => m.name).join(', ')} — write to their family from their record.
        </p>
      )}
    </div>
  )
}

function DockList({ onOpen, onClose, onAnnounce }: { onOpen: (id: string) => void; onClose: () => void; onAnnounce: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2 py-3 pl-4 pr-3" style={{ borderBottom: '1px solid var(--clay-line)' }}>
        <h2 className="flex-1 text-[18px] font-bold" style={{ color: 'var(--clay-ink)' }}>Messages</h2>
        <button type="button" onClick={onAnnounce} aria-label="Announcement to every student" title="Announcement to everyone" className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}>
          <Megaphone size={17} aria-hidden="true" />
        </button>
        <button type="button" onClick={onClose} aria-label="Close messages" className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}>
          <X size={17} aria-hidden="true" />
        </button>
      </div>
      <ConversationList onOpen={onOpen} />
    </>
  )
}

function DockThread({ studentId, onBack, onClose }: { studentId: string; onBack: () => void; onClose: () => void }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const members = useMembers()
  const member: Member | undefined = members.find((m) => m.uid === studentId)
  const { thread, mine, recordings } = useThreadData(studentId)
  const name = member?.name ?? 'Student'

  return (
    <>
      <div className="flex items-center gap-2.5 py-2.5 pl-2 pr-3" style={{ borderBottom: '1px solid var(--clay-line)' }}>
        <button type="button" onClick={onBack} aria-label="All messages" className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ color: 'var(--clay-ink)' }}>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <Avatar name={name} color={colorFor(member?.id ?? studentId)} size={34} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold" style={{ color: 'var(--clay-ink)' }}>{name}</span>
          <span className="block text-[12px]" style={{ color: 'var(--clay-dim)' }}>{member?.instrument ?? ''} · on the app</span>
        </span>
        {member && (
          <button type="button" onClick={() => navigate(`/teacher/students/${member.id}`)} className="rounded-[10px] px-2.5 py-1.5 text-[12px] font-semibold" style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}>
            Record
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Close messages" className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}>
          <X size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col pb-3">
        {profile && (
          <MessageThread
            me="teacher"
            teacherId={profile.uid}
            studentId={studentId}
            otherName={name.split(' ')[0]}
            messages={thread}
            recordings={recordings}
            assignments={mine}
            onOpenAssignment={() => navigate(`/teacher/review`)}
            canSend={member?.profile?.teacherId === profile.uid}
            full
          />
        )}
      </div>
    </>
  )
}
