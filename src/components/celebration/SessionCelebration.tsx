import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Volume2, VolumeX, Check } from 'lucide-react'
import StreakFlame from '@/components/icons/StreakFlame'
import Sparkle from '@/components/icons/Sparkle'
import InstrumentIcon from '@/components/icons/InstrumentIcon'
import Confetti from './Confetti'
import CountUp from './CountUp'
import { rewardCopy, type SessionReward } from '@/lib/utils/gamification'
import { isSoundMuted, setSoundMuted } from '@/lib/utils/sound'
import type { InstrumentType } from '@/types'

interface SessionCelebrationProps {
  reward: SessionReward | null
  instrument?: InstrumentType
  /** Instrument theme colours, mixed into the confetti. */
  accent?: { primary: string; secondary: string }
  onDismiss: () => void
}

const AUTO_DISMISS_MS = 2800

export default function SessionCelebration({
  reward,
  instrument,
  accent,
  onDismiss,
}: SessionCelebrationProps) {
  const [muted, setMuted] = useState(isSoundMuted)

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // Auto-dismiss, plus Esc.
  useEffect(() => {
    if (!reward) return
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', onKey)
    }
  }, [reward, onDismiss])

  if (!reward) return null

  const { headline, sub } = rewardCopy(reward)
  const muted_ = reward.streakState === 'backdated'
  const showStreak = !muted_ && reward.streakAfter > 0
  const showConfetti = !muted_ && !reduced

  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation()
    const next = !muted
    setMuted(next)
    setSoundMuted(next)
  }

  return (
    <AnimatePresence>
      <motion.div
        key="celebration"
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 cursor-pointer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onDismiss}
        role="status"
        aria-live="polite"
      >
        <div className="absolute inset-0" style={{ background: 'rgba(34,32,28,.45)' }} />

        {showConfetti && (
          <Confetti colors={accent ? [accent.primary, accent.secondary] : []} />
        )}

        <motion.div
          className="relative w-full max-w-sm rounded-3xl px-8 py-9 text-center"
          style={{
            background: 'var(--clay-surface)',
            boxShadow: 'var(--clay-deep)',
          }}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={
            reduced
              ? { duration: 0.15, delay: 0.1 }
              : { type: 'spring', stiffness: 380, damping: 26, delay: 0.1 }
          }
          onClick={(e) => e.stopPropagation()}
        >
          {/* mute toggle */}
          <button
            onClick={toggleMute}
            className="absolute right-4 top-4 rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--clay-faint)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--clay-ink)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--clay-faint)')}
            aria-label={muted ? 'Unmute celebration sound' : 'Mute celebration sound'}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          {/* crest */}
          <motion.div
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: muted_ ? 'var(--clay-bg-deep)' : 'linear-gradient(135deg,var(--clay-accent),var(--clay-accent-hover))',
              color: muted_ ? 'var(--clay-dim)' : '#FFFFFF',
            }}
            initial={reduced ? false : { scale: 0, rotate: -25 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.22 }}
          >
            {muted_ ? (
              <Check size={28} />
            ) : reward.isFirstEver ? (
              <InstrumentIcon instrument={instrument} size={30} />
            ) : (
              <Sparkle size={28} />
            )}
          </motion.div>

          <motion.h2
            className="text-2xl font-bold"
            style={{ color: 'var(--clay-ink)', textWrap: 'balance' } as React.CSSProperties}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.35 }}
          >
            {headline}
          </motion.h2>

          <motion.p
            className="mt-1.5 text-sm"
            style={{ color: 'var(--clay-dim)' }}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.35 }}
          >
            {sub}
          </motion.p>

          {/* minutes */}
          <motion.div
            className="mt-6 flex items-baseline justify-center gap-1.5"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <CountUp
              to={reward.minutes}
              delay={0.3}
              className="text-5xl font-bold leading-none"
              style={{ color: 'var(--clay-accent)' }}
            />
            <span className="text-base font-semibold" style={{ color: 'var(--clay-faint)' }}>
              min
            </span>
          </motion.div>

          {/* streak row */}
          {showStreak && (
            <motion.div
              className="mt-6 flex items-center justify-center gap-2.5 rounded-2xl py-3"
              style={{ background: 'var(--clay-bg)' }}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.4 }}
            >
              <motion.span
                initial={reduced ? false : { scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 1.1 }}
                style={{ display: 'inline-flex' }}
              >
                <StreakFlame streak={reward.streakAfter} size={26} still={!!reduced} />
              </motion.span>
              <span className="text-sm font-semibold" style={{ color: 'var(--clay-ink)' }}>
                {reward.streakAfter} day{reward.streakAfter === 1 ? '' : 's'} in a row
              </span>
            </motion.div>
          )}

          {reward.hitDailyGoal && !muted_ && (
            <motion.p
              className="mt-3 text-xs font-semibold uppercase tracking-widest"
              style={{ color: '#2C7A4B' }}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              Daily goal reached
            </motion.p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
