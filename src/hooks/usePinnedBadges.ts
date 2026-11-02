import { useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { updateUserProfile } from '@/lib/firebase/teacher'

/** Three fits under the greeting without the strip becoming a wall. */
export const MAX_PINNED = 3

/**
 * The badges chosen for Today.
 *
 * Order is the order they were pinned, so the strip stays the person's
 * arrangement rather than whatever the badge list happens to be in. The
 * cap is enforced here rather than in the UI, so nothing can write a
 * fourth by another route.
 */
export function usePinnedBadges() {
  const { profile, user } = useAuth()
  const { setProfile } = useAuthStore()

  const pinned = useMemo(
    () => (profile?.pinnedBadges ?? []).slice(0, MAX_PINNED),
    [profile?.pinnedBadges]
  )

  const togglePin = useCallback((id: string) => {
    const uid = profile?.uid ?? user?.uid
    const next = pinned.includes(id)
      ? pinned.filter((b) => b !== id)
      : [...pinned, id].slice(0, MAX_PINNED)

    // Optimistic: a pin that waits on a round trip feels broken.
    if (profile) setProfile({ ...profile, pinnedBadges: next, updatedAt: new Date().toISOString() })
    if (!uid) return
    updateUserProfile(uid, { pinnedBadges: next }).catch((e) => {
      console.error('[badges] could not save pins', e)
    })
  }, [pinned, profile, user?.uid, setProfile])

  return { pinned, togglePin, full: pinned.length >= MAX_PINNED }
}
