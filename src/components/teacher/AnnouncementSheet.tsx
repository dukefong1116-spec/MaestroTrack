import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { useAuth } from '@/hooks/useAuth'
import { useMembers } from '@/hooks/useStudioData'
import { useTeacherStore } from '@/stores/teacherStore'
import { sendMessage } from '@/lib/firebase/messages'
import { Btn } from '@/components/teacher/studio/ui'
import { inputStyle } from '@/components/teacher/studio/tokens'

/**
 * One note to everybody: a message in each student's conversation, and
 * an email (from your own mail app) to the families of students who are
 * not on the app — the app has no way of emailing for you yet.
 */
export default function AnnouncementSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth()
  const members = useMembers()
  const families = useTeacherStore((s) => s.families)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')

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
      await Promise.all(onApp.map((m) => sendMessage({ teacherId: profile.uid, studentId: m.uid as string, from: 'teacher', text: text.trim() })))
      setDone(`Sent to ${onApp.length} student${onApp.length === 1 ? '' : 's'} on the app.`)
    } catch {
      setDone('Some messages could not be sent. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const mailto = `mailto:?bcc=${encodeURIComponent(emails.join(','))}&subject=${encodeURIComponent(`From ${profile?.studioName || profile?.displayName || 'your teacher'}`)}&body=${encodeURIComponent(text)}`

  return (
    <Modal open={open} onClose={() => { setText(''); setDone(''); onClose() }} title="Announcement to everyone">
      <p className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>
        Students on the app get it in Messages. Families of students who aren’t get it by email, from your own mail app.
      </p>
      <textarea
        aria-label="Announcement"
        rows={5}
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
        <Btn kind="primary" onClick={send} disabled={busy || !text.trim() || onApp.length === 0}>
          {busy ? 'Sending…' : `Send to ${onApp.length} on the app`}
        </Btn>
      </div>
    </Modal>
  )
}
