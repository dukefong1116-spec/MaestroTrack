import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Sticker from '@/components/stickers/Sticker'
import DailyStrip from './DailyStrip'
import { useAssignments } from '@/hooks/useAssignments'
import { isDaily, awaitingStudent } from '@/lib/utils/assignments'

/**
 * What today's practice owes a teacher, on the page you practise from.
 *
 * Sessions already counted toward a daily assignment — unscoped ones count
 * everything — but nothing said so, so the student had no way to know
 * their practice was being measured, or how much was left. The mechanism
 * worked and was invisible, which is close to the mechanism not working.
 *
 * Renders nothing when no daily assignment is running, so it costs no
 * space for students whose teacher does not set them.
 */
export default function DailyToday({
  /** Minutes of a session in progress, so the figure moves while you play. */
  liveMinutes = 0,
  compact = false,
}: {
  liveMinutes?: number
  compact?: boolean
}) {
  const navigate = useNavigate()
  const { open } = useAssignments()

  const active = useMemo(
    () => open.filter((x) => isDaily(x.assignment) && awaitingStudent(x.assignment) && x.daily.tracked),
    [open]
  )

  if (active.length === 0) return null

  return (
    <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
      {active.map(({ assignment, daily }) => {
        // The strip already holds today's figure, scoped and filtered, so
        // read it from there rather than recomputing against the log.
        const todayCell = daily.days.find((d) => d.isToday)
        const done = (todayCell?.minutes ?? 0) + Math.max(0, liveMinutes)
        const target = assignment.dailyTargetMinutes ?? 0
        const met = target > 0 && done >= target
        const remaining = Math.max(0, target - done)

        return (
          <motion.div
            key={assignment.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={compact ? 'px-3.5 py-3' : 'px-4 py-3.5'}
            style={{
              background: 'var(--clay-surface)',
              borderRadius: 'var(--clay-r-md)',
              boxShadow: compact ? undefined : 'var(--clay-raised)',
            }}
          >
            <div className="flex items-start gap-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ background: met ? '#DFF5EA' : 'var(--clay-accent-soft)' }}
              >
                <Sticker name={met ? 'check' : 'target'} size={15} tone="accent" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
                  {assignment.title}
                </p>
                <p className="mt-0.5 text-[12px]" style={{ color: met ? '#2E8B62' : 'var(--clay-dim)' }}>
                  {met
                    ? `Today's ${target} min done`
                    : `${done} of ${target} min today · ${remaining} to go`}
                  {assignment.category && ` · ${assignment.category}`}
                </p>

                {/* Today, as a bar; the week, as squares underneath. */}
                <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--clay-bg-deep)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: met ? '#2E8B62' : 'var(--clay-accent)' }}
                    animate={{ width: `${target > 0 ? Math.min(100, (done / target) * 100) : 0}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                {!compact && (
                  <div className="mt-2.5">
                    <DailyStrip progress={daily} dailyTarget={target} compact />
                  </div>
                )}
              </div>
            </div>

            {/* Starting from here carries the category across, so a scoped
                assignment cannot be missed by logging the wrong one. */}
            {!compact && !met && (
              <button
                onClick={() => navigate(
                  assignment.category
                    ? `/student/session?category=${encodeURIComponent(assignment.category)}`
                    : '/student/session'
                )}
                className="mt-2.5 text-[12.5px] font-semibold"
                style={{ color: 'var(--clay-accent)' }}
              >
                Practise this now →
              </button>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
