import { useEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Plus, Send, X } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import ConfirmSheet from '@/components/ui/ConfirmSheet'
import TakePlayer from '@/components/recordings/TakePlayer'
import Sticker from '@/components/stickers/Sticker'
import { sendMessage, deleteMessage } from '@/lib/firebase/messages'
import { recordingAudio, shareRecordings } from '@/lib/firebase/recordings'
import { takeLabel, takeNamesByDay } from '@/lib/utils/takeNames'
import { dueLabel, normaliseStatus } from '@/lib/utils/assignments'
import type { Assignment, Message, MessageAttachment, Recording } from '@/types'

/**
 * A conversation between a teacher and one student.
 *
 * The same component on both sides — the student's Studio page and the
 * teacher's page for that student — told which side it is on. A message
 * can carry a shared item, shown as a card the way a shared post shows in
 * a DM: a recording plays where it is, an assignment opens.
 *
 * Only what the viewer can already see can be shared or shown: their own
 * takes and assignments for a student; for a teacher, the assignments they
 * set and the takes this student has handed in. A student sharing a take
 * hands it in, so their teacher can play it.
 */

const STATUS: Record<string, string> = {
  active: 'To do', submitted: 'Handed in', returned: 'Another go', approved: 'Approved', completed: 'Approved',
}

export default function MessageThread({
  me, teacherId, studentId, otherName, messages, recordings, assignments, onOpenAssignment, canSend = true,
}: {
  me: 'teacher' | 'student'
  teacherId: string
  studentId: string
  /** Who is on the other end — shown in the empty state and on their messages. */
  otherName: string
  /** This conversation, oldest first. */
  messages: Message[]
  /** Takes the viewer may share and play. */
  recordings: Recording[]
  /** Assignments the viewer may share and open. */
  assignments: Assignment[]
  onOpenAssignment: (a: Assignment) => void
  /** False once a student has left: the history stays, the box goes. */
  canSend?: boolean
}) {
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState<MessageAttachment | null>(null)
  const [picking, setPicking] = useState<null | 'recording' | 'assignment'>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<Message | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const takeNames = useMemo(() => takeNamesByDay(recordings), [recordings])
  const nameOfTake = (r: Recording) => r.title?.trim() || takeNames.get(r.id) || takeLabel(r.date, 1)

  // Newest at the bottom, and kept in view as messages arrive.
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }) }, [messages.length])

  async function send() {
    const body = text.trim()
    if ((!body && !attachment) || sending) return
    setSending(true)
    setError('')
    try {
      // A take shared by its student is handed in, so the teacher can play it.
      if (me === 'student' && attachment?.kind === 'recording') {
        const r = recordings.find((x) => x.id === attachment.id)
        if (r && !r.sharedWithTeacher) await shareRecordings([r.id])
      }
      await sendMessage({
        teacherId, studentId, from: me, text: body,
        ...(attachment ? { attachment } : {}),
      })
      setText('')
      setAttachment(null)
    } catch (e) {
      console.error('[messages] send failed', e)
      setError('That message did not send. Try again.')
    } finally {
      setSending(false)
    }
  }

  function card(a: MessageAttachment) {
    if (a.kind === 'recording') {
      const r = recordings.find((x) => x.id === a.id)
      if (!r) return <Gone what="Recording" />
      return <TakePlayer key={r.id} load={() => recordingAudio(r)} label={nameOfTake(r)} storedDuration={r.duration} />
    }
    const as = assignments.find((x) => x.id === a.id)
    if (!as) return <Gone what="Assignment" />
    const due = dueLabel(as)
    return (
      <button
        type="button"
        onClick={() => onOpenAssignment(as)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
        style={{ background: 'var(--clay-surface)', border: '1px solid var(--clay-line)', borderRadius: 'var(--clay-r-sm)' }}
      >
        <Sticker name="clipboard" size={18} tone="accent" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold" style={{ color: 'var(--clay-ink)' }}>{as.title}</span>
          <span className="block text-[11.5px]" style={{ color: 'var(--clay-dim)' }}>
            {STATUS[normaliseStatus(as.status)] ?? 'Assignment'}{due ? ` · ${due}` : ''}
          </span>
        </span>
      </button>
    )
  }

  const shareable = picking === 'recording' ? recordings : picking === 'assignment' ? assignments : []

  return (
    <div>
      <div className="space-y-2.5">
        {messages.length === 0 && (
          <p className="py-6 text-center text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>
            {canSend ? `Say hi to ${otherName} 👋` : 'No messages.'}
          </p>
        )}
        {messages.map((m) => {
          const mine = m.from === me
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[85%]">
                <div
                  onClick={() => mine && setSelected((s) => (s === m.id ? null : m.id))}
                  className={`space-y-2 px-3.5 py-2.5 ${mine ? 'cursor-pointer' : ''}`}
                  style={{
                    background: mine ? 'var(--clay-accent-soft)' : 'var(--clay-bg-deep)',
                    color: 'var(--clay-ink)',
                    borderRadius: 16,
                    borderBottomRightRadius: mine ? 4 : 16,
                    borderBottomLeftRadius: mine ? 16 : 4,
                  }}
                >
                  {m.attachment && <div onClick={(e) => e.stopPropagation()}>{card(m.attachment)}</div>}
                  {m.text && <p className="whitespace-pre-wrap break-words text-[14px] leading-snug">{m.text}</p>}
                </div>
                <p className={`mt-1 px-1 text-[10.5px] ${mine ? 'text-right' : ''}`} style={{ color: 'var(--clay-faint)' }}>
                  {mine ? 'You' : otherName} · {format(parseISO(m.createdAt), 'MMM d, h:mm a')}
                  {mine && selected === m.id && (
                    <button
                      type="button"
                      onClick={() => setDeleting(m)}
                      className="ml-2 font-semibold"
                      style={{ color: 'var(--clay-danger)' }}
                    >
                      Delete
                    </button>
                  )}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {canSend && (
        <div className="mt-4">
          {attachment && (
            <div className="mb-2 flex items-start gap-2">
              <div className="min-w-0 flex-1">{card(attachment)}</div>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                aria-label="Remove"
                className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--clay-bg)', color: 'var(--clay-dim)' }}
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setPicking('recording')}
              aria-label="Share a recording or assignment"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}
            >
              <Plus size={18} />
            </button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
              rows={1}
              maxLength={2000}
              placeholder={`Message ${otherName}…`}
              className="max-h-32 min-h-[40px] flex-1 resize-none px-3.5 py-2.5 text-[14px] outline-none"
              style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)', borderRadius: 20 }}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || (!text.trim() && !attachment)}
              aria-label="Send"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
              style={{ background: 'var(--clay-accent)', color: 'var(--clay-on-accent)' }}
            >
              <Send size={16} />
            </button>
          </div>
          {error && <p className="mt-2 text-[12.5px]" style={{ color: 'var(--clay-danger)' }}>{error}</p>}
        </div>
      )}

      <Modal open={picking !== null} onClose={() => setPicking(null)} title="Share" size="sm">
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(['recording', 'assignment'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setPicking(k)}
              className="py-2 text-[13px] font-semibold"
              style={{
                borderRadius: 999,
                background: picking === k ? 'var(--clay-accent-soft)' : 'var(--clay-bg)',
                color: picking === k ? 'var(--clay-accent-ink)' : 'var(--clay-dim)',
              }}
            >
              {k === 'recording' ? 'Recordings' : 'Assignments'}
            </button>
          ))}
        </div>
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          {shareable.length === 0 && (
            <p className="py-6 text-center text-[13px]" style={{ color: 'var(--clay-dim)' }}>
              {picking === 'recording'
                ? (me === 'teacher' ? `${otherName} hasn't handed in any recordings yet.` : 'No recordings yet.')
                : 'No assignments yet.'}
            </p>
          )}
          {picking === 'recording' && [...recordings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((r) => (
            <PickRow
              key={r.id}
              title={nameOfTake(r)}
              detail={`${format(parseISO(r.date.substring(0, 10)), 'MMM d')}${r.pieceName && r.pieceName !== 'Practice session' ? ` · ${r.pieceName}` : ''}`}
              onPick={() => { setAttachment({ kind: 'recording', id: r.id }); setPicking(null) }}
            />
          ))}
          {picking === 'assignment' && [...assignments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((a) => (
            <PickRow
              key={a.id}
              title={a.title}
              detail={STATUS[normaliseStatus(a.status)] ?? ''}
              onPick={() => { setAttachment({ kind: 'assignment', id: a.id }); setPicking(null) }}
            />
          ))}
        </div>
        {me === 'student' && picking === 'recording' && recordings.length > 0 && (
          <p className="mt-3 text-[11.5px]" style={{ color: 'var(--clay-dim)' }}>
            Sharing a recording hands it in, so {otherName} can listen.
          </p>
        )}
      </Modal>

      <ConfirmSheet
        open={!!deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const m = deleting
          setDeleting(null)
          setSelected(null)
          if (m) void deleteMessage(m.id).catch(() => setError('That message could not be deleted.'))
        }}
        title="Delete this message?"
        body={`It's removed for ${otherName} too.`}
        confirmLabel="Delete"
      />
    </div>
  )
}

function PickRow({ title, detail, onPick }: { title: string; detail: string; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
      style={{ background: 'var(--clay-bg)', borderRadius: 'var(--clay-r-sm)' }}
    >
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-semibold" style={{ color: 'var(--clay-ink)' }}>{title}</span>
        {detail && <span className="block truncate text-[11.5px]" style={{ color: 'var(--clay-dim)' }}>{detail}</span>}
      </span>
      <span className="shrink-0 text-[12px] font-semibold" style={{ color: 'var(--clay-accent-ink)' }}>Share</span>
    </button>
  )
}

function Gone({ what }: { what: string }) {
  return (
    <p className="px-3 py-2.5 text-[12.5px] italic" style={{ color: 'var(--clay-dim)', background: 'var(--clay-bg)', borderRadius: 'var(--clay-r-sm)' }}>
      {what} no longer available
    </p>
  )
}
