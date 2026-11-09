import { useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { updateUserProfile } from '@/lib/firebase/teacher'
import type { TourCheckpoint, UserProfile } from '@/types'

type Onboarding = NonNullable<UserProfile['onboarding']>

/**
 * Moving the tour on, and remembering it.
 *
 * Writes are optimistic: the local profile changes at once, so the next
 * step shows without waiting on the network, and the save follows. Each
 * write spreads over the live profile rather than a render's copy, so two
 * in quick succession cannot lose the first.
 */
export function useTour() {
  const write = useCallback((patch: Partial<Onboarding>) => {
    const latest = useAuthStore.getState().profile
    if (!latest?.uid) return
    const next = { ...(latest.onboarding ?? {}), ...patch }
    useAuthStore.getState().setProfile({ ...latest, onboarding: next })
    updateUserProfile(latest.uid, { onboarding: next }).catch((e) => {
      console.error('[tour] could not save', e)
    })
  }, [])

  const setTour = useCallback((tour: TourCheckpoint) => write(
    tour === 'done'
      ? { tour, replay: false, completedAt: new Date().toISOString() }
      : { tour }
  ), [write])

  const markSeen = useCallback((id: string) => {
    const seen = useAuthStore.getState().profile?.onboarding?.seen ?? []
    if (!seen.includes(id)) write({ seen: [...seen, id] })
  }, [write])

  /** From Settings: the whole thing again, but skippable this time. */
  const replay = useCallback(() => write({ tour: 'welcome', replay: true }), [write])

  return { setTour, markSeen, replay }
}
