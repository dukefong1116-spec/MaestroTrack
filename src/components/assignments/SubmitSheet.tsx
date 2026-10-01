import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Textarea from '@/components/ui/Textarea'
import TakePicker from './TakePicker'
import { submitAssignment } from '@/lib/firebase/assignments'
import { deriveProgress, latestFeedback } from '@/lib/utils/assignments'
import { usePracticeStore } from '@/stores/practiceStore'
import type { Assignment } from '@/types'

/**
 * Handing work in.
 *
 * A recording is optional on purpose. Requiring audio would make scales,
 * sight-reading and theory unassignable, and turns the feature into
 * surveillance rather than a conversation — a note saying "the coda is
 * still uneven" is often worth more to a teacher than another take.
 */
export default function SubmitSheet({
  assignment, open, onClose,
}: {
  assignment: Assignment | null
  open: boolean
  onClose: () => void
}) {
  const sessions = usePracticeStore((s) => s.sessions)
  const [note, setNote] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!open || !assignment) return null

  const progress = deriveProgress(assignment, sessions)
  const returned = latestFeedback(assignment)

  async function handSubmit() {
    if (!assignment) return
    setSaving(true)
    setError('')
    try {
      await submitAssignment(assignment.id, {
        note: note.trim() || undefined,
        recordingIds: picked.length ? picked : undefined,
        minutesAtSubmission: progress.tracked ? progress.minutesDone : undefined,
      })
      setNote('')
      setPicked([])
      onClose()
    } catch {
      setError('Could not hand this in. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={assignment.title}>
      <div style={{ fontFamily: 'var(--clay-font)', color: 'var(--clay-ink)' }}>

        {/* What the teacher said last time, if this is a second attempt. */}
        {returned?.verdict === 'returned' && returned.note && (
          <div className="mb-4 px-3.5 py-3" style={{ background: '#FFF1D6', borderRadius: 'var(--clay-r-sm)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: '#B37A18' }}>
              Your teacher asked for another go
            </p>
            <p className="mt-1 text-[13px]" style={{ color: 'var(--clay-ink)' }}>{returned.note}</p>
          </div>
        )}

        {progress.tracked && (
          <div className="mb-4">
            <div className="mb-1.5 flex items-baseline justify-between text-[11px]">
              <span className="font-semibold uppercase tracking-[.1em]" style={{ color: 'var(--clay-dim)' }}>
                Practice logged
              </span>
              <span className="tabular-nums" style={{ color: 'var(--clay-dim)' }}>
                {progress.minutesDone} / {assignment.targetMinutes} min
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--clay-bg-deep)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${progress.percent ?? 0}%`, background: 'var(--clay-accent)' }}
              />
            </div>
          </div>
        )}

        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
          Anything to say about it?
        </p>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional — what went well, what you're still fighting with…"
          rows={3}
        />

        <p className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
          Add a recording {picked.length > 0 && `(${picked.length})`}
        </p>
        <TakePicker selected={picked} onChange={setPicked} />

        {error && (
          <p className="mt-3 rounded-2xl px-3.5 py-2.5 text-[12.5px]"
             style={{ background: '#FFE8EA', color: 'var(--clay-danger)' }}>
            {error}
          </p>
        )}

        <Button onClick={handSubmit} loading={saving} className="mt-5 w-full">
          Hand it in
        </Button>
        <p className="mt-2 text-center text-[11px]" style={{ color: 'var(--clay-faint)' }}>
          Your teacher will see this and can ask for another go.
        </p>
      </div>
    </Modal>
  )
}
