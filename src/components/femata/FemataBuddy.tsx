import { useEffect, useRef, useState } from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import Femata, { type FemataMood, type FemataTone } from './Femata'

interface Props {
  /** How Femata feels right now; a pat swaps it for a moment. */
  mood: FemataMood
  tone?: FemataTone
  size?: number
}

/**
 * Femata floating in the bottom-right corner of a page, above the tab bar.
 * Tap it and it wiggles and squishes like a patted cat, with heart eyes for
 * a moment, then settles back to its mood.
 */
export default function FemataBuddy({ mood, tone = 'sky', size = 78 }: Props) {
  const controls = useAnimationControls()
  const reduced = useReducedMotion()
  const [patted, setPatted] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  function pat() {
    setPatted(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setPatted(false), 1400)
    if (reduced) return
    controls.start({
      rotate: [0, -14, 11, -8, 5, -2, 0],
      scaleX: [1, 1.12, 0.94, 1.06, 0.98, 1],
      scaleY: [1, 0.86, 1.08, 0.95, 1.02, 1],
      y: [0, 4, -10, 0, -3, 0],
      transition: { duration: 0.8, ease: 'easeOut' },
    })
  }

  return (
    <button
      type="button"
      onClick={pat}
      aria-label="Pat Femata"
      className="fixed z-20 rounded-full p-1"
      style={{
        right: 'max(14px, env(safe-area-inset-right))',
        bottom: 'calc(var(--tab-room, 104px) - 6px)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* A slow idle bob, so it looks alive before anyone touches it. */}
      {/* Each layer is its own composited layer (will-change), so the phone
          paints Femata once and only moves it; and both faces are drawn up
          front, so a pat swaps which one shows instead of building a new
          drawing mid-animation. Both had made the first pats stutter. */}
      <motion.span
        className="block"
        animate={reduced ? undefined : { y: [0, -4, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ willChange: 'transform' }}
      >
        <motion.span className="relative block" animate={controls} style={{ transformOrigin: '30% 90%', willChange: 'transform' }}>
          <span className="block" style={{ opacity: patted ? 0 : 1 }}>
            <Femata mood={mood} tone={tone} size={size} />
          </span>
          <span className="absolute inset-0 block" style={{ opacity: patted ? 1 : 0 }} aria-hidden="true">
            <Femata mood="in-love" tone="sunrise" size={size} />
          </span>
        </motion.span>
      </motion.span>
    </button>
  )
}
