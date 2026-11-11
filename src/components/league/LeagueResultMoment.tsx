import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useAuthStore } from '@/stores/authStore'
import { updateUserProfile } from '@/lib/firebase/teacher'
import { primeAudioContext } from '@/lib/utils/sound'
import {
  playDemotion, playPromotion, playSparkle, playStay, playWeekSwell, playXpTick,
} from '@/lib/league/sounds'
import { TierBackdrop, TierTrophy } from './TierArt'
import { themeFor } from '@/lib/league/themes'
import Confetti from '@/components/celebration/Confetti'
import type { InstrumentType, LeagueResult } from '@/types'

/**
 * The week's result, the first time you open the app after your room has
 * finished: "Week complete", then — on a tap, which is also what lets a
 * phone play the sound — the reveal.
 *
 *   Moved up   the old trophy sinks away, the next tier's colours and
 *              drawing wash in, the new trophy rises with a gold ring and
 *              a burst of notes, and a fanfare that grows with the tier.
 *   Maestro    top three in Fortissimo: the cup stays, with gold confetti.
 *   Stayed     a proud little bounce and a shimmer.
 *   Moved down gently: the trophy steps down to the tier below, with an
 *              encouraging line. No red, no shake.
 *
 * Its own full-screen layer above everything, opaque, so nothing behind
 * it shows through. Seen once: closing it records the week as seen.
 */

type Stage = 'waiting' | 'reveal' | 'swap' | 'done'

const NOTES = Array.from({ length: 14 }, (_, i) => ({
  ch: i % 3 ? '♪' : '♫',
  colour: ['#FFD66B', '#FFFFFF', '#C9B8FF'][i % 3],
  dx: ((i * 53) % 240) - 120,
  rot: ((i * 37) % 60) - 30,
  delay: i * 0.06,
}))

export default function Reveal({ result }: { result: LeagueResult }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const reduced = usePrefersReducedMotion()
  const instrument = profile?.instrument as InstrumentType | undefined
  const [stage, setStage] = useState<Stage>('waiting')
  const [xp, setXp] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const at = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, reduced ? Math.min(ms, 300) : ms)) }

  const outcome = result.toTier > result.fromTier ? 'up' : result.toTier < result.fromTier ? 'down' : result.maestro ? 'maestro' : 'stay'
  const from = themeFor(result.fromTier)
  const to = themeFor(result.toTier)
  const showTo = stage === 'swap' || stage === 'done'
  const ground = showTo ? to : from

  function begin() {
    if (stage !== 'waiting') return
    primeAudioContext() // this tap is the gesture a phone needs for sound
    setStage('reveal')
    playWeekSwell()
    at(900, () => {
      setStage('swap')
      if (outcome === 'up') { playPromotion(result.toTier, instrument); at(450, () => playSparkle(instrument)) }
      else if (outcome === 'down') playDemotion(instrument)
      else if (outcome === 'maestro') { playPromotion(result.toTier, instrument); at(450, () => playSparkle(instrument)) }
      else playStay(instrument)
    })
    at(2000, () => {
      setStage('done')
      const steps = 30
      for (let i = 1; i <= steps; i++) at(i * 22, () => { setXp(Math.round((result.xp * i) / steps)); if (i % 3 === 0) playXpTick(instrument) })
    })
  }

  function finish(goTo?: string) {
    const live = useAuthStore.getState().profile
    if (live) useAuthStore.getState().setProfile({ ...live, leagueSeen: result.week })
    if (profile?.uid) void updateUserProfile(profile.uid, { leagueSeen: result.week }).catch(() => {})
    if (goTo) navigate(goTo)
  }

  const headline =
    outcome === 'up' ? `You moved up to ${to.name}`
      : outcome === 'maestro' ? `Maestro finish`
        : outcome === 'down' ? `Back to ${to.name}`
          : `You held your place in ${to.name}`
  const subline =
    outcome === 'down' ? "Fresh start this week. You've got this."
      : outcome === 'maestro' ? `${ordinal(result.rank)} in Fortissimo. Bravo.`
        : null

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex flex-col items-center overflow-hidden text-center"
      style={{ background: from.background, color: ground.ink, fontFamily: 'var(--clay-font)' }}
      data-tour-wait
      role="dialog"
      aria-modal="true"
      aria-label="Your league result"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      onClick={begin}
    >
      <TierBackdrop tier={result.fromTier} />
      {/* The next tier washes in over the last. */}
      <motion.div
        className="absolute inset-0"
        style={{ background: to.background }}
        initial={{ opacity: 0 }}
        animate={{ opacity: showTo && outcome !== 'stay' && outcome !== 'maestro' ? 1 : 0 }}
        transition={{ duration: outcome === 'down' ? 1.6 : 1.2 }}
      >
        <TierBackdrop tier={result.toTier} />
      </motion.div>
      {outcome === 'maestro' && stage === 'done' && !reduced && <Confetti colors={['#FFD66B', '#E9B949', '#FFFFFF']} />}

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); finish() }}
        aria-label="Close"
        className="absolute right-4 z-10 rounded-full p-2"
        style={{ top: 'calc(14px + env(safe-area-inset-top))', color: ground.sub, transition: 'color 1s' }}
      >
        <X size={20} />
      </button>

      <div className="relative flex w-full max-w-sm flex-1 flex-col items-center px-6" style={{ paddingTop: 'calc(64px + env(safe-area-inset-top))' }}>
        <p className="text-[12px] font-semibold uppercase tracking-[.14em]" style={{ color: ground.sub, transition: 'color 1s' }}>
          {result.week.replace(/^(\d+)-W0?(\d+)$/, 'Week $2')} complete
        </p>

        {/* The stage: one trophy leaves, the next arrives. */}
        <div className="relative mt-6 h-[200px] w-full">
          <motion.div
            className="absolute left-1/2 top-4"
            initial={false}
            animate={
              showTo && outcome === 'up' ? { x: '-50%', y: 40, scale: 0.2, opacity: 0 }
                : showTo && outcome === 'down' ? { x: '-50%', y: 30, scale: 0.6, opacity: 0 }
                  : showTo ? { x: '-50%', y: [0, -14, 0], scale: [1, 1.08, 1], opacity: 1 }
                    : { x: '-50%', y: 0, scale: 1, opacity: 1 }
            }
            transition={{ duration: showTo && outcome === 'up' ? 0.8 : 0.7, ease: [0.5, 0, 0.75, 0] }}
          >
            <TierTrophy tier={result.fromTier} size={130} />
          </motion.div>
          {(outcome === 'up' || outcome === 'down') && (
            <motion.div
              className="absolute left-1/2 top-0"
              initial={{ x: '-50%', y: outcome === 'up' ? 80 : 0, scale: outcome === 'up' ? 0.4 : 0.85, opacity: 0 }}
              animate={showTo ? { x: '-50%', y: 0, scale: 1, opacity: 1 } : undefined}
              transition={outcome === 'up' && !reduced
                ? { type: 'spring', stiffness: 170, damping: 11, delay: 0.45 }
                : { duration: 1, delay: 0.5 }}
            >
              <TierTrophy tier={result.toTier} size={outcome === 'up' ? 160 : 130} />
            </motion.div>
          )}
          {(outcome === 'up' || outcome === 'maestro') && showTo && !reduced && <Burst />}
        </div>

        <AnimatePresence>
          {stage === 'waiting' && (
            <motion.div key="wait" exit={{ opacity: 0 }} className="flex flex-col items-center">
              <p className="text-[22px] font-bold">Your {from.name} results are in</p>
              <motion.span
                className="mt-8 rounded-full px-7 py-3 text-[14px] font-bold"
                style={{ background: 'var(--clay-accent)', color: 'var(--clay-on-accent)' }}
                animate={reduced ? undefined : { scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 1.6 }}
              >
                Tap to reveal
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        {stage !== 'waiting' && (
          <div className="flex flex-col items-center">
            {outcome !== 'stay' && outcome !== 'maestro' && (
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: showTo ? 1 : 0 }} transition={{ delay: 0.6 }}
                className="text-[18px] font-semibold italic" style={{ fontFamily: 'Georgia, serif', color: to.sub }}
              >
                {from.id} → {to.id}
              </motion.p>
            )}
            <motion.p
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: showTo ? 1 : 0, y: showTo ? 0 : 10 }} transition={{ delay: 0.9, duration: 0.6 }}
              className="mt-1 text-[24px] font-bold leading-tight" style={{ textWrap: 'balance' } as React.CSSProperties}
            >
              {headline}
            </motion.p>
            {subline && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: showTo ? 1 : 0 }} transition={{ delay: 1.2 }}
                className="mt-1.5 text-[14px]" style={{ color: ground.sub }}>
                {subline}
              </motion.p>
            )}
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: stage === 'done' ? 1 : 0 }}
              className="mt-2 text-[13.5px] tabular-nums" style={{ color: ground.sub }}>
              Finished {ordinal(result.rank)} of {result.of} · {xp} weekly XP
            </motion.p>
          </div>
        )}

        <div className="flex-1" />
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: stage === 'done' ? 1 : 0, y: stage === 'done' ? 0 : 10 }}
          transition={{ delay: 0.6 }}
          disabled={stage !== 'done'}
          onClick={(e) => { e.stopPropagation(); finish('/student/league') }}
          className="mb-8 w-full rounded-full py-3.5 text-[15px] font-bold"
          style={{
            background: outcome === 'up' || outcome === 'maestro' ? '#FFD66B' : 'var(--clay-accent)',
            color: outcome === 'up' || outcome === 'maestro' ? '#3A2A00' : 'var(--clay-on-accent)',
            marginBottom: 'calc(28px + env(safe-area-inset-bottom))',
          }}
        >
          {outcome === 'up' ? `Enter ${to.name}` : "See this week's league"}
        </motion.button>
      </div>
    </motion.div>
  )
}

/** A gold ring bursting outward and notes floating up from the new trophy. */
function Burst() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-[38%]">
      <motion.span
        className="absolute rounded-full"
        style={{ width: 40, height: 40, left: -20, top: -20, border: '3px solid #FFD66B' }}
        initial={{ scale: 0.5, opacity: 1 }}
        animate={{ scale: 5, opacity: 0 }}
        transition={{ duration: 1.1, ease: 'easeOut', delay: 0.5 }}
      />
      {NOTES.map((n, i) => (
        <motion.span
          key={i}
          className="absolute text-[20px]"
          style={{ color: n.colour, left: -6, top: -12 }}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0.5, rotate: 0 }}
          animate={{ opacity: [0, 1, 0], x: n.dx, y: -170, scale: 1.2, rotate: n.rot }}
          transition={{ duration: 2.2, ease: 'easeOut', delay: 0.5 + n.delay, times: [0, 0.15, 1] }}
        >
          {n.ch}
        </motion.span>
      ))}
    </div>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}
