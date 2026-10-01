import { motion } from 'framer-motion'
import Card from '@/components/ui/Card'
import Sticker from '@/components/stickers/Sticker'
import {
  normaliseStatus, dueLabel, latestFeedback,
  type AssignmentProgress, type Dueness,
} from '@/lib/utils/assignments'
import type { Assignment } from '@/types'

const DUE_TONE: Record<Dueness, { bg: string; fg: string } | null> = {
  overdue: { bg: '#FFE8EA', fg: 'var(--clay-danger)' },
  today: { bg: '#FFF1D6', fg: '#B37A18' },
  soon: { bg: 'var(--clay-accent-soft)', fg: 'var(--clay-accent-ink)' },
  later: null,
  none: null,
}

/**
 * One assignment, as the student sees it.
 *
 * The state badge is what the old version lacked: a tick that set
 * 'completed' said nothing about whether anyone had looked at the work.
 * Waiting on a teacher and handed back for another go are different
 * situations and need to look different.
 */
export default function AssignmentCard({
  assignment, progress, due, onOpen, actionLabel, index = 0,
}: {
  assignment: Assignment
  progress: AssignmentProgress
  due: Dueness
  /** The whole card opens the assignment — the brief, the history, the form. */
  onOpen?: () => void
  /** Shown as a button when the student owes work. */
  actionLabel?: string
  index?: number
}) {
  const state = normaliseStatus(assignment.status)
  const tone = DUE_TONE[due]
  const feedback = latestFeedback(assignment)

  const badge =
    state === 'submitted' ? { text: 'Waiting on your teacher', bg: 'var(--clay-bg-deep)', fg: 'var(--clay-dim)' }
    : state === 'returned' ? { text: 'Another go', bg: '#FFF1D6', fg: '#B37A18' }
    : state === 'approved' ? { text: 'Approved', bg: '#DFF5EA', fg: '#2E8B62' }
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      // Handlers live here rather than on Card, which takes no DOM props —
      // and Card is existing shared furniture, not something to widen for
      // one caller.
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() }
      } : undefined}
      className={onOpen ? 'cursor-pointer outline-none transition-transform active:scale-[0.99]' : undefined}
    >
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
              {assignment.title}
            </p>
            {assignment.description && (
              <p className="mt-0.5 text-[12px]" style={{ color: 'var(--clay-dim)' }}>
                {assignment.description}
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {badge && (
                <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                      style={{ background: badge.bg, color: badge.fg }}>
                  {badge.text}
                </span>
              )}
              {assignment.requiresRecording && (
                <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                      style={{ background: 'var(--clay-bg-deep)', color: 'var(--clay-dim)' }}>
                  <Sticker name="mic" size={10} tone="ink" /> recording
                </span>
              )}
              {tone && assignment.dueDate && (
                <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                      style={{ background: tone.bg, color: tone.fg }}>
                  {dueLabel(assignment)}
                </span>
              )}
            </div>
          </div>

          {actionLabel && (
            <span
              className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold"
              style={{ background: 'var(--clay-accent)', color: 'var(--clay-on-accent)' }}
            >
              {actionLabel}
            </span>
          )}
        </div>

        {/* Derived from the practice log — nothing to self-report. */}
        {progress.tracked && (
          <div className="mt-3">
            <div className="mb-1 flex items-baseline justify-between text-[10.5px]" style={{ color: 'var(--clay-dim)' }}>
              <span>{progress.minutesDone} / {assignment.targetMinutes} min practised</span>
              {progress.targetMet && (
                <span className="flex items-center gap-1" style={{ color: '#2E8B62' }}>
                  <Sticker name="check" size={11} tone="accent" /> target met
                </span>
              )}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--clay-bg-deep)' }}>
              <div className="h-full rounded-full"
                   style={{ width: `${progress.percent ?? 0}%`, background: 'var(--clay-accent)' }} />
            </div>
          </div>
        )}

        {state === 'returned' && feedback?.note && (
          <p className="mt-3 px-3 py-2 text-[12px]"
             style={{ background: '#FFF1D6', borderRadius: 'var(--clay-r-sm)', color: 'var(--clay-ink)' }}>
            {feedback.note}
          </p>
        )}
        {state === 'approved' && feedback?.note && (
          <p className="mt-3 px-3 py-2 text-[12px]"
             style={{ background: '#DFF5EA', borderRadius: 'var(--clay-r-sm)', color: 'var(--clay-ink)' }}>
            {feedback.note}
          </p>
        )}
      </Card>
    </motion.div>
  )
}
