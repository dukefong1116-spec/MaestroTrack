import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { useStudentStudioStore } from '@/stores/studentStudioStore'
import { decideCorrection } from '@/lib/firebase/studio'
import { updatePracticeSession } from '@/lib/firebase/practice'
import { correctedSession } from '@/lib/studio/corrections'

/**
 * What the teacher has written for this student in the studio: a
 * correction to their log waiting for their yes or no, and practice the
 * teacher recorded for them. (Lesson notes have their own card.)
 *
 * The log stays theirs: a correction changes nothing until they accept,
 * and accepting changes their own session the ordinary way.
 */
export default function FromYourTeacher() {
  const { profile } = useAuth()
  const sessions = usePracticeStore((s) => s.sessions)
  const teacherId = profile?.teacherId
  const corrections = useStudentStudioStore((s) => s.corrections).filter((c) => c.teacherId === teacherId && c.status === 'pending')
  const added = useStudentStudioStore((s) => s.teacherPractice).filter((e) => e.teacherId === teacherId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const teacher = profile?.teacherName || 'Your teacher'

  // Lesson notes have their own card (StudioCards: LastLessonNotes).
  if (!corrections.length && !added.length) return null

  async function answer(id: string, accept: boolean) {
    const c = corrections.find((x) => x.id === id)
    if (!c) return
    setBusy(id)
    setError('')
    try {
      if (accept) {
        const s = sessions.find((x) => x.id === c.sessionId)
        if (s) await updatePracticeSession(s.id, correctedSession(s, c.toMinutes))
      }
      await decideCorrection(id, accept)
    } catch {
      setError('Could not save your answer. Try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="px-5 py-4" style={{ borderTop: '1px solid var(--clay-line)' }}>
      <h2 className="text-[15px] font-bold" style={{ color: 'var(--clay-ink)' }}>From {teacher}</h2>
      {error && <p className="mt-1 text-[12.5px]" style={{ color: 'var(--clay-danger)' }}>{error}</p>}
      {corrections.map((c) => (
        <div key={c.id} className="mt-2.5 rounded-2xl p-3.5" style={{ background: 'var(--clay-warning-bg)' }}>
          <p className="text-[13.5px]" style={{ color: 'var(--clay-ink)' }}>
            {teacher} suggests <strong>{c.toMinutes} min</strong> instead of {c.fromMinutes} for your practice on {format(parseISO(c.sessionDate), 'EEEE, MMM d')}.
          </p>
          {/* Mixed toward the text colour so it reads on the warning tint in either mode (a fixed brown was invisible in dark). */}
          {c.reason && <p className="mt-1 text-[12.5px]" style={{ color: 'color-mix(in srgb, var(--clay-warning-fg) 70%, var(--clay-ink))' }}>“{c.reason}”</p>}
          <div className="mt-2.5 flex gap-2">
            <button type="button" disabled={busy === c.id} onClick={() => answer(c.id, true)} className="min-h-[36px] rounded-[10px] px-4 text-[13px] font-bold disabled:opacity-50" style={{ background: 'var(--clay-accent)', color: 'var(--clay-on-accent)' }}>Accept</button>
            <button type="button" disabled={busy === c.id} onClick={() => answer(c.id, false)} className="min-h-[36px] rounded-[10px] px-4 text-[13px] font-semibold disabled:opacity-50" style={{ background: 'var(--clay-surface)', color: 'var(--clay-ink)' }}>Keep {c.fromMinutes} min</button>
          </div>
        </div>
      ))}
      {added.map((e) => (
        <p key={e.id} className="mt-2 text-[13px]" style={{ color: 'var(--clay-dim)' }}>
          {teacher} added {e.minutes} min of practice on {format(parseISO(e.date), 'EEE, MMM d')}{e.what ? ` — ${e.what}` : ''}.
        </p>
      ))}
    </div>
  )
}
