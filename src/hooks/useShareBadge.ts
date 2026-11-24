import { useAuth } from '@/hooks/useAuth'
import { BADGES } from '@/lib/utils/progression'
import { openShare } from '@/stores/shareStore'
import { badgeShare } from '@/lib/share/moments'

/**
 * Sharing a badge already won: the share window, with the badge's own
 * card. Only the badge, the date it was won and (if "My name" is on) the
 * name leave the device.
 */
export function useShareBadge() {
  const { profile } = useAuth()
  function shareBadge(id: string) {
    const badge = BADGES.find((b) => b.id === id)
    if (!badge) return
    openShare(badgeShare(badge, profile?.badgeEarnedAt?.[id], profile?.displayName))
  }
  return { shareBadge, shareNote: null as string | null }
}
