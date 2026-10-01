import { motion } from 'framer-motion'
import { parseISO, format } from 'date-fns'
import type { DailyProgress } from '@/lib/utils/assignments'

/**
 * A "minutes a day" assignment, one square per day.
 *
 * A single percentage bar would hide the thing that matters here: whether
 * the practice was spread out or crammed. Five days of thirty minutes and
 * one day of a hundred and fifty reach the same total and are not the same
 * work, which is the whole reason a teacher sets it this way.
 */
export default function DailyStrip({
  progress, dailyTarget, compact = false,
}: {
  progress: DailyProgress
  dailyTarget: number
  /** Teacher view: tighter, no legend. */
  compact?: boolean
}) {
  if (!progress.tracked) return null

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {progress.days.map((d, i) => {
          const bg = d.met
            ? 'var(--clay-accent)'
            : d.isFuture
              ? 'var(--clay-bg-deep)'
              : d.isToday
                ? 'var(--clay-accent-soft)'
                : '#FFE8EA'          // a day that passed without the target
          return (
            <motion.div
              key={d.date}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.015 }}
              title={`${format(parseISO(d.date), 'EEE d MMM')} · ${d.minutes} min`}
              className="rounded-[4px]"
              style={{
                width: compact ? 12 : 16,
                height: compact ? 12 : 16,
                background: bg,
                // Today is outlined rather than filled, so it reads as
                // still in play rather than already failed.
                boxShadow: d.isToday && !d.met ? 'inset 0 0 0 2px var(--clay-accent)' : undefined,
              }}
            />
          )
        })}
      </div>

      {!compact && (
        <p className="mt-2 text-[11.5px]" style={{ color: 'var(--clay-dim)' }}>
          {progress.daysMet} of {progress.daysRequired} days at {dailyTarget} min
          {' · '}
          <span style={{ color: progress.onTrack ? 'var(--clay-dim)' : 'var(--clay-danger)' }}>
            {progress.onTrack ? 'on track' : 'a day was missed'}
          </span>
        </p>
      )}
    </div>
  )
}
