import { useEffect, useState } from 'react'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import Modal from '@/components/ui/Modal'
import { useAuth } from '@/hooks/useAuth'
import { useMembers } from '@/hooks/useStudioData'
import { useTeacherStore } from '@/stores/teacherStore'
import { postAnnouncement, deleteAnnouncement, subscribeTeacherAnnouncements, ANNOUNCEMENT_MAX } from '@/lib/firebase/announcements'
import type { Announcement } from '@/types'
import { Btn } from '@/components/teacher/studio/ui'
import { inputStyle } from '@/components/teacher/studio/tokens'

/**
 * One note to everybody. Students on the app see it at the top of their
 * Studio page (with a dot on the Studio tab) until they dismiss it; the
 * families of students who are not on the app get it by email, from your
 * own mail app — the app has no way of emailing for you yet. Earlier
 * announcements are listed underneath, each one yours to take down.
 */
export default function AnnouncementSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth()
  const members = useMembers()
  const families = useTeacherStore((s) => s.families)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const [posted, setPosted] = useState<Announcement[]>([])
  useEffect(() => (open && profile?.uid ? subscribeTeacherAnnouncements(profile.uid, setPosted) : undefined), [open, profile?.uid])

  const onApp = members.filter((m) => m.onApp && m.profile?.teacherId === profile?.uid)
  const offline = members.filter((m) => !m.onApp)
  const emails = [...new Set(offline.flatMap((m) => {
    const fam = families.find((f) => f.id === m.roster.familyId)
    return [m.roster.email, ...(fam?.contacts ?? []).map((c) => c.email)].filter((e): e is string => !!e)
  }))]

  async function send() {
    if (!profile || !text.trim()) return
    setBusy(true)
    try {
      await postAnnouncement(profile.uid, text)
      setDone(`Posted. ${onApp.length} student${onApp.length === 1 ? '' : 's'} on the app will see it on their Studio page.`)
      setText('')
    } catch {
      setDone('Could not post it. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const mailto = `mailto:?bcc=${encodeURIComponent(emails.join(','))}&subject=${encodeURIComponent(`From ${profile?.studioName || profile?.displayName || 'your teacher'}`)}&body=${encodeURIComponent(text)}`

  return (
    <Modal open={open} onClose={() => { setText(''); setDone(''); onClose() }} title="Announcement to everyone">
      <p className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>
        Students on the app see it at the top of their Studio page until they dismiss it. Families of students who aren’t get it by email, from your own mail app.
      </p>
      <textarea
        aria-label="Announcement"
        rows={5}
        maxLength={ANNOUNCEMENT_MAX}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Winter recital is Saturday, December 5 at 2 PM. Please arrive by 1:30."
        className="mt-3 w-full rounded-xl border-0 p-3 text-[14px] outline-none"
        style={inputStyle}
      />
      {done && <p className="mt-2 text-[13px] font-semibold" style={{ color: 'var(--clay-success-fg)' }}>{done}</p>}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {emails.length > 0 && (
          <a href={mailto} className="inline-flex min-h-[36px] items-center rounded-[10px] px-3.5 text-[13.5px] font-semibold" style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}>
            Email {emails.length} famil{emails.length === 1 ? 'y' : 'ies'}
          </a>
        )}
        <Btn kind="primary" onClick={send} disabled={busy || !text.trim()}>
          {busy ? 'Posting…' : 'Post to the studio'}
        </Btn>
      </div>
      {posted.length > 0 && (
        <div className="mt-5" style={{ borderTop: '1px solid var(--clay-line)' }}>
          <p className="pb-1 pt-3 text-[12.5px] font-semibold" style={{ color: 'var(--clay-dim)' }}>Posted</p>
          {posted.slice(0, 10).map((a) => (
            <div key={a.id} className="flex items-start gap-3 py-2" style={{ borderTop: '1px solid var(--clay-line)' }}>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 whitespace-pre-wrap text-[13.5px]" style={{ color: 'var(--clay-ink)' }}>{a.text}</p>
                <p className="text-[11.5px]" style={{ color: 'var(--clay-dim)' }}>{formatDistanceToNowStrict(parseISO(a.createdAt), { addSuffix: true })}</p>
              </div>
              <Btn kind="link" onClick={() => void deleteAnnouncement(a.id).catch(() => setDone('Could not take it down. Try again.'))}>Take down</Btn>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
