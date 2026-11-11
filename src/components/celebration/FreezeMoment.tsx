import { format, parseISO } from 'date-fns'
import { motion } from 'framer-motion'
import Moment from './Moment'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { FreezeOver } from '@/components/streak/FlameIce'

interface FreezeMomentProps {
  open: boolean
  /** Streak length the freeze kept. */
  streak: number
  /** The days it covered, yyyy-MM-dd. */
  days: string[]
  /** Freezes left afterwards. */
  remaining: number
  onDismiss: () => void
}

/**
 * The one cold moment in the app. Fires on open after a missed day a
 * freeze covered: the flame you know is visibly closed in ice — and stays
 * that way on Today until the next practice thaws it (see FlameIce).
 */
export default function FreezeMoment({ open, streak, days, remaining, onDismiss }: FreezeMomentProps) {
  const reduced = usePrefersReducedMotion()
  const missed = days.length === 1
    ? format(parseISO(days[0]), 'EEEE')
    : `${days.length} days`

  return (
    <Moment open={open} onDismiss={onDismiss} scrim="rgba(24,44,68,.58)" autoDismissMs={5600}>
      <div
        className="relative overflow-hidden px-8 py-10 text-center"
        style={{
          background: 'linear-gradient(160deg,#F4FAFF,#DCEDFB)',
          borderRadius: 'var(--clay-r-lg)',
          boxShadow: '0 28px 70px -18px rgba(24,44,68,.45), inset 0 2px 0 rgba(255,255,255,.9)',
        }}
      >
        <div className="mx-auto mb-4 flex h-[150px] items-center justify-center">
          {open && <FreezeOver streak={streak} size={110} />}
        </div>

        <motion.p
          className="text-[44px] font-bold leading-none"
          style={{ color: '#2F6FA8' }}
          initial={reduced ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.1, duration: 0.35 }}
        >
          {streak}
        </motion.p>

        <motion.h2
          className="mt-3 text-[26px] font-bold leading-tight"
          style={{ color: '#1E4A72', fontFamily: 'var(--clay-font)' }}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.4 }}
        >
          Your flame froze
        </motion.h2>

        <motion.p
          className="mt-2 text-[14.5px] font-semibold"
          style={{ color: '#3D6E96', textWrap: 'balance' } as React.CSSProperties}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.45, duration: 0.4 }}
        >
          You missed {missed}, so a freeze kept your {streak}-day streak safe. Practise today to thaw it.
        </motion.p>

        <motion.p
          className="mt-4 text-[12.5px]"
          style={{ color: '#5B87AB' }}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.7 }}
        >
          {remaining === 0 ? 'No freezes left' : `${remaining} freeze${remaining === 1 ? '' : 's'} left`}
        </motion.p>
      </div>
    </Moment>
  )
}
