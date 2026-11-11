import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { useAuthStore } from '@/stores/authStore'
import { usePracticeStore } from '@/stores/practiceStore'
import { useMinuteTick } from '@/hooks/useMinuteTick'
import { walkStreak, freezesToSpend, type StreakWalk } from '@/lib/streak/engine'
import { localDay } from '@/lib/streak/plan'
import { recordStreakFreezes, recordStreakRepair } from '@/lib/firebase/teacher'

export type Streak = StreakWalk & { today: string }

/**
 * Your streak, live: the session log and your profile, through the engine,
 * re-read as the day turns over. Every screen that shows a streak reads it
 * here, so none of them can disagree.
 */
export function useStreak(): Streak {
  const profile = useAuthStore((s) => s.profile)
  const sessions = usePracticeStore((s) => s.sessions)
  const today = localDay(useMinuteTick())
  const rules = profile?.streakRules
  const frozen = profile?.streakFreezesUsed
  const repaired = profile?.streakRepaired
  return useMemo(
    () => ({ ...walkStreak({ sessions, rules, frozen, repaired, today }), today }),
    [sessions, rules, frozen, repaired, today]
  )
}

/** A freeze just spent, waiting for Today to show it. */
export interface FreezeEvent {
  /** Whose — a moment queued for one account is never shown to another. */
  uid: string
  streak: number
  days: string[]
  remaining: number
}

interface StreakMoments {
  freeze: FreezeEvent | null
  setFreeze: (f: FreezeEvent | null) => void
}

export const useStreakMoments = create<StreakMoments>((set) => ({
  freeze: null,
  setFreeze: (freeze) => set({ freeze }),
}))

// Module-level, because DataProvider mounts afresh on some routes and a
// write already on its way must not be sent twice.
const inFlight = new Set<string>()

/**
 * Decisions the app makes for you, once the log is loaded: spending a
 * freeze on a missed day, and recording a comeback you completed. Both are
 * append-only writes (arrayUnion), so a second tab doing the same merges.
 */
export function useStreakUpkeep(uid: string | undefined) {
  const loaded = usePracticeStore((s) => s.sessionsLoaded)
  // Spending freezes needs the server's own list of them, not the copy
  // saved on this device.
  const profileLive = useAuthStore((s) => s.profileLive)
  const streak = useStreak()

  useEffect(() => {
    if (!uid || !loaded || !profileLive) return
    const { setProfile } = useAuthStore.getState()

    const spend = freezesToSpend(streak)
    if (spend.length) {
      const key = `${uid}|freeze|${spend.join(',')}`
      if (inFlight.has(key)) return
      inFlight.add(key)
      recordStreakFreezes(uid, spend)
        .then(() => {
          const latest = useAuthStore.getState().profile
          const frozen = [...new Set([...(latest?.streakFreezesUsed ?? []), ...spend])]
          if (latest) setProfile({ ...latest, streakFreezesUsed: frozen })
          // The streak as it stands now that the gap is covered.
          const after = walkStreak({
            sessions: usePracticeStore.getState().sessions,
            rules: latest?.streakRules,
            frozen,
            repaired: latest?.streakRepaired,
            today: streak.today,
          })
          useStreakMoments.getState().setFreeze({ uid, streak: after.current, days: spend, remaining: after.held })
        })
        .catch(() => { inFlight.delete(key) })
      return
    }

    const back = streak.comeback
    if (back?.complete) {
      const key = `${uid}|repair|${back.missed}`
      if (inFlight.has(key)) return
      inFlight.add(key)
      recordStreakRepair(uid, back.missed)
        .then(() => {
          const latest = useAuthStore.getState().profile
          if (latest) setProfile({ ...latest, streakRepaired: [...new Set([...(latest.streakRepaired ?? []), back.missed])] })
        })
        .catch(() => { inFlight.delete(key) })
    }
  }, [uid, loaded, profileLive, streak])
}
