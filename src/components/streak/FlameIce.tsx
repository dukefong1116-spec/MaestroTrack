import { useEffect } from 'react'
import { motion } from 'framer-motion'
import StreakFlame, { IceBlock } from '@/components/icons/StreakFlame'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { playFreezeOver, playThaw } from '@/lib/streak/sounds'

/**
 * The flame freezing over, and thawing out.
 *
 * Freeze (the morning after a missed day a freeze covered): ice grows up
 * over the lit flame from the bottom, the flame cools to blue and stops
 * flickering, and a few glints catch the light.
 *
 * Thaw (the practice that brings it back): the block shakes, cracks
 * three times, shatters outward at 0.9s, and the flame relights with a
 * warm ring. Sounds in lib/streak/sounds are timed to the same beats.
 *
 * With reduced motion, each simply shows where it ends.
 */

const box = (size: number): React.CSSProperties => ({ position: 'relative', width: size, height: size, flex: 'none' })
const layer: React.CSSProperties = { position: 'absolute', left: 0, top: 0 }

function Glint({ x, y, delay, size }: { x: number; y: number; delay: number; size: number }) {
  return (
    <motion.svg
      width={size} height={size} viewBox="0 0 24 24" aria-hidden
      style={{ position: 'absolute', left: x, top: y, color: '#4F96DA' }}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: [0, 1, 0, 1, 0], scale: [0.4, 1, 0.4, 1, 0.4] }}
      transition={{ delay, duration: 2.2, ease: 'easeInOut' }}
    >
      <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </motion.svg>
  )
}

export function FreezeOver({ streak, size = 110, sound = true }: { streak: number; size?: number; sound?: boolean }) {
  const reduced = usePrefersReducedMotion()
  useEffect(() => { if (sound) playFreezeOver() }, [sound])

  if (reduced) return <StreakFlame streak={streak} size={size} state="frozen" still />

  const g = Math.round(size * 0.15)
  return (
    <div style={box(size)}>
      <motion.div style={layer} initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 0.6, duration: 0.45 }}>
        <StreakFlame streak={streak} size={size} />
      </motion.div>
      <motion.div style={layer} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.45 }}>
        <StreakFlame streak={streak} size={size} state="frozen" bare still />
      </motion.div>
      <motion.div
        style={{ ...layer, width: size, height: size, transformOrigin: '50% 100%' }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: 0.3, duration: 0.75, ease: [0.2, 0.9, 0.3, 1] }}
      >
        <IceBlock size={size} />
      </motion.div>
      <Glint x={-g} y={size * 0.05} delay={1.05} size={g} />
      <Glint x={size + g * 0.2} y={size * 0.3} delay={1.3} size={g} />
      <Glint x={size * 0.92} y={size * 0.95} delay={1.55} size={g} />
    </div>
  )
}

// Eleven shards, spread round the block, thrown outward and down.
const SHARDS = Array.from({ length: 11 }, (_, i) => {
  const a = (i / 11) * Math.PI * 2 + 0.3 * Math.sin(i * 7)
  const r = 0.71 + ((i * 37) % 30) / 110
  return { a, r, spin: ((i * 97) % 360) - 180, scale: 0.7 + (i % 3) * 0.25 }
})

export function ThawFlame({ streak, size = 110, sound = true }: { streak: number; size?: number; sound?: boolean }) {
  const reduced = usePrefersReducedMotion()
  useEffect(() => { if (sound) playThaw() }, [sound])

  if (reduced) return <StreakFlame streak={streak} size={size} still />

  const k = size / 110
  const shard = Math.round(18 * k)
  const crack = (d: string, delay: number, dur = 0.16) => (
    <motion.path
      d={d} fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay, duration: dur }}
    />
  )

  return (
    <div style={box(size)}>
      <motion.div style={layer} initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 0.9, duration: 0.08 }}>
        <StreakFlame streak={streak} size={size} state="frozen" bare still />
      </motion.div>
      <motion.div
        style={layer}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.9, type: 'spring', stiffness: 320, damping: 11 }}
      >
        <StreakFlame streak={streak} size={size} />
      </motion.div>

      {/* the block: shakes as it cracks, gone the instant it shatters */}
      <motion.div style={{ ...layer, width: size, height: size }} initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 0.9, duration: 0.06 }}>
        <motion.div
          style={{ position: 'absolute', inset: 0 }}
          animate={{ x: [0, -3 * k, 3 * k, -2 * k, 2 * k, 0], rotate: [0, -1, 0, 1, 0, 0] }}
          transition={{ delay: 0.15, duration: 0.6 }}
        >
          <IceBlock size={size} />
          <svg width={size} height={size} viewBox="0 0 110 110" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
            {crack('M24 6 L40 30 L33 48 L50 66', 0.25)}
            {crack('M92 18 L72 42 L82 58 L64 86', 0.55)}
            {crack('M40 30 L58 36 L72 42', 0.75, 0.12)}
          </svg>
        </motion.div>
      </motion.div>

      {SHARDS.map((s, i) => (
        <motion.span
          key={i}
          aria-hidden
          style={{
            position: 'absolute',
            left: size * 0.42 + Math.cos(s.a) * size * 0.2,
            top: size * 0.44 + Math.sin(s.a) * size * 0.24,
            width: shard,
            height: shard,
            background: '#B9D9F7',
            clipPath: 'polygon(50% 0, 100% 80%, 10% 100%)',
          }}
          initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: s.scale }}
          animate={{
            opacity: [0, 1, 0],
            x: Math.cos(s.a) * s.r * size,
            y: Math.sin(s.a) * s.r * size + size * 0.36,
            rotate: s.spin,
          }}
          transition={{ delay: 0.9, duration: 0.85, times: [0, 0.05, 1], ease: [0.1, 0.7, 0.3, 1] }}
        />
      ))}

      {/* the warmth coming back */}
      <motion.span
        aria-hidden
        style={{
          position: 'absolute', left: '50%', top: '58%', width: 20 * k, height: 20 * k,
          marginLeft: -10 * k, marginTop: -10 * k, borderRadius: '50%', border: `${Math.max(2, 3 * k)}px solid #F2A33A`,
        }}
        initial={{ opacity: 0, scale: 1 }}
        animate={{ opacity: [0, 0.9, 0], scale: [1, 1, 7] }}
        transition={{ delay: 0.9, duration: 0.7, times: [0, 0.01, 1], ease: 'easeOut' }}
      />
    </div>
  )
}
