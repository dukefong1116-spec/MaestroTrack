import { useEffect } from 'react'
import { motion } from 'framer-motion'
import Moment, { usePrefersReducedMotion } from './Moment'
import BadgeArt, { type BadgeArtName } from '@/components/badges/BadgeArt'
import Confetti from './Confetti'
import { playBadgeFanfare } from '@/lib/utils/sound'

export interface BadgeAward {
  id: BadgeArtName
  label: string
  description: string
}

/**
 * Badge unlock. The medallion flies up, overshoots, spins once and lands
 * with a shockwave — badges were previously discovered passively on a page
 * people rarely opened, which wasted them entirely.
 */
export default function BadgeMoment({
  badge, open, onDismiss,
}: {
  badge: BadgeAward | null
  open: boolean
  onDismiss: () => void
}) {
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (open && badge) playBadgeFanfare()
  }, [open, badge])

  if (!badge) return null

  return (
    <Moment open={open} onDismiss={onDismiss} autoDismissMs={3800}>
      {!reduced && <Confetti />}

      <div
        className="relative overflow-hidden px-8 py-10 text-center"
        style={{
          background: 'var(--clay-surface)',
          borderRadius: 'var(--clay-r-lg)',
          boxShadow: 'var(--clay-deep)',
        }}
      >
        {/* radial glow behind the medallion */}
        <motion.div
          className="pointer-events-none absolute left-1/2 top-[76px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: 260, height: 260,
            background: 'radial-gradient(circle, rgba(255,122,92,.30) 0%, transparent 68%)',
          }}
          initial={reduced ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.6 }}
        />

        <div className="relative mx-auto mb-6 flex h-[120px] w-[120px] items-center justify-center">
          {/* shockwave on landing */}
          {!reduced && (
            <motion.span
              className="absolute rounded-full"
              style={{ width: 120, height: 120, border: '3px solid var(--clay-accent)' }}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [0.5, 1.9], opacity: [0, 0.55, 0] }}
              transition={{ delay: 0.62, duration: 0.75, ease: 'easeOut' }}
            />
          )}

          {/* the medallion */}
          <motion.div
            className="flex h-[112px] w-[112px] items-center justify-center"
            style={{ filter: 'drop-shadow(0 12px 22px rgba(58,48,84,.22))' }}
            initial={reduced ? { opacity: 0 } : { y: 150, opacity: 0, rotateY: -180, scale: 0.6 }}
            animate={
              reduced
                ? { opacity: 1 }
                : { y: [150, -14, 0], opacity: 1, rotateY: 0, scale: [0.6, 1.12, 1] }
            }
            transition={
              reduced
                ? { duration: 0.2 }
                : { duration: 0.8, times: [0, 0.62, 1], ease: [0.22, 1, 0.36, 1], delay: 0.1 }
            }
          >
            <BadgeArt name={badge.id} size={112} />
          </motion.div>
        </div>

        <motion.p
          className="text-[10px] font-bold uppercase tracking-[.18em]"
          style={{ color: 'var(--clay-accent)' }}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85 }}
        >
          Badge unlocked
        </motion.p>

        <motion.h2
          className="mt-1.5 text-[26px] font-bold leading-tight"
          style={{ color: 'var(--clay-ink)', fontFamily: 'var(--clay-font)' }}
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.95, duration: 0.4 }}
        >
          {badge.label}
        </motion.h2>

        <motion.p
          className="mt-2 text-[13px]"
          style={{ color: 'var(--clay-dim)' }}
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.4 }}
        >
          {badge.description}
        </motion.p>
      </div>
    </Moment>
  )
}
