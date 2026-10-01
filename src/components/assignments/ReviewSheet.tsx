import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Textarea from '@/components/ui/Textarea'
import Sticker from '@/components/stickers/Sticker'
import TakePlayer from '@/components/recordings/TakePlayer'
import { reviewAssignment } from '@/lib/firebase/assignments'
import { latestSubmission } from '@/lib/utils/assignments'
import type { Assignment, Recording } from '@/types'

/**
 * A teacher's response to handed-in work.
 *
 * Two outcomes, both ending the wait: approve it, or hand it back with a
 * note. Returning without a note is allowed but discouraged by the copy —
 * "do it again" with no reason is the least useful thing a teacher can say.
 */
export default function ReviewSheet({
  assignment, studentName, recordings, open, onClose,
}: {
  assignment: Assignment | null
  studentName: string
  /** Recordings belonging to the submitting student. */
  recordings: Recording[]
  open: boolean
  onClose: () => void
}) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState<'approved' | 'returned' | null>(null)
  const [error, setError] = useState('')

  if (!open || !assignment) return null

  const submission = latestSubmission(assignment)
  const attached = (submission?.recordingIds ?? [])
    .map((id) => recordings.find((r) => r.id === id))
    .filter((r): r is Recording => !!r)

  async function respond(verdict: 'approved' | 'returned') {
    if (!assignment) return
    setSaving(verdict)
    setError('')
    try {
      await reviewAssignment(assignment.id, verdict, note.trim() || undefined)
      setNote('')
      onClose()
    } catch {
      setError('Could not save your response. Check your connection and try again.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <Modal open onClose={onClose} title={assignment.title}>
      <div style={{ fontFamily: 'var(--clay-font)', color: 'var(--clay-ink)' }}>

        <p className="text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>
          {studentName}
          {submission && ` · handed in ${format(parseISO(submission.at), 'MMM d')}`}
        </p>

        {assignment.description && (
          <p className="mt-3 text-[13px]" style={{ color: 'var(--clay-dim)' }}>{assignment.description}</p>
        )}

        {submission?.minutesAtSubmission != null && (
          <p className="mt-3 flex items-center gap-1.5 text-[12.5px]" style={{ color: 'var(--clay-ink)' }}>
            <Sticker name="clock" size={14} tone="accent" />
            {submission.minutesAtSubmission} minutes logged
            {assignment.targetMinutes ? ` of ${assignment.targetMinutes}` : ''}
          </p>
        )}

        {submission?.note && (
          <>
            <p className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
              What they said
            </p>
            <div className="px-3.5 py-3" style={{ background: 'var(--clay-bg)', borderRadius: 'var(--clay-r-sm)' }}>
              <p style={{ fontFamily: 'var(--clay-hand)', fontSize: 18, lineHeight: '25px' }}>{submission.note}</p>
            </div>
          </>
        )}

        {attached.length > 0 && (
          <>
            <p className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
              Recordings ({attached.length})
            </p>
            <div className="space-y-2.5">
              {attached.map((r, i) => (
                <TakePlayer key={r.id} src={r.audioUrl} label={`Take ${i + 1}`} storedDuration={r.duration} />
              ))}
            </div>
          </>
        )}

        <p className="mb-1.5 mt-5 text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
          Your feedback
        </p>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What to keep, what to work on next…"
          rows={3}
        />

        {error && (
          <p className="mt-3 rounded-2xl px-3.5 py-2.5 text-[12.5px]"
             style={{ background: '#FFE8EA', color: 'var(--clay-danger)' }}>
            {error}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button onClick={() => respond('approved')} loading={saving === 'approved'}>
            Approve
          </Button>
          <Button variant="secondary" onClick={() => respond('returned')} loading={saving === 'returned'}>
            Another go
          </Button>
        </div>
      </div>
    </Modal>
  )
}
