import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import BadgeArt, { type BadgeArtName } from './BadgeArt'
import { useGamification } from '@/hooks/useGamification'
import { usePinnedBadges } from '@/hooks/usePinnedBadges'
import { BADGES, isEarned } from '@/lib/utils/progression'

/**
 * The badges chosen for Today, directly under the greeting.
 *
 * Its own strip rather than chips in the hero's badge row: at chip size
 * the artwork is a smudge, and that row already carries the instrument,
 * the experience level and the streak.
 *
 * Renders nothing at all when none are pinned — an empty slot invites a
 * tap that leads nowhere.
 */
export default function PinnedBadges() {
  const navigate = useNavigate()
  const { pinned } = usePinnedBadges()
  const { badgeCtx } = useGamification()

  // A badge can stop qualifying — a streak badge is won on `longestStreak`
  // so in practice it stays won, but nothing here assumes that.
  const shown = pinned
    .map((id) => BADGES.find((b) => b.id === id))
    .filter((b): b is NonNullable<typeof b> => !!b && isEarned(b, badgeCtx))

  if (shown.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3"
    >
      {shown.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => navigate('/student/progress')}
          title={b.description}
          // Stacked, not side by side: three tiles across 390px leaves about
          // 70px for a label beside the artwork, which truncated every name
          // to "Firs…". Vertically each tile gets the full width.
          className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-[var(--clay-r-md)] px-2 py-3 transition-transform active:scale-[.97]"
          style={{ background: 'var(--clay-surface)', boxShadow: 'var(--clay-raised)' }}
        >
          <BadgeArt name={b.id as BadgeArtName} size={40} className="shrink-0" />
          <span
            className="block w-full truncate text-center text-[11.5px] font-semibold leading-tight"
            style={{ color: 'var(--clay-ink)' }}
          >
            {b.label}
          </span>
        </button>
      ))}
    </motion.div>
  )
}
