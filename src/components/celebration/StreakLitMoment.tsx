import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import StreakFlame from '@/components/icons/StreakFlame'
import Moment from './Moment'
import { lookFor } from '@/lib/streak/looks'
import { playSubmitChime } from '@/lib/utils/sound'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

/**
 * Full screen, after a session that lit today: the grey flame catches,
 * flares, throws off sparks, and the day count ticks over to the new one.
 */
const SPARKS = 14

export default function StreakLitMoment({ open, before, after, onDone }: {
  open: boolean
  before: number
  after: number
  onDone: () => void
}) {
  const reduced = usePrefersReducedMotion()
  const [lit, setLit] = useState(false)
  useEffect(() => {
    if (!open) { setLit(false); return }
    const t = setTimeout(() => { setLit(true); playSubmitChime() }, reduced ? 0 : 650)
    return () => clearTimeout(t)
  }, [open, reduced])

  const glow = lookFor(Math.max(1, after))
  return (
    <Moment open={open} onDismiss={onDone} scrim="rgba(10,8,18,.94)" autoDismissMs={3600}>
      <div className="flex flex-col items-center text-center text-white">
        <div className="relative flex h-[260px] w-[260px] items-center justify-center">
          {/* The bloom behind the flame, and a ring that rushes out as it catches. */}
          <motion.div
            className="absolute rounded-full"
            style={{ width: 220, height: 220, background: `radial-gradient(circle, ${glow.mid}88 0%, ${glow.mid}00 70%)` }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={lit ? { opacity: [0, 1, 0.75], scale: [0.4, 1.25, 1] } : { opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
          {lit && !reduced && (
            <motion.div
              className="absolute rounded-full"
              style={{ width: 120, height: 120, border: `3px solid ${glow.mid}` }}
              initial={{ opacity: 0.9, scale: 0.6 }}
              animate={{ opacity: 0, scale: 2.4 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            />
          )}
          {lit && !reduced && Array.from({ length: SPARKS }, (_, i) => {
            const a = (i / SPARKS) * Math.PI * 2
            const d = 95 + (i % 3) * 22
            return (
              <motion.span
                key={i}
                className="absolute rounded-full"
                style={{ width: 7, height: 7, background: i % 2 ? glow.core : glow.mid }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d - 20, opacity: 0, scale: 0.3 }}
                transition={{ duration: 0.95, ease: 'easeOut', delay: 0.02 * (i % 4) }}
              />
            )
          })}
          <motion.div
            initial={{ scale: 0.85 }}
            animate={lit ? { scale: reduced ? 1 : [0.85, 1.35, 1] } : { scale: [0.85, 0.92, 0.85] }}
            transition={lit ? { duration: 0.7, ease: [0.3, 1.6, 0.5, 1] } : { duration: 0.6, repeat: Infinity }}
          >
            <StreakFlame streak={Math.max(1, after)} size={150} state={lit ? 'lit' : 'unlit'} />
          </motion.div>
        </div>

        {/* The count rolls from yesterday's number to today's. */}
        <div className="relative h-[72px] overflow-hidden">
          <motion.div
            initial={{ y: 0 }}
            animate={{ y: lit ? -72 : 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22, delay: reduced ? 0 : 0.15 }}
            className="text-[64px] font-extrabold leading-[72px] tabular-nums"
          >
            <div style={{ color: 'rgba(255,255,255,.45)' }}>{before}</div>
            <div style={{ color: glow.core }}>{after}</div>
          </motion.div>
        </div>
        <motion.p
          className="mt-1 text-[22px] font-bold"
          initial={{ opacity: 0, y: 8 }}
          animate={lit ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ delay: reduced ? 0 : 0.35 }}
        >
          {after === 1 ? 'Streak started' : `${after}-day streak`}
        </motion.p>
        <motion.p
          className="mt-1 text-[15px]"
          style={{ color: 'rgba(255,255,255,.7)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: lit ? 1 : 0 }}
          transition={{ delay: reduced ? 0 : 0.55 }}
        >
          Today is lit. Come back tomorrow to keep it going.
        </motion.p>
      </div>
    </Moment>
  )
}
