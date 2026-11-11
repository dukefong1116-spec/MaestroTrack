import { useEffect, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Volume2, VolumeX, Check, Share2 } from 'lucide-react'
import StreakFlame from '@/components/icons/StreakFlame'
import Sparkle from '@/components/icons/Sparkle'
import InstrumentIcon from '@/components/icons/InstrumentIcon'
import Confetti from './Confetti'
import CountUp from './CountUp'
import { rewardCopy, type SessionReward } from '@/lib/utils/gamification'
import { isSoundMuted, setSoundMuted } from '@/lib/utils/sound'
import { ThawFlame } from '@/components/streak/FlameIce'
import { lookReachedAt } from '@/lib/streak/looks'
import { playFreezeEarned } from '@/lib/streak/sounds'
import type { InstrumentType } from '@/types'

interface SessionCelebrationProps {
  reward: SessionReward | null
  instrument?: InstrumentType
  /** Instrument theme colours, mixed into the confetti. */
  accent?: { primary: string; secondary: string }
  onDismiss: () => void
  /**
   * Offered only where there is something to share. Passing it also stops
   * the auto-dismiss: a button that disappears after two and a half
   * seconds is worse than no button, and the moment someone might want to
   * post about is exactly this one.
   */
  onShare?: () => void
  /**
   * More to watch, after the minutes and the streak — the weekly league's
   * climb. While it is there the card waits to be closed rather than
   * leaving on its own mid-animation.
   */
  extra?: React.ReactNode
}

const AUTO_DISMISS_MS = 2800
/** Longer when there is ice to watch break, or a freeze to see arrive. */
const AUTO_DISMISS_STREAK_MS = 4800

/** Mounts its children after a delay, so an animation with its own
 *  timeline — and its sound — starts when it comes into view. */
function Later({ ms, children, onShow }: { ms: number; children: ReactNode; onShow?: () => void }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => { setShown(true); onShow?.() }, ms)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms])
  return shown ? <>{children}</> : null
}

export default function SessionCelebration({
  reward,
  instrument,
  accent,
  onDismiss,
  onShare,
  extra,
}: SessionCelebrationProps) {
  const [muted, setMuted] = useState(isSoundMuted)

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // Auto-dismiss, plus Esc.
  useEffect(() => {
    if (!reward) return
    // Nothing to do here but look at it — so it goes by itself. With a
    // share button there is, so it waits.
    const long = reward.thawed || reward.freezeEarned || reward.restored
    const timer = onShare || extra ? undefined : setTimeout(onDismiss, long ? AUTO_DISMISS_STREAK_MS : AUTO_DISMISS_MS)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', onKey)
    }
  }, [reward, onDismiss, onShare, extra])

  if (!reward) return null

  const { headline, sub } = rewardCopy(reward)
  const muted_ = reward.streakState === 'backdated'
  const short = reward.streakState === 'short'
  const showStreak = !muted_ && (reward.streakAfter > 0 || short)
  const newLook = !muted_ && !short && reward.streakAfter > reward.streakBefore ? lookReachedAt(reward.streakAfter) : null
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
        data-tour-wait
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
              style={{ background: reward.thawed || reward.stillFrozen ? 'rgba(120,180,240,.16)' : 'var(--clay-bg)' }}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.4 }}
            >
              {reward.thawed ? (
                // Ice first, then the flame breaks out of it.
                <span style={{ display: 'inline-flex', width: 40, height: 40 }}>
                  <Later ms={reduced ? 0 : 750}>
                    <ThawFlame streak={reward.streakAfter} size={40} />
                  </Later>
                </span>
              ) : short ? (
                <StreakFlame streak={Math.max(1, reward.streakAfter)} size={26} state={reward.stillFrozen ? 'frozen' : 'unlit'} still />
              ) : (
                <motion.span
                  initial={reduced ? false : { scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 1.1 }}
                  style={{ display: 'inline-flex' }}
                >
                  <StreakFlame streak={reward.streakAfter} size={26} still={!!reduced} />
                </motion.span>
              )}
              <span className="text-sm font-semibold" style={{ color: reward.stillFrozen ? '#2F6FA8' : 'var(--clay-ink)' }}>
                {short
                  ? `${reward.minutesToLight} more min to ${reward.stillFrozen ? 'thaw' : 'light'} today`
                  : reward.restored
                    ? `Your ${reward.restored}-day streak is back`
                    : `${reward.streakAfter} day${reward.streakAfter === 1 ? '' : 's'} in a row`}
              </span>
            </motion.div>
          )}

          {newLook && (
            <motion.p
              className="mt-2.5 text-xs font-semibold uppercase tracking-widest"
              style={{ color: newLook.outer }}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3 }}
            >
              {newLook.name} flame unlocked
            </motion.p>
          )}

          {reward.freezeEarned && !muted_ && (
            <Later ms={reduced ? 0 : 1500} onShow={playFreezeEarned}>
              <motion.div
                className="mt-3 flex items-center justify-center gap-2.5 rounded-2xl py-2.5"
                style={{ background: 'rgba(120,180,240,.16)' }}
                initial={reduced ? false : { opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 16 }}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(120,180,240,.3)', color: '#2F6FA8' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
                    <path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2 3.8 16.8" />
                  </svg>
                </span>
                <span className="text-sm font-semibold" style={{ color: '#2F6FA8' }}>
                  Freeze earned · {reward.freezeEarned} of 2
                </span>
              </motion.div>
            </Later>
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

          {extra}

          {onShare && (
            <motion.div
              className="mt-6 flex w-full flex-col items-center gap-2"
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              // After the number has finished counting. Offering it while
              // the figure is still moving reads as an interruption of
              // the thing someone is actually here to watch.
              transition={{ delay: reduced ? 0 : 1.1 }}
            >
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={(e) => { e.stopPropagation(); onShare() }}
                className="flex items-center justify-center gap-2 rounded-full px-7 py-3 text-[13.5px] font-bold"
                style={{
                  background: 'var(--clay-accent)',
                  color: 'var(--clay-on-accent)',
                  boxShadow: 'var(--clay-accent-shadow)',
                }}
              >
                <Share2 size={15} /> Share this session
              </motion.button>
              <button
                onClick={(e) => { e.stopPropagation(); onDismiss() }}
                className="text-[12px] font-semibold"
                style={{ color: 'var(--clay-dim)' }}
              >
                Not now
              </button>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
