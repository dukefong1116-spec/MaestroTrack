import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Megaphone } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useMembers } from '@/hooks/useStudioData'
import MessageThread from '@/components/messages/MessageThread'
import AnnouncementSheet from '@/components/teacher/AnnouncementSheet'
import { ConversationList } from '@/components/teacher/layout/MessageDock'
import { useThreadData } from '@/hooks/useTeacherMessages'
import { StudioPage } from '@/components/teacher/studio/ui'

/**
 * Messages on a phone: the list of conversations, then one, full screen.
 * (A desktop has the dock instead, but this page works there too.)
 */
export default function MessagesPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const members = useMembers()
  const [params, setParams] = useSearchParams()
  const withId = params.get('with')
  const [announcing, setAnnouncing] = useState(false)
  const member = members.find((m) => m.uid === withId)
  const { thread, mine, recordings } = useThreadData(withId)

  if (withId && profile) {
    const name = member?.name ?? 'Student'
    return (
      <div className="-mx-3 -my-4 flex h-[calc(100dvh-76px)] flex-col sm:mx-0 lg:h-[calc(100dvh-40px)]" style={{ background: 'var(--clay-surface)' }}>
        <div className="flex shrink-0 items-center gap-2 px-2 py-2.5" style={{ borderBottom: '1px solid var(--clay-line)' }}>
          <button type="button" onClick={() => setParams({})} aria-label="All messages" className="flex h-10 w-10 items-center justify-center" style={{ color: 'var(--clay-accent-ink)' }}><ChevronLeft size={24} /></button>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-bold" style={{ color: 'var(--clay-ink)' }}>{name}</span>
            <span className="block text-[12px]" style={{ color: 'var(--clay-dim)' }}>On the app</span>
          </span>
          {member && <button type="button" onClick={() => navigate(`/teacher/students/${encodeURIComponent(member.id)}`)} className="rounded-[10px] px-3 py-1.5 text-[12.5px] font-semibold" style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}>Record</button>}
        </div>
        <div className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)]">
          <MessageThread full me="teacher" teacherId={profile.uid} studentId={withId} otherName={name.split(' ')[0]} messages={thread} recordings={recordings} assignments={mine}
            onOpenAssignment={(a) => navigate(`/teacher/review?open=${encodeURIComponent(a.id)}`)} canSend={member?.profile?.teacherId === profile.uid} />
        </div>
      </div>
    )
  }

  return (
    <StudioPage
      title="Messages"
      actions={<button type="button" onClick={() => setAnnouncing(true)} aria-label="Announcement to every student" className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}><Megaphone size={18} /></button>}
    >
      <ConversationList onOpen={(id) => setParams({ with: id })} />
      <AnnouncementSheet open={announcing} onClose={() => setAnnouncing(false)} />
    </StudioPage>
  )
}
