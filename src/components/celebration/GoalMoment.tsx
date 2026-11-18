import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import Moment from './Moment'
import { playBadgeFanfare } from '@/lib/utils/sound'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

/**
 * Full screen, the session that reached today's goal: an energy bar fills
 * from where the day stood before it to the top, the bolt charges, and
 * the whole bar flashes when it is full.
 */
const BAR_H = 240

export default function GoalMoment({ open, before, after, goal, onDone }: {
  open: boolean
  /** Minutes today before this session. */
  before: number
  /** Minutes today including it. */
  after: number
  goal: number
  onDone: () => void
}) {
  const reduced = usePrefersReducedMotion()
  const [full, setFull] = useState(false)
  const fillMs = reduced ? 0 : 1300
  useEffect(() => {
    if (!open) { setFull(false); return }
    const t = setTimeout(() => { setFull(true); playBadgeFanfare() }, fillMs + 150)
    return () => clearTimeout(t)
  }, [open, fillMs])

  const start = Math.min(0.95, Math.max(0, before / Math.max(1, goal)))
  const green = '#4FD18B'
  const lime = '#C6F36B'

  return (
    <Moment open={open} onDismiss={onDone} scrim="rgba(6,14,16,.94)" autoDismissMs={3600}>
      <div className="flex flex-col items-center text-center text-white">
        <div className="relative flex items-center justify-center" style={{ height: BAR_H + 70 }}>
          {/* Rays when it fills. */}
          {full && !reduced && Array.from({ length: 12 }, (_, i) => (
            // Each ray is turned by its wrapper, then flies "up" — outward.
            <div key={i} className="absolute" style={{ transform: `rotate(${i * 30}deg)` }}>
              <motion.span
                className="block"
                style={{ width: 5, height: 36, borderRadius: 4, background: lime }}
                initial={{ opacity: 0.95, y: -90 }}
                animate={{ opacity: 0, y: -190 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          ))}
          <motion.div
            className="relative overflow-hidden"
            style={{ width: 96, height: BAR_H, borderRadius: 28, border: '4px solid rgba(255,255,255,.85)', background: 'rgba(255,255,255,.08)' }}
            animate={full && !reduced ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={{ duration: 0.45 }}
          >
            <motion.div
              className="absolute inset-x-0 bottom-0"
              style={{ background: `linear-gradient(180deg, ${lime}, ${green})` }}
              initial={{ height: `${start * 100}%` }}
              animate={{ height: '100%' }}
              transition={{ duration: fillMs / 1000, ease: [0.5, 0, 0.2, 1], delay: reduced ? 0 : 0.25 }}
            >
              {/* A moving sheen on the charge. */}
              {!reduced && (
                <motion.div
                  className="absolute inset-x-0 h-10"
                  style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,.45), rgba(255,255,255,0))' }}
                  initial={{ top: '100%' }}
                  animate={{ top: '-30%' }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                />
              )}
            </motion.div>
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.span
                animate={full ? { scale: reduced ? 1 : [1, 1.5, 1.15], color: '#0B3B22' } : { scale: [1, 1.1, 1], color: '#FFFFFF' }}
                transition={full ? { duration: 0.5 } : { duration: 0.7, repeat: Infinity }}
              >
                <Zap size={44} fill="currentColor" strokeWidth={1.5} />
              </motion.span>
            </div>
            {full && (
              <motion.div
                className="absolute inset-0"
                style={{ background: '#fff' }}
                initial={{ opacity: 0.85 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              />
            )}
          </motion.div>
          {/* The terminal, so it reads as a battery. */}
          <span className="absolute" style={{ top: 22, width: 36, height: 12, borderRadius: '6px 6px 0 0', background: 'rgba(255,255,255,.85)' }} />
        </div>

        <motion.p
          className="text-[30px] font-extrabold"
          initial={{ opacity: 0, y: 10 }}
          animate={full ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          style={{ color: lime }}
        >
          Daily goal reached
        </motion.p>
        <p className="mt-1 text-[16px] tabular-nums" style={{ color: 'rgba(255,255,255,.75)' }}>
          {after} of {goal} min today
        </p>
      </div>
    </Moment>
  )
}
