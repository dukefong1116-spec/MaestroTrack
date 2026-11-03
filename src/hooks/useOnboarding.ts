import { useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { updateUserProfile } from '@/lib/firebase/teacher'
import { shouldTour } from '@/lib/utils/onboarding'

/**
 * Whether to show somebody round, and how that ends.
 *
 * Finishing and waving it away are kept apart on purpose: one is a thing
 * they did, the other a thing they chose, and the Settings screen that
 * offers the tour again needs to be able to tell.
 */
export function useOnboarding() {
  const { profile } = useAuth()
  const setProfile = useAuthStore((s) => s.setProfile)

  const show = useMemo(() => shouldTour(profile), [profile])

  const write = useCallback((patch: NonNullable<typeof profile>['onboarding']) => {
    const uid = profile?.uid
    if (!uid) return
    const latest = useAuthStore.getState().profile
    // Spread over whatever is live rather than this render's copy: two
    // writes close together would otherwise lose the first.
    const next = { ...(latest?.onboarding ?? {}), ...patch }
    if (latest) setProfile({ ...latest, onboarding: next })
    updateUserProfile(uid, { onboarding: next }).catch((e) => {
      console.error('[onboarding] could not save', e)
    })
  }, [profile?.uid, setProfile])

  const finish = useCallback(
    (reason: 'finished' | 'skipped') =>
      write(reason === 'finished'
        ? { completedAt: new Date().toISOString() }
        : { dismissed: true }),
    [write]
  )

  /**
   * Puts it back.
   *
   * Every flag written explicitly rather than merely left out:
   * updateUserProfile is a setDoc with merge:true, and a merge does not
   * remove keys it was not given — omitting `dismissed` left it set, and
   * the button did nothing at all.
   */
  const replay = useCallback(
    () => write({ dismissed: false, completedAt: '' }),
    [write]
  )

  return { show, finish, replay }
}
