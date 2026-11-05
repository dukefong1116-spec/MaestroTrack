import Card from '@/components/ui/Card'
import Sticker from '@/components/stickers/Sticker'
import DailyStrip from './DailyStrip'
import {
  normaliseStatus, dueLabel, latestFeedback,
  type AssignmentProgress, type DailyProgress, type Dueness,
} from '@/lib/utils/assignments'
import type { Assignment } from '@/types'

const DUE_TONE: Record<Dueness, { bg: string; fg: string } | null> = {
  overdue: { bg: 'var(--clay-danger-bg)', fg: 'var(--clay-danger)' },
  today: { bg: 'var(--clay-warning-bg)', fg: 'var(--clay-warning-fg)' },
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
  assignment, progress, daily, due, onOpen, actionLabel,
}: {
  assignment: Assignment
  progress: AssignmentProgress
  daily?: DailyProgress
  due: Dueness
  /** The whole card opens the assignment — the brief, the history, the form. */
  onOpen?: () => void
  /** Shown as a button when the student owes work. */
  actionLabel?: string
}) {
  const state = normaliseStatus(assignment.status)
  const tone = DUE_TONE[due]
  const feedback = latestFeedback(assignment)

  const badge =
    state === 'submitted' ? { text: 'Waiting on your teacher', bg: 'var(--clay-bg-deep)', fg: 'var(--clay-dim)' }
    : state === 'returned' ? { text: 'Another go', bg: 'var(--clay-warning-bg)', fg: 'var(--clay-warning-fg)' }
    : state === 'approved' ? { text: 'Approved', bg: 'var(--clay-success-bg)', fg: 'var(--clay-success-fg)' }
    : null

  return (
    <div
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

        {/* One square a day, because the spread is the point of this kind
            of assignment and a single bar would hide it. */}
        {daily?.tracked && (
          <div className="mt-3">
            <DailyStrip progress={daily} dailyTarget={assignment.dailyTargetMinutes ?? 0} />
          </div>
        )}

        {/* Derived from the practice log — nothing to self-report. */}
        {progress.tracked && (
          <div className="mt-3">
            <div className="mb-1 flex items-baseline justify-between text-[10.5px]" style={{ color: 'var(--clay-dim)' }}>
              <span>{progress.minutesDone} / {assignment.targetMinutes} min practised</span>
              {progress.targetMet && (
                <span className="flex items-center gap-1" style={{ color: 'var(--clay-success-fg)' }}>
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
             style={{ background: 'var(--clay-warning-bg)', borderRadius: 'var(--clay-r-sm)', color: 'var(--clay-ink)' }}>
            {feedback.note}
          </p>
        )}
        {state === 'approved' && feedback?.note && (
          <p className="mt-3 px-3 py-2 text-[12px]"
             style={{ background: 'var(--clay-success-bg)', borderRadius: 'var(--clay-r-sm)', color: 'var(--clay-ink)' }}>
            {feedback.note}
          </p>
        )}
      </Card>
    </div>
  )
}
