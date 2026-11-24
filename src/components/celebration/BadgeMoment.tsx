import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Moment from './Moment'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import BadgeArt, { badgePalette, type BadgeArtName } from '@/components/badges/BadgeArt'
import { playBadgeFanfare, playBadgeFlip, playBadgeShatter, playBadgeCharge } from '@/lib/utils/sound'

export interface BadgeAward {
  id: BadgeArtName
  label: string
  description: string
}

/**
 * Badge unlock, full screen. Each unlock picks one of three reveals at
 * random, so earning a run of badges does not play the same film twice:
 *
 *   flip    — the grey badge spins like a coin and lands face up in colour
 *   shatter — a grey shell cracks, shakes and breaks into flying shards
 *   charge  — a ring fills round the grey badge, flashes, and colour pops in
 *
 * All three end the same way: a glow, a burst of sparks in the badge's own
 * colours, and the name rising in underneath.
 */
type Style = 'flip' | 'shatter' | 'charge'
const STYLES: Style[] = ['flip', 'shatter', 'charge']
/** When the colour arrives, per style (ms): the sparks, sound and words follow it. */
const REVEAL: Record<Style, number> = { flip: 1350, shatter: 1050, charge: 1480 }
const SIZE = 170
/** Each reveal's own sound, timed to it from the moment it opens. */
const SOUND: Record<Style, () => void> = { flip: playBadgeFlip, shatter: playBadgeShatter, charge: playBadgeCharge }

/** The grey shell's pieces, as polygons over the badge (percent). */
const SHARDS = [
  '0% 0%,50% 0%,40% 45%,0% 55%',
  '50% 0%,100% 0%,100% 40%,60% 35%,40% 45%',
  '0% 55%,40% 45%,45% 100%,0% 100%',
  '40% 45%,60% 35%,70% 70%,45% 100%',
  '60% 35%,100% 40%,100% 100%,70% 70%',
  '45% 100%,70% 70%,100% 100%',
]

export default function BadgeMoment({
  badge, open, onDismiss, onShare,
}: {
  badge: BadgeAward | null
  open: boolean
  onDismiss: () => void
  onShare?: () => void
}) {
  const reduced = usePrefersReducedMotion()
  // A new pick for every badge shown.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const style = useMemo<Style>(() => STYLES[Math.floor(Math.random() * STYLES.length)], [badge?.id, open])
  const [phase, setPhase] = useState<'in' | 'crack' | 'shown'>('in')

  useEffect(() => {
    if (!open || !badge) return
    setPhase('in')
    const at = reduced ? 0 : REVEAL[style]
    if (reduced) playBadgeFanfare()
    else SOUND[style]()
    const timers = [setTimeout(() => setPhase('shown'), at)]
    if (style === 'shatter' && !reduced) timers.push(setTimeout(() => setPhase('crack'), 550))
    return () => timers.forEach(clearTimeout)
  }, [open, badge, style, reduced])

  if (!badge) return null
  const p = badgePalette(badge.id)
  const shown = phase === 'shown'
  const t = reduced ? 0 : REVEAL[style] / 1000

  return (
    <Moment open={open} onDismiss={onDismiss} scrim="rgba(10,8,18,.94)" autoDismissMs={onShare ? 7000 : 4300}>
      <div className="flex flex-col items-center text-center text-white">
        <div className="relative" style={{ width: SIZE, height: SIZE, perspective: 700 }}>
          {/* Glow, once it is in colour. */}
          <motion.div
            className="pointer-events-none absolute rounded-full"
            style={{ inset: -50, background: `radial-gradient(circle, ${p.b}99 0%, ${p.b}00 65%)` }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={shown ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.6 }}
          />

          {reduced ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0">
              <BadgeArt name={badge.id} size={SIZE} />
            </motion.div>
          ) : style === 'flip' ? (
            <Flip id={badge.id} />
          ) : style === 'shatter' ? (
            <Shatter id={badge.id} phase={phase} />
          ) : (
            <Charge id={badge.id} ring={p.b} shown={shown} />
          )}

          {shown && !reduced && <Sparks p={p} />}
        </div>

        <motion.p
          className="mt-7 text-[12px] font-bold uppercase tracking-[.16em]"
          style={{ color: 'rgba(255,255,255,.6)' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: t + 0.15, duration: 0.4 }}
        >
          Badge unlocked
        </motion.p>
        <motion.h2
          className="mt-1 text-[28px] font-bold leading-tight"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: t + 0.28, duration: 0.4 }}
        >
          {badge.label}
        </motion.h2>
        <motion.p
          className="mt-1.5 text-[14.5px]"
          style={{ color: 'rgba(255,255,255,.72)' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: t + 0.42, duration: 0.4 }}
        >
          {badge.description}
        </motion.p>
        {onShare && (
          <motion.button
            type="button"
            onClick={(e) => { e.stopPropagation(); onShare() }}
            className="mt-6 rounded-full px-7 py-3 text-[15px] font-bold"
            style={{ background: '#fff', color: '#0E1626' }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: t + 0.6, duration: 0.4 }}
          >
            Share my badge
          </motion.button>
        )}
      </div>
    </Moment>
  )
}

/** Grey face up, spun once and a half, landing on the colour face. */
function Flip({ id }: { id: BadgeArtName }) {
  const face = { position: 'absolute' as const, inset: 0, backfaceVisibility: 'hidden' as const, WebkitBackfaceVisibility: 'hidden' as const }
  return (
    <motion.div
      className="absolute inset-0"
      style={{ transformStyle: 'preserve-3d' }}
      initial={{ scale: 0.5, opacity: 0, rotateY: 0 }}
      animate={{ scale: [0.5, 1, 1, 1.25, 1], opacity: 1, rotateY: [0, 0, 0, 540, 540] }}
      transition={{ duration: 1.45, times: [0, 0.24, 0.4, 0.86, 1], ease: 'easeInOut' }}
    >
      <div style={face}><BadgeArt name={id} size={SIZE} locked /></div>
      <div style={{ ...face, transform: 'rotateY(180deg)' }}><BadgeArt name={id} size={SIZE} /></div>
    </motion.div>
  )
}

/** The colour badge under a grey shell that cracks, shakes, then flies apart. */
function Shatter({ id, phase }: { id: BadgeArtName; phase: 'in' | 'crack' | 'shown' }) {
  const broken = phase === 'shown'
  // Timed to playBadgeShatter: the cracks spread with its ticks (0.55s on),
  // and the shell breaks on its crack (1.05s). The flying pieces are plain
  // ice, not copies of the badge's drawing: six full drawings in flight
  // were what made the fall stutter and land late.
  const bits = useMemo(() => Array.from({ length: 14 }, (_, k) => {
    const a = (k / 14) * Math.PI * 2 + Math.random() * 0.4
    return { k, x: Math.cos(a) * (90 + Math.random() * 80), y: Math.sin(a) * 60 - 30, s: 5 + Math.random() * 7, r: Math.random() * 360 }
  }), [])
  return (
    <motion.div className="absolute inset-0" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.35 }}>
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={broken ? { scale: [0.85, 1.12, 1], opacity: 1 } : { scale: 0.85, opacity: 0 }}
        transition={broken ? { duration: 0.55 } : { duration: 0 }}
      >
        <BadgeArt name={id} size={SIZE} />
      </motion.div>
      {/* The grey shell, whole until the break, shivering harder as it cracks. */}
      {!broken && (
        <motion.div
          className="absolute inset-0"
          style={{ willChange: 'transform' }}
          animate={phase === 'crack' ? { x: [0, -2, 2, -3, 3, -4, 4, -2, 0], rotate: [0, -0.6, 0.6, -1, 1, 0] } : { x: 0 }}
          transition={{ duration: 0.5, ease: 'linear' }}
        >
          <BadgeArt name={id} size={SIZE} locked />
          <svg viewBox="0 0 100 100" className="absolute inset-0" aria-hidden="true">
            {phase === 'crack' && CRACKS.map((d, k) => (
              <motion.path
                key={k}
                d={d}
                stroke="#fff"
                strokeWidth="1.7"
                strokeLinecap="round"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: k * 0.08, duration: 0.18, ease: 'easeOut' }}
              />
            ))}
          </svg>
        </motion.div>
      )}
      {broken && SHARDS.map((poly, k) => {
        const a = (k / SHARDS.length) * Math.PI * 2 + 0.4
        const d = 120 + (k % 3) * 30
        return (
          <motion.div
            key={k}
            className="absolute inset-0"
            style={{ clipPath: `polygon(${poly})`, background: 'linear-gradient(145deg,#EEF3F8 0%,#B9C4D2 45%,#8C98A8 100%)', willChange: 'transform, opacity' }}
            initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
            animate={{ x: Math.cos(a) * d, y: [0, Math.sin(a) * d * 0.5 - 30, 300], rotate: (k % 2 ? 1 : -1) * (60 + k * 20), opacity: [1, 1, 0] }}
            transition={{ duration: 0.75, ease: [0.25, 0.5, 0.5, 1], times: [0, 0.35, 1] }}
          />
        )
      })}
      {broken && bits.map((b) => (
        <motion.i
          key={b.k}
          className="absolute left-1/2 top-1/2 block rounded-[2px]"
          style={{ width: b.s, height: b.s, background: '#E4ECF5', willChange: 'transform, opacity' }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: b.x, y: [0, b.y, 260], rotate: b.r, opacity: [1, 1, 0] }}
          transition={{ duration: 0.7, ease: 'easeOut', times: [0, 0.3, 1] }}
        />
      ))}
    </motion.div>
  )
}

/** The cracks, drawn one after another as the ice gives. */
const CRACKS = [
  'M40 45 50 0', 'M40 45 0 55', 'M40 45 60 35 100 40', 'M40 45 45 100', 'M60 35 70 70 100 100', 'M70 70 45 100',
]

/** A ring fills round the grey badge; at full it flashes and the colour is there. */
function Charge({ id, ring, shown }: { id: BadgeArtName; ring: string; shown: boolean }) {
  const R = 104
  const C = 2 * Math.PI * R
  return (
    <>
      <motion.svg
        width={220} height={220} viewBox="0 0 220 220"
        className="absolute" style={{ left: -25, top: -25 }}
        animate={shown ? { opacity: 0, scale: 1.35 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        aria-hidden="true"
      >
        <circle cx="110" cy="110" r={R} stroke="rgba(255,255,255,.12)" strokeWidth="7" fill="none" />
        <motion.circle
          cx="110" cy="110" r={R} stroke={ring} strokeWidth="7" fill="none" strokeLinecap="round"
          strokeDasharray={C} transform="rotate(-90 110 110)"
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 1.1, delay: 0.35, ease: [0.6, 0, 0.4, 1] }}
        />
      </motion.svg>
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={shown ? { scale: [0.94, 1.2, 1], opacity: 1 } : { scale: [0.6, 1, 0.94], opacity: 1 }}
        transition={shown ? { duration: 0.6 } : { scale: { duration: 1.45, times: [0, 0.24, 1] }, opacity: { duration: 0.3 } }}
      >
        <div className="absolute inset-0"><BadgeArt name={id} size={SIZE} locked /></div>
        <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: shown ? 1 : 0 }} transition={{ duration: 0.05 }}>
          <BadgeArt name={id} size={SIZE} />
        </motion.div>
        {shown && (
          <motion.div
            className="absolute"
            style={{ inset: 11, borderRadius: 44, background: '#fff' }}
            initial={{ opacity: 0.95 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
          />
        )}
      </motion.div>
    </>
  )
}

function Sparks({ p }: { p: { a: string; b: string; c: string } }) {
  const bits = useMemo(() => {
    const colours = [p.a, p.b, p.c, '#FFD23F', '#FFFFFF']
    return Array.from({ length: 24 }, (_, k) => ({
    a: Math.random() * Math.PI * 2,
    d: 100 + Math.random() * 80,
    z: 5 + Math.random() * 7,
    r: Math.random() * 360,
    t: 0.9 + Math.random() * 0.5,
    c: colours[k % colours.length],
    sq: k % 3 === 0,
  }))
  }, [p])
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2">
      {bits.map((b, k) => (
        <motion.span
          key={k}
          className="absolute"
          style={{ width: b.z, height: b.z, margin: -b.z / 2, borderRadius: b.sq ? 2 : '50%', background: b.c }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: Math.cos(b.a) * b.d, y: Math.sin(b.a) * b.d + 30, opacity: 0, scale: 0.3, rotate: b.r }}
          transition={{ duration: b.t, ease: [0.15, 0.8, 0.3, 1] }}
        />
      ))}
    </div>
  )
}
