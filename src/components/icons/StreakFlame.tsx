import { useId } from 'react'
import { streakHeat } from '@/lib/utils/streakHeat'
import { lookFor, UNLIT, ICED, FLAME_PATH, CORE_PATH } from '@/lib/streak/looks'

/**
 * Streak flame.
 *
 * Not a lucide-style line icon — this one is filled and gradient-mapped.
 * Its colour is the streak's look (Spark, Blaze, Gold, Blue, Violet — see
 * lib/streak/looks), and it grows and flickers faster as the streak heats
 * up. Grey until today is practised; held in ice after a freeze, until the
 * next practice thaws it.
 */

export type FlameState = 'lit' | 'unlit' | 'frozen'

interface StreakFlameProps {
  /** Current streak in days. Drives colour, scale and flicker speed. */
  streak: number
  size?: number
  /** Disable the flicker animation (reduced-motion, or static contexts). */
  still?: boolean
  /** Lit unless told otherwise. A streak of 0 is always unlit. */
  state?: FlameState
  /** Frozen colours without the ice block — for animations that bring
   *  the ice in themselves. */
  bare?: boolean
  className?: string
}

export default function StreakFlame({ streak, size = 24, still, state = 'lit', bare, className }: StreakFlameProps) {
  const uid = useId().replace(/:/g, '')
  const heat = streakHeat(streak)
  const mode: FlameState = streak <= 0 ? 'unlit' : state
  const c = mode === 'frozen' ? ICED : mode === 'unlit' ? UNLIT : lookFor(streak)
  const dim = mode === 'unlit'
  const moving = !still && mode === 'lit'

  // Hotter streaks flicker faster and a touch wider.
  const period = 2.6 - heat * 1.1
  const scale = mode === 'lit' ? 1 + heat * 0.06 : 1

  const label = streak <= 0
    ? 'No active streak'
    : `${streak} day streak${mode === 'frozen' ? ', frozen' : mode === 'unlit' ? ', not yet practised today' : ''}`

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', position: 'relative', lineHeight: 0, transform: `scale(${scale})` }}
      aria-label={label}
      role="img"
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient id={`fl-${uid}`} x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={c.mid} />
            <stop offset="55%" stopColor={c.outer} />
            <stop offset="100%" stopColor={c.outer} />
          </linearGradient>
          <linearGradient id={`fc-${uid}`} x1="12" y1="10" x2="12" y2="21" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={c.core} />
            <stop offset="100%" stopColor={c.mid} />
          </linearGradient>
        </defs>

        {/* outer flame */}
        <path d={FLAME_PATH} fill={`url(#fl-${uid})`} opacity={dim ? 0.45 : 1}>
          {moving && (
            <animate attributeName="opacity" values="1;0.88;1" dur={`${period}s`} repeatCount="indefinite" />
          )}
        </path>

        {/* inner core */}
        <path d={CORE_PATH} fill={`url(#fc-${uid})`} opacity={dim ? 0.3 : 0.95}>
          {moving && (
            <animateTransform
              attributeName="transform"
              type="scale"
              additive="sum"
              values="1 1; 1 0.88; 1 1"
              dur={`${period * 0.62}s`}
              repeatCount="indefinite"
            />
          )}
        </path>
      </svg>
      {mode === 'frozen' && !bare && <IceBlock size={size} />}
    </span>
  )
}

/**
 * A block of clear ice around the flame. Positioned over its parent, so
 * the parent must be the flame's own box (StreakFlame's span is).
 */
export function IceBlock({ size, className, style }: { size: number; className?: string; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden
      className={className}
      style={{
        position: 'absolute',
        left: -size * 0.12,
        top: -size * 0.06,
        width: size * 1.24,
        height: size * 1.12,
        borderRadius: size * 0.24,
        background: 'rgba(196,224,250,.48)',
        border: `${Math.max(1, size / 30)}px solid rgba(80,150,220,.55)`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.7)',
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <span style={{ position: 'absolute', left: '16%', top: '9%', width: '9%', height: '44%', borderRadius: 4, background: 'rgba(255,255,255,.7)', transform: 'rotate(16deg)' }} />
      <span style={{ position: 'absolute', left: '31%', top: '7%', width: '4%', height: '20%', borderRadius: 3, background: 'rgba(255,255,255,.6)', transform: 'rotate(16deg)' }} />
    </span>
  )
}
