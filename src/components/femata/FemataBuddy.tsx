import { useEffect, useRef, useState } from 'react'
import {
  motion, useAnimationControls, useMotionValue, useReducedMotion, useSpring, useTransform, useVelocity,
} from 'framer-motion'
import Femata, { type FemataMood, type FemataTone } from './Femata'
import { haptic } from '@/lib/haptics'

interface Props {
  /** How Femata feels right now; a pat swaps it for a moment. */
  mood: FemataMood
  tone?: FemataTone
  size?: number
  /** Remembers where Femata was dropped, one place per page. */
  spot?: string
  /** Distance from the bottom of the screen; above the tab bar by default. */
  bottom?: string
}

const SPOT_KEY = 'femata_spot_'

function readSpot(spot: string): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(SPOT_KEY + spot)
    if (raw) {
      const p = JSON.parse(raw) as { x: number; y: number }
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) return p
    }
  } catch { /* storage unavailable: the corner it is */ }
  return { x: 0, y: 0 }
}

/**
 * Femata floating near the bottom-right corner of a page, above the tab bar.
 *
 * Tap it and it wiggles and squishes like a patted cat, with heart eyes for
 * a moment. Drag it anywhere: it leans into the direction it is pulled,
 * stretches with the speed, looks thrilled about the ride, and lands with
 * a squash and a bounce where it is let go — and stays there next time.
 */
export default function FemataBuddy({ mood, tone = 'sky', size = 78, spot = 'today', bottom }: Props) {
  const controls = useAnimationControls()
  const reduced = useReducedMotion()
  const [patted, setPatted] = useState(false)
  const [dragging, setDragging] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  // Where it was left, as an offset from its corner.
  const start = useRef(readSpot(spot)).current
  const x = useMotionValue(start.x)
  const y = useMotionValue(start.y)
  // Leaning and stretching with the drag, sprung so it lags a touch behind
  // the finger like something with a bit of weight.
  const vx = useVelocity(x)
  const vy = useVelocity(y)
  const lean = useSpring(useTransform(vx, [-1500, 0, 1500], [-24, 0, 24]), { stiffness: 300, damping: 18 })
  const stretch = useSpring(useTransform(vy, [-1500, 0, 1500], [1.12, 1, 0.9]), { stiffness: 300, damping: 18 })
  const squash = useTransform(stretch, (s) => 2 - s)

  // Kept on screen: the whole window is the bounds.
  const bounds = useRef<HTMLDivElement>(null)

  function pat() {
    setPatted(true)
    haptic('pat')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setPatted(false), 1400)
    if (reduced) return
    void controls.start({
      rotate: [0, -14, 11, -8, 5, -2, 0],
      scaleX: [1, 1.12, 0.94, 1.06, 0.98, 1],
      scaleY: [1, 0.86, 1.08, 0.95, 1.02, 1],
      y: [0, 4, -10, 0, -3, 0],
      transition: { duration: 0.8, ease: 'easeOut' },
    })
  }

  function land() {
    setDragging(false)
    haptic('drop')
    try { localStorage.setItem(SPOT_KEY + spot, JSON.stringify({ x: x.get(), y: y.get() })) } catch { /* not remembered */ }
    if (reduced) return
    void controls.start({
      scaleX: [1, 1.18, 0.94, 1.04, 1],
      scaleY: [1, 0.8, 1.08, 0.97, 1],
      y: [0, 3, -8, 0, 0],
      transition: { duration: 0.55, ease: 'easeOut' },
    })
  }

  return (
    <>
      <div ref={bounds} aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: -1 }} />
      <motion.button
        type="button"
        onTap={() => { if (!dragging) pat() }}
        aria-label="Pat Femata"
        drag
        dragConstraints={bounds}
        dragElastic={0.12}
        dragMomentum={false}
        onDragStart={() => { setDragging(true); haptic('pick') }}
        onDragEnd={land}
        whileDrag={reduced ? undefined : { scale: 1.14 }}
        className="fixed z-20 touch-none rounded-full p-1"
        style={{
          x, y,
          right: 'max(14px, env(safe-area-inset-right))',
          bottom: bottom ?? 'calc(var(--tab-room, 104px) - 6px)',
          WebkitTapHighlightColor: 'transparent',
          cursor: dragging ? 'grabbing' : 'grab',
        }}
      >
        {/* A slow idle bob, so it looks alive before anyone touches it —
            still while it is being carried. */}
        {/* Each layer is its own composited layer (will-change), so the phone
            paints Femata once and only moves it; and the faces are drawn up
            front, so a pat or a drag swaps which one shows instead of
            building a new drawing mid-animation. */}
        <motion.span
          className="block"
          animate={reduced || dragging ? { y: 0 } : { y: [0, -4, 0] }}
          transition={dragging ? { duration: 0.2 } : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ willChange: 'transform' }}
        >
          <motion.span
            className="block"
            style={reduced ? undefined : { rotate: lean, scaleY: stretch, scaleX: squash, transformOrigin: '50% 80%', willChange: 'transform' }}
          >
            <motion.span className="relative block" animate={controls} style={{ transformOrigin: '30% 90%', willChange: 'transform' }}>
              <span className="block" style={{ opacity: patted || dragging ? 0 : 1 }}>
                <Femata mood={mood} tone={tone} size={size} />
              </span>
              <span className="absolute inset-0 block" style={{ opacity: patted && !dragging ? 1 : 0 }} aria-hidden="true">
                <Femata mood="in-love" tone="sunrise" size={size} />
              </span>
              <span className="absolute inset-0 block" style={{ opacity: dragging ? 1 : 0 }} aria-hidden="true">
                <Femata mood="excited" tone="pop" size={size} />
              </span>
            </motion.span>
          </motion.span>
        </motion.span>
      </motion.button>
    </>
  )
}
