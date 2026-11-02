import { useNavigate } from 'react-router-dom'
import BadgeArt, { type BadgeArtName } from './BadgeArt'
import { useGamification } from '@/hooks/useGamification'
import { usePinnedBadges } from '@/hooks/usePinnedBadges'
import { BADGES, isEarned } from '@/lib/utils/progression'

/**
 * The badges chosen for Today, inside the greeting card.
 *
 * Artwork only: the names are already on the badges' own screen, and
 * three labels across a phone truncated every one of them to "Firs…".
 *
 * Spacing is derived from the art's own 6/120 inset rather than picked, so
 * the row keeps the same proportions at any size — enough air to read as
 * three badges, not enough to stop reading as one row.
 *
 * Renders nothing at all when none are pinned.
 */
export default function PinnedBadges({ size = 44 }: { size?: number }) {
  const navigate = useNavigate()
  const { pinned } = usePinnedBadges()
  const { badgeCtx } = useGamification()

  // A badge can in principle stop qualifying; nothing here assumes it cannot.
  const shown = pinned
    .map((id) => BADGES.find((b) => b.id === id))
    .filter((b): b is NonNullable<typeof b> => !!b && isEarned(b, badgeCtx))

  if (shown.length === 0) return null

  /** The art is inset by 6 in a 120 box; one of those is the unit here. */
  const inset = Math.round((6 / 120) * size * 2)

  return (
    <button
      type="button"
      onClick={() => navigate('/student/progress')}
      aria-label={`${shown.length} pinned badge${shown.length === 1 ? '' : 's'} — open Progress`}
      className="flex items-center transition-transform active:scale-95"
      style={{ gap: inset }}
    >
      {shown.map((b) => (
        <BadgeArt key={b.id} name={b.id as BadgeArtName} size={size} className="shrink-0" />
      ))}
    </button>
  )
}
