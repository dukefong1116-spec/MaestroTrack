import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { publishAndShare } from '@/lib/share/link'
import { BADGES } from '@/lib/utils/progression'

/**
 * Publishing a badge as a link.
 *
 * Only the badge's own name and the date it was won leave the device —
 * no session, no notes, no piece. The name rides along on the same
 * opt-in the session card uses, which is on by default.
 */
export function useShareBadge() {
  const { profile } = useAuth()
  const [shareNote, setShareNote] = useState<string | null>(null)
  async function shareBadge(id: string) {
    const uid = profile?.uid
    const badge = BADGES.find((b) => b.id === id)
    if (!uid || !badge) return
    const wonAt = profile?.badgeEarnedAt?.[id]
    const outcome = await publishAndShare(uid, 'badge', {
      minutes: 0,
      dateLabel: wonAt ? new Date(wonAt).toLocaleDateString(undefined, { dateStyle: 'long' }) : '',
      ...(profile?.displayName ? { name: profile.displayName } : {}),
      badgeId: badge.id,
      badgeLabel: badge.label,
    }, `I earned ${badge.label} on MutifTrack`)
    if (outcome === 'cancelled') return
    setShareNote(outcome === 'failed' ? 'Could not publish the link.' : outcome === 'shared' ? 'Shared' : 'Link copied')
    setTimeout(() => setShareNote(null), 2200)
  }
  return { shareBadge, shareNote }
}
