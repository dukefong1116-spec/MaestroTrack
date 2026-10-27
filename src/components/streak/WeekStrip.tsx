import { motion } from 'framer-motion'
import type { WeekDay } from '@/lib/utils/streakFreeze'

/** A small snowflake, drawn to match the app's sticker language. */
function Snowflake({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2 3.8 16.8" />
    </svg>
  )
}

/**
 * The last seven days at a glance — the thing that makes a streak feel
 * losable rather than just a number. Today pulses while it's still unclaimed.
 */
export default function WeekStrip({
  days,
  size = 30,
  className = '',
}: {
  days: WeekDay[]
  /** The circles' natural size. They shrink below it rather than
   *  overflow when the row is narrower than seven of them. */
  size?: number
  className?: string
}) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {days.map((day) => {
        const done = day.practised
        const frozen = day.frozen
        const pending = day.isToday && !done && !frozen

        const bg = done
          ? 'var(--clay-accent)'
          : frozen
            ? '#BBD9F2'
            : day.isFuture
              ? 'transparent'
              : 'rgba(58,48,84,.09)'

        return (
          <div key={day.date} className="flex min-w-0 flex-col items-center gap-1">
            <motion.div
              // aspect-square + max-w-full rather than a fixed height: on a
              // 375px phone seven 30px circles plus gaps are wider than the
              // card, and a fixed height made the last one clip instead of
              // letting the row give.
              className="flex aspect-square max-w-full items-center justify-center rounded-full"
              style={{
                width: size,
                background: bg,
                color: frozen ? '#2F6FA8' : '#fff',
                border: day.isFuture ? '1.5px dashed rgba(58,48,84,.18)' : 'none',
                boxShadow: done ? 'var(--clay-accent-shadow)' : 'none',
              }}
              animate={pending ? { scale: [1, 1.12, 1] } : { scale: 1 }}
              transition={pending ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : undefined}
              title={day.date}
            >
              {frozen && <Snowflake size={Math.round(size * 0.42)} />}
              {done && (
                <svg width={Math.round(size * 0.46)} height={Math.round(size * 0.46)} viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              )}
            </motion.div>
            <span
              className="text-[9px] font-bold uppercase"
              style={{ color: day.isToday ? 'var(--clay-accent)' : 'var(--clay-faint)' }}
            >
              {day.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
