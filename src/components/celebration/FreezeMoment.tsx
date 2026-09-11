import { useEffect } from 'react'
import { motion } from 'framer-motion'
import Moment, { usePrefersReducedMotion } from './Moment'
import StreakFlame from '@/components/icons/StreakFlame'
import { playFreezeChime } from '@/lib/utils/sound'

interface FreezeMomentProps {
  open: boolean
  /** Streak length preserved by the freeze. */
  streak: number
  /** How many days were frozen. */
  daysFrozen: number
  /** Freezes left afterwards. */
  remaining: number
  onDismiss: () => void
}

/** Six-pointed crystal that draws itself on. */
function Crystal({ delay, reduced }: { delay: number; reduced: boolean }) {
  return (
    <motion.svg
      width="180" height="180" viewBox="0 0 100 100"
      className="absolute inset-0 m-auto"
      style={{ color: '#CFE6FA' }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, rotate: -25, scale: 0.7 }}
      animate={{ opacity: 0.95, rotate: 0, scale: 1 }}
      transition={{ delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {[0, 60, 120].map((angle) => (
        <g key={angle} transform={`rotate(${angle} 50 50)`}>
          <motion.path
            d="M50 12 V88 M50 26 l-9 -9 M50 26 l9 -9 M50 74 l-9 9 M50 74 l9 9"
            stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none"
            initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: delay + 0.1, duration: 0.6, ease: 'easeOut' }}
          />
        </g>
      ))}
    </motion.svg>
  )
}

/**
 * The one cold moment in the app. Fires on open after a missed day that a
 * freeze rescued — emotionally the point is "oh no, I missed — oh, it's
 * saved." Reuses StreakFlame so the flame the user already recognises is
 * visibly encased and then released.
 */
export default function FreezeMoment({
  open, streak, daysFrozen, remaining, onDismiss,
}: FreezeMomentProps) {
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (open) playFreezeChime()
  }, [open])

  return (
    <Moment
      open={open}
      onDismiss={onDismiss}
      scrim="rgba(24,44,68,.58)"
      autoDismissMs={4200}
    >
      {/* frost creeping in from the edges */}
      {!reduced && (
        <motion.div
          className="pointer-events-none fixed inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 32%, rgba(190,222,247,.42) 78%, rgba(190,222,247,.72) 100%)',
          }}
          initial={{ opacity: 0, scale: 1.3 }}
          animate={{ opacity: [0, 1, 1, 0.6], scale: [1.3, 1, 1, 1.08] }}
          transition={{ duration: 3.4, times: [0, 0.18, 0.66, 1] }}
        />
      )}

      <div
        className="relative overflow-hidden px-8 py-10 text-center"
        style={{
          background: 'linear-gradient(160deg,#F4FAFF,#DCEDFB)',
          borderRadius: 'var(--clay-r-lg)',
          boxShadow: '0 28px 70px -18px rgba(24,44,68,.45), inset 0 2px 0 rgba(255,255,255,.9)',
        }}
      >
        <div className="relative mx-auto mb-6 h-[180px] w-[180px]">
          <Crystal delay={0.45} reduced={reduced} />
          {/* the flame chills, then relights */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={reduced ? false : { scale: 1 }}
            animate={reduced ? {} : { scale: [1, 0.82, 0.82, 1.06, 1] }}
            transition={{ duration: 2.6, times: [0, 0.3, 0.62, 0.8, 1], delay: 0.1 }}
          >
            <motion.div
              animate={reduced ? {} : { filter: ['saturate(1)', 'saturate(.25)', 'saturate(.25)', 'saturate(1)'] }}
              transition={{ duration: 2.6, times: [0, 0.32, 0.64, 1], delay: 0.1 }}
            >
              <StreakFlame streak={streak} size={78} still={reduced} />
            </motion.div>
          </motion.div>
        </div>

        <motion.h2
          className="text-[26px] font-bold leading-tight"
          style={{ color: '#1E4A72', fontFamily: 'var(--clay-font)' }}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.4 }}
        >
          Streak saved
        </motion.h2>

        <motion.p
          className="mt-2 text-[15px] font-semibold"
          style={{ color: '#3D6E96' }}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.65, duration: 0.4 }}
        >
          {streak} days still going
        </motion.p>

        <motion.p
          className="mt-4 text-[12.5px]"
          style={{ color: '#5B87AB' }}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.9 }}
        >
          {daysFrozen === 1 ? 'A freeze covered yesterday' : `${daysFrozen} freezes covered the gap`}
          {' · '}
          {remaining === 0 ? 'none left' : `${remaining} left`}
        </motion.p>
      </div>
    </Moment>
  )
}
