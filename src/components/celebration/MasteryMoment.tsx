import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import Moment, { usePrefersReducedMotion } from './Moment'
import Confetti from './Confetti'
import Sticker from '@/components/stickers/Sticker'
import { playMasteryCadence } from '@/lib/utils/sound'
import type { MasteryCandidate } from '@/lib/utils/mastery'

/**
 * Mastering a piece used to be a dropdown change. It is the biggest thing
 * that happens in this app — months of work arriving somewhere — so it gets
 * the biggest moment: the confidence curve the player actually earned,
 * drawing itself in, under the title of the piece.
 *
 * Unlike the badge and freeze moments this one is a *decision*, so it does
 * not auto-dismiss and it has two explicit answers.
 */
export default function MasteryMoment({
  candidate, open, onConfirm, onDismiss,
}: {
  candidate: MasteryCandidate | null
  open: boolean
  onConfirm: () => void
  onDismiss: () => void
}) {
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (open && candidate) playMasteryCadence()
  }, [open, candidate])

  // The curve, normalised into the drawing box. Confidence is 1-10.
  const path = useMemo(() => {
    if (!candidate) return ''
    const pts = candidate.confidenceHistory.slice(-24)
    if (pts.length < 2) return ''
    const W = 232, H = 56
    return pts
      .map((p, i) => {
        const x = (i / (pts.length - 1)) * W
        const y = H - ((Math.min(10, Math.max(1, p.value)) - 1) / 9) * H
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ')
  }, [candidate])

  if (!candidate) return null

  const hours = Math.floor(candidate.totalMinutes / 60)
  const mins = candidate.totalMinutes % 60
  const invested = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`

  return (
    <Moment open={open} onDismiss={onDismiss} autoDismissMs={0}>
      {!reduced && <Confetti />}

      <div
        className="relative overflow-hidden px-8 py-9 text-center"
        style={{
          background: 'var(--clay-surface)',
          borderRadius: 'var(--clay-r-lg)',
          boxShadow: 'var(--clay-deep)',
        }}
      >
        <motion.p
          className="text-[10px] font-bold uppercase tracking-[.18em]"
          style={{ color: 'var(--clay-accent)' }}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          Ready to call it?
        </motion.p>

        <motion.h2
          className="mx-auto mt-2 max-w-[18ch] text-[26px] font-bold leading-tight"
          style={{ color: 'var(--clay-ink)', fontFamily: 'var(--clay-font)' }}
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45 }}
        >
          {candidate.piece.title}
        </motion.h2>

        {candidate.piece.composer && (
          <p className="mt-1 text-[13px]" style={{ color: 'var(--clay-dim)' }}>
            {candidate.piece.composer}
          </p>
        )}

        {/* The curve they earned. */}
        {path && (
          <div className="mx-auto mt-6 w-[232px]">
            <svg width="232" height="56" viewBox="0 0 232 56" fill="none" aria-hidden="true">
              <motion.path
                d={path}
                stroke="var(--clay-accent)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                initial={reduced ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.45, duration: 1.1, ease: 'easeOut' }}
              />
            </svg>
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--clay-faint)' }}>
              How sure you felt, start to now
            </p>
          </div>
        )}

        <motion.div
          className="mt-6 flex items-center justify-center gap-5 text-[13px]"
          style={{ color: 'var(--clay-dim)' }}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <span className="flex items-center gap-1.5">
            <Sticker name="clock" size={14} tone="ink" /> {invested}
          </span>
          <span className="flex items-center gap-1.5">
            <Sticker name="note" size={14} tone="ink" /> {candidate.sessionCount} sessions
          </span>
        </motion.div>

        <motion.div
          className="mt-7 grid grid-cols-2 gap-3"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05 }}
        >
          <button
            onClick={onConfirm}
            className="py-3.5 text-[15px] font-semibold"
            style={{
              borderRadius: 'var(--clay-r-lg)',
              background: 'var(--clay-accent)',
              color: 'var(--clay-on-accent)',
              boxShadow: 'var(--clay-accent-shadow)',
            }}
          >
            Mastered
          </button>
          <button
            onClick={onDismiss}
            className="py-3.5 text-[15px] font-semibold"
            style={{
              borderRadius: 'var(--clay-r-lg)',
              background: 'var(--clay-bg)',
              color: 'var(--clay-dim)',
            }}
          >
            Not yet
          </button>
        </motion.div>
      </div>
    </Moment>
  )
}
