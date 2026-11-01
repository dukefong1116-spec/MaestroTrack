import { getTheme } from '@/lib/utils/instruments'
import { cn } from '@/lib/utils/cn'
import type { InstrumentType } from '@/types'

/**
 * Someone's face, or a stand-in for it.
 *
 * With no photo set this falls back to the instrument gradient the sidebar
 * logo tile already uses, with initials on top — so an account that has
 * never uploaded anything still looks deliberate rather than empty, and
 * the fallback is not a new visual idea.
 */

function initialsFor(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface AvatarProps {
  src?: string | null
  name?: string | null
  instrument?: InstrumentType
  size?: number
  className?: string
}

export default function Avatar({ src, name, instrument, size = 60, className }: AvatarProps) {
  const common = {
    width: size,
    height: size,
    borderRadius: '50%',
    boxShadow: 'var(--clay-raised)',
  } as const

  if (src) {
    return (
      <img
        // Decorative: every place this is used puts the person's name beside
        // it, and a second reading of the same name is noise to a screen
        // reader rather than help.
        alt=""
        src={src}
        className={cn('shrink-0 object-cover', className)}
        style={{ ...common, background: 'var(--clay-bg-deep)' }}
      />
    )
  }

  const theme = getTheme(instrument)
  return (
    <span
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center font-bold text-white', className)}
      style={{
        ...common,
        background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
        fontSize: Math.round(size * 0.34),
        letterSpacing: '.5px',
      }}
    >
      {initialsFor(name)}
    </span>
  )
}
