import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { usePracticeStore } from '@/stores/practiceStore'
import { computeStreak } from '@/lib/utils/analytics'
import {
  decideFreezes, freezesAvailable, weekStrip, type WeekDay,
} from '@/lib/utils/streakFreeze'
import {
  computeProgression, buildBadgeContext, earnedBadges, type BadgeDef, type Progression,
} from '@/lib/utils/progression'
import { recordStreakFreezes, markBadgesSeen } from '@/lib/firebase/teacher'

export interface FreezeEvent {
  streak: number
  daysFrozen: number
  remaining: number
}

export interface Gamification {
  streak: number
  longestStreak: number
  freezesLeft: number
  week: WeekDay[]
  progression: Progression
  badges: BadgeDef[]
  /** Queued moments — show one at a time, oldest first. */
  pendingBadge: BadgeDef | null
  pendingFreeze: FreezeEvent | null
  dismissBadge: () => void
  dismissFreeze: () => void
}

/**
 * Single source of gamification state.
 *
 * Two side effects run here, both guarded so they fire once:
 *  - spending a freeze to rescue a lapsed streak
 *  - recording that a badge's unlock animation has been shown
 *
 * Both write through arrayUnion, so a second tab racing this merges
 * rather than clobbering.
 */
export function useGamification(): Gamification {
  const { profile } = useAuth()
  const setProfile = useAuthStore((s) => s.setProfile)
  const { sessions } = usePracticeStore()

  const frozen = useMemo(() => profile?.streakFreezesUsed ?? [], [profile?.streakFreezesUsed])
  const seen = useMemo(() => profile?.badgesSeen ?? [], [profile?.badgesSeen])
  const dailyGoal = Math.round((profile?.weeklyGoalMinutes ?? 300) / 7)

  const { current: streak, longest: longestStreak } = useMemo(
    () => computeStreak(sessions, frozen),
    [sessions, frozen]
  )

  const week = useMemo(() => weekStrip(sessions, frozen), [sessions, frozen])
  const progression = useMemo(() => computeProgression(sessions, dailyGoal), [sessions, dailyGoal])

  const badgeCtx = useMemo(
    () => ({ ...buildBadgeContext(sessions, frozen), level: progression.level }),
    [sessions, frozen, progression.level]
  )
  const badges = useMemo(() => earnedBadges(badgeCtx), [badgeCtx])

  const [pendingFreeze, setPendingFreeze] = useState<FreezeEvent | null>(null)
  const [badgeQueue, setBadgeQueue] = useState<BadgeDef[]>([])

  // ── spend a freeze, at most once per mount ───────────────────────────
  const freezeAttempted = useRef(false)
  useEffect(() => {
    if (freezeAttempted.current) return
    if (!profile?.uid || sessions.length === 0) return

    const decision = decideFreezes(sessions, frozen, longestStreak)
    if (decision.freeze.length === 0) return

    freezeAttempted.current = true
    const nextUsed = [...frozen, ...decision.freeze]

    recordStreakFreezes(profile.uid, decision.freeze)
      .then(() => {
        // Reflect locally so the streak reads correctly straight away.
        setProfile({ ...profile, streakFreezesUsed: nextUsed })
        setPendingFreeze({
          streak: decision.rescuedStreak,
          daysFrozen: decision.freeze.length,
          remaining: freezesAvailable(longestStreak, nextUsed),
        })
      })
      .catch(() => {
        // Write failed — leave the streak as it really is rather than
        // showing a rescue we could not persist.
        freezeAttempted.current = false
      })
  }, [profile, sessions, frozen, longestStreak, setProfile])

  // ── queue unseen badges ──────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.uid) return
    const unseen = badges.filter((b) => !seen.includes(b.id))
    if (unseen.length === 0) return

    setBadgeQueue((q) => {
      const known = new Set(q.map((b) => b.id))
      const additions = unseen.filter((b) => !known.has(b.id))
      return additions.length ? [...q, ...additions] : q
    })
  }, [badges, seen, profile?.uid])

  function dismissBadge() {
    const shown = badgeQueue[0]
    setBadgeQueue((q) => q.slice(1))
    if (shown && profile?.uid) {
      markBadgesSeen(profile.uid, [shown.id])
        .then(() => setProfile({ ...profile, badgesSeen: [...seen, shown.id] }))
        .catch(() => {})
    }
  }

  return {
    streak,
    longestStreak,
    freezesLeft: freezesAvailable(longestStreak, frozen),
    week,
    progression,
    badges,
    // A freeze always takes priority — it explains why the streak survived.
    pendingBadge: pendingFreeze ? null : (badgeQueue[0] ?? null),
    pendingFreeze,
    dismissBadge,
    dismissFreeze: () => setPendingFreeze(null),
  }
}
