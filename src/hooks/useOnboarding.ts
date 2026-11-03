import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { usePracticeStore } from '@/stores/practiceStore'
import { updateUserProfile } from '@/lib/firebase/teacher'
import {
  onboardingState, shouldCoach, type OnboardingContext, type StepId,
} from '@/lib/utils/onboarding'

/**
 * The first-run checklist, wired to the data it reads.
 *
 * Nothing here decides whether a step is done — onboarding.ts does, from
 * the same sessions and pieces every other screen reads. This supplies
 * them, records the one step that leaves no evidence, and closes the list
 * when it is finished.
 */
export function useOnboarding() {
  const { profile } = useAuth()
  const setProfile = useAuthStore((s) => s.setProfile)
  const { sessions, pieces, recordings } = usePracticeStore()

  const seen = useMemo(() => profile?.onboarding?.seen ?? [], [profile?.onboarding?.seen])

  const ctx: OnboardingContext = useMemo(() => ({
    sessions, pieces, recordings, profile, seen,
    today: format(new Date(), 'yyyy-MM-dd'),
  }), [sessions, pieces, recordings, profile, seen])

  const state = useMemo(() => onboardingState(ctx), [ctx])
  const show = useMemo(() => shouldCoach(ctx), [ctx])

  /** One write, read back against whatever is live rather than this render. */
  const write = useCallback((patch: NonNullable<typeof profile>['onboarding']) => {
    const uid = profile?.uid
    if (!uid) return
    const latest = useAuthStore.getState().profile
    const next = { ...(latest?.onboarding ?? {}), ...patch }
    if (latest) setProfile({ ...latest, onboarding: next })
    updateUserProfile(uid, { onboarding: next }).catch((e) => {
      console.error('[onboarding] could not save progress', e)
    })
  }, [profile?.uid, setProfile])

  /** Marks a step that the data cannot show — visiting a page. */
  const markSeen = useCallback((id: StepId) => {
    const latest = useAuthStore.getState().profile
    const already = latest?.onboarding?.seen ?? []
    if (already.includes(id)) return
    write({ seen: [...already, id] })
  }, [write])

  const dismiss = useCallback(() => write({ dismissed: true }), [write])

  /**
   * Closing the list the moment it is finished, rather than on the next
   * visit. Written once: completedAt is what stops this firing again, and
   * it is also what keeps the list shut if a step later reads as undone
   * because somebody deleted their only piece.
   */
  useEffect(() => {
    if (!profile?.uid) return
    if (!state.complete) return
    if (profile.onboarding?.completedAt) return
    write({ completedAt: new Date().toISOString() })
  }, [state.complete, profile?.uid, profile?.onboarding?.completedAt, write])

  /**
   * Finishing deserves a moment, and it has to survive the walk back.
   *
   * The first version watched `show` flip false while the card was
   * mounted, which meant it only ever fired if you happened to be looking
   * at Today. The last step is "have a look at Progress" — so you finish
   * on a different screen every time, come back, and the card is simply
   * gone. Nobody would ever have seen it.
   *
   * So it is a flag, not a transition: shown whenever the list is
   * finished and the moment has not been had yet, and written the instant
   * it goes up so it cannot be had twice.
   */
  const celebrated = profile?.onboarding?.celebrated === true
  const owed = state.complete && !celebrated && !profile?.onboarding?.dismissed
  const [celebrating, setCelebrating] = useState(false)

  useEffect(() => {
    if (!owed || !profile?.uid) return
    setCelebrating(true)
    write({ celebrated: true })
    const t = setTimeout(() => setCelebrating(false), 5000)
    return () => clearTimeout(t)
  }, [owed, profile?.uid, write])

  return {
    ...state,
    show,
    /** Whether the card should be on screen at all, celebration included. */
    visible: show || celebrating,
    celebrating,
    markSeen,
    dismiss,
  }
}
