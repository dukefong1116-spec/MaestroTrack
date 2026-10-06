import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Textarea from '@/components/ui/Textarea'
import TakePicker from './TakePicker'
import AssignmentRecorder from './AssignmentRecorder'
import { submitAssignment } from '@/lib/firebase/assignments'
import { shareRecordings } from '@/lib/firebase/recordings'
import SubmitMoment from '@/components/celebration/SubmitMoment'
import { primeAudioContext } from '@/lib/utils/sound'
import {
  deriveProgress, deriveDailyProgress, latestFeedback, awaitingStudent, normaliseStatus, dueLabel,
} from '@/lib/utils/assignments'
import DailyStrip from './DailyStrip'
import { usePracticeStore } from '@/stores/practiceStore'
import type { Assignment } from '@/types'

/**
 * One assignment in full: the brief, how it has gone so far, and the form
 * to hand it in.
 *
 * Opening it is the whole point — a card you can only act on tells you
 * nothing about why it came back, or what you said last time.
 *
 * A recording is optional unless the teacher asked for one. Requiring
 * audio by default would make scales, sight-reading and theory awkward to
 * set and turn the feature into surveillance; a note saying the coda is
 * still uneven is often worth more than another take. So it is the
 * teacher's call, per assignment.
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
  /** Held open after a successful submit so the moment can play. */
  const [celebrating, setCelebrating] = useState<{ title: string; hadRecording: boolean } | null>(null)

  if (!open || !assignment) return null

  const progress = deriveProgress(assignment, sessions)
  const daily = deriveDailyProgress(assignment, sessions)
  // A daily-practice assignment is handed in once the practice is done —
  // the app has already seen it, so there is nothing to argue about.
  const dailyLocked = daily.tracked && !daily.targetMet
  const returned = latestFeedback(assignment)
  const canSubmit = awaitingStudent(assignment)
  const state = normaliseStatus(assignment.status)
  const needsTake = assignment.requiresRecording === true
  const missingTake = needsTake && picked.length === 0

  // Submissions and feedback interleaved, so the back-and-forth reads in
  // the order it actually happened.
  const history = [
    ...(assignment.submissions ?? []).map((x) => ({ at: x.at, kind: 'submitted' as const, note: x.note })),
    ...(assignment.feedback ?? []).map((x) => ({ at: x.at, kind: x.verdict, note: x.note })),
  ].sort((a, b) => a.at.localeCompare(b.at))

  async function handSubmit() {
    if (!assignment) return
    // First line of the handler, before any await: Safari only honours
    // resume() synchronously inside the gesture, and the chime below plays
    // after a network round trip when that window is long gone.
    primeAudioContext()
    setSaving(true)
    setError('')
    try {
      if (needsTake && picked.length === 0) {
        setError('Your teacher asked for a recording with this one.')
        setSaving(false)
        return
      }
      // Attached takes become readable by the teacher at this point, and
      // only these ones — everything else recorded stays private.
      if (picked.length) await shareRecordings(picked)
      await submitAssignment(assignment.id, {
        note: note.trim() || undefined,
        recordingIds: picked.length ? picked : undefined,
        minutesAtSubmission: progress.tracked ? progress.minutesDone : undefined,
      })
      const hadRecording = picked.length > 0
      const title = assignment.title
      setNote('')
      setPicked([])
      // The sheet stays mounted until the moment finishes — closing first
      // would unmount the celebration before it had played.
      setCelebrating({ title, hadRecording })
    } catch {
      setError('Could not hand this in. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  if (celebrating) {
    return (
      <SubmitMoment
        open
        title={celebrating.title}
        hadRecording={celebrating.hadRecording}
        onDismiss={() => { setCelebrating(null); onClose() }}
      />
    )
  }

  return (
    <Modal open onClose={onClose} title={assignment.title}>
      <div style={{ fontFamily: 'var(--clay-font)', color: 'var(--clay-ink)' }}>

        {assignment.description && (
          <p className="mb-3 text-[13px]" style={{ color: 'var(--clay-dim)' }}>{assignment.description}</p>
        )}
        {assignment.dueDate && (
          <p className="mb-4 text-[12px] font-semibold" style={{ color: 'var(--clay-dim)' }}>
            {dueLabel(assignment)}
          </p>
        )}

        {/* What the teacher said last time, if this is a second attempt. */}
        {returned?.verdict === 'returned' && returned.note && (
          <div className="mb-4 px-3.5 py-3" style={{ background: '#FFF1D6', borderRadius: 'var(--clay-r-sm)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: '#B37A18' }}>
              Your teacher asked for another go
            </p>
            <p className="mt-1 text-[13px]" style={{ color: 'var(--clay-ink)' }}>{returned.note}</p>
          </div>
        )}

        {daily.tracked && (
          <div className="mb-4">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.1em]" style={{ color: 'var(--clay-dim)' }}>
              {assignment.dailyTargetMinutes} min a day
            </p>
            <DailyStrip progress={daily} dailyTarget={assignment.dailyTargetMinutes ?? 0} />
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

        {history.length > 0 && (
          <>
            <p className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
              History
            </p>
            <div className="mb-4 space-y-2">
              {history.map((h, i) => (
                <div key={i} className="px-3 py-2" style={{ background: 'var(--clay-bg)', borderRadius: 'var(--clay-r-sm)' }}>
                  <p className="text-[10.5px] font-semibold uppercase tracking-[.08em]"
                     style={{ color: h.kind === 'approved' ? '#2E8B62' : h.kind === 'returned' ? '#B37A18' : 'var(--clay-dim)' }}>
                    {h.kind === 'submitted' ? 'You handed it in' : h.kind === 'approved' ? 'Approved' : 'Sent back'}
                    {' · '}{format(parseISO(h.at), 'MMM d')}
                  </p>
                  {h.note && <p className="mt-1 text-[12.5px]" style={{ color: 'var(--clay-ink)' }}>{h.note}</p>}
                </div>
              ))}
            </div>
          </>
        )}

        {!canSubmit && (
          <p className="mt-4 px-3.5 py-3 text-[12.5px]"
             style={{ background: 'var(--clay-bg)', borderRadius: 'var(--clay-r-sm)', color: 'var(--clay-dim)' }}>
            {state === 'submitted'
              ? 'Handed in. Your teacher will take a look.'
              : state === 'approved' ? 'Approved — nothing more to do.' : 'This one is closed.'}
          </p>
        )}

        {canSubmit && (
        <>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
          Anything to say about it?
        </p>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional — what went well, what you're still fighting with…"
          rows={3}
        />

        <p className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-[.12em]"
           style={{ color: missingTake ? 'var(--clay-danger)' : 'var(--clay-dim)' }}>
          {needsTake ? 'Recording required' : 'Add a recording'} {picked.length > 0 && `(${picked.length})`}
        </p>
        {needsTake && (
          <p className="mb-2 text-[11.5px]" style={{ color: 'var(--clay-dim)' }}>
            Your teacher asked to hear this one.
          </p>
        )}

        {/* Record now, for the player sitting with the instrument reading
            this; or pick an earlier take, for the one who has already
            practised and wants to submit the best of several. */}
        <AssignmentRecorder
          // format(), never toISOString(): the latter is UTC and files a
          // take under tomorrow's date for anyone west of Greenwich after
          // late afternoon. This codebase has paid for that three times.
          date={assignment.dueDate?.substring(0, 10) ?? format(new Date(), 'yyyy-MM-dd')}
          pieceName={assignment.title}
          onRecorded={(id) => setPicked((prev) => (prev.includes(id) ? prev : [...prev, id]))}
        />

        <p className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
          Or pick an earlier take
        </p>
        <TakePicker selected={picked} onChange={setPicked} />

        {error && (
          <p className="mt-3 rounded-2xl px-3.5 py-2.5 text-[12.5px]"
             style={{ background: '#FFE8EA', color: 'var(--clay-danger)' }}>
            {error}
          </p>
        )}

        <Button onClick={handSubmit} loading={saving} disabled={missingTake || dailyLocked} className="mt-5 w-full">
          Hand it in
        </Button>
        <p className="mt-2 text-center text-[11px]" style={{ color: 'var(--clay-faint)' }}>
          {dailyLocked
            ? `Keep going — ${daily.daysRequired - daily.daysMet} more ${daily.daysRequired - daily.daysMet === 1 ? 'day' : 'days'} to go.`
            : missingTake
              ? 'Attach a take to hand this in.'
              : 'Your teacher will see this and can ask for another go.'}
        </p>
        </>
        )}
      </div>
    </Modal>
  )
}
