import { useId } from 'react'

/**
 * Streak flame.
 *
 * Not a lucide-style line icon — this one is filled and gradient-mapped
 * because its whole job is to look hotter as the streak grows. The palette
 * walks from a dull ember through coral to a white-hot core.
 */

interface StreakFlameProps {
  /** Current streak in days. Drives colour, scale and flicker speed. */
  streak: number
  size?: number
  /** Disable the flicker animation (reduced-motion, or static contexts). */
  still?: boolean
  className?: string
}

/** Maps a streak length onto a 0..1 heat value with diminishing returns. */
export function streakHeat(streak: number): number {
  if (streak <= 0) return 0
  // 1 day -> .18, 7 -> .55, 30 -> .85, 100+ -> ~1
  return Math.min(1, Math.log10(streak + 1) / 2.1)
}

function ramp(heat: number) {
  if (heat === 0) return { outer: '#BFBBB4', mid: '#D8D4CD', core: '#E8E4DC' }
  if (heat < 0.3) return { outer: '#C4761E', mid: '#E09030', core: '#F5C36A' }
  if (heat < 0.5) return { outer: '#D4541C', mid: '#EE7B32', core: '#FFC46B' }
  if (heat < 0.7) return { outer: '#E8503A', mid: '#FA7A48', core: '#FFD08A' }
  if (heat < 0.88) return { outer: '#E8362A', mid: '#FF6B43', core: '#FFF0C4' }
  return { outer: '#D62828', mid: '#FF5A2B', core: '#FFFFFF' }
}

export default function StreakFlame({ streak, size = 24, still, className }: StreakFlameProps) {
  const uid = useId().replace(/:/g, '')
  const heat = streakHeat(streak)
  const c = ramp(heat)
  const dim = heat === 0

  // Hotter streaks flicker faster and a touch wider.
  const period = 2.6 - heat * 1.1
  const scale = 1 + heat * 0.06

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', lineHeight: 0, transform: `scale(${scale})` }}
      aria-label={streak > 0 ? `${streak} day streak` : 'No active streak'}
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
        <path
          d="M12.6 1.7c.2 2 1 3.3 2.4 4.9 1.9 2.2 3.5 4.1 3.5 7.2A6.5 6.5 0 0 1 5.5 14c0-2.2.9-3.6 2.2-5.2.5.6.7 1.3.7 2.2 1.6-1.1 2.8-3 2.8-5.2 0-1.5-.3-2.8-.9-4.1 1 .1 1.8.3 2.3 0Z"
          fill={`url(#fl-${uid})`}
          opacity={dim ? 0.45 : 1}
        >
          {!still && !dim && (
            <animate
              attributeName="opacity"
              values="1;0.88;1"
              dur={`${period}s`}
              repeatCount="indefinite"
            />
          )}
        </path>

        {/* inner core */}
        <path
          d="M12 11.4c1.5 1.3 2.6 2.7 2.6 4.4a2.75 2.75 0 0 1-5.5 0c0-1.5.9-2.8 2.9-4.4Z"
          fill={`url(#fc-${uid})`}
          opacity={dim ? 0.3 : 0.95}
        >
          {!still && !dim && (
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
    </span>
  )
}
