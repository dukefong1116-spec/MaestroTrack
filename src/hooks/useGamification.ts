import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { usePracticeStore } from '@/stores/practiceStore'
import { computeStreak } from '@/lib/utils/analytics'
import {
  decideFreezes, freezesAvailable, weekStrip, type WeekDay,
} from '@/lib/utils/streakFreeze'
import {
  computeProgression, buildBadgeContext, earnedBadges, badgeFamilies,
  type BadgeDef, type BadgeContext, type FamilyState, type Progression,
} from '@/lib/utils/progression'
import { recordStreakFreezes, markBadgesSeen, markMasteryPrompted, recordBadgesEarned } from '@/lib/firebase/teacher'
import { updatePiece } from '@/lib/firebase/pieces'
import { findMasteryCandidate, type MasteryCandidate } from '@/lib/utils/mastery'

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
  /** The numbers every badge is measured against — the grid and the detail
   *  sheet both read these, so neither can disagree with the other. */
  badgeCtx: BadgeContext
  /** Badges grouped into ladders, one per family, as the grid shows them. */
  families: FamilyState[]
  /** Queued moments — show one at a time, oldest first. */
  pendingBadge: BadgeDef | null
  pendingFreeze: FreezeEvent | null
  pendingMastery: MasteryCandidate | null
  dismissBadge: () => void
  dismissFreeze: () => void
  /** "Not yet" — records the prompt so the piece is never offered again. */
  dismissMastery: () => void
  /** "Mastered" — flips the piece and records the prompt. */
  confirmMastery: () => void
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
  const { sessions, pieces } = usePracticeStore()

  const frozen = useMemo(() => profile?.streakFreezesUsed ?? [], [profile?.streakFreezesUsed])
  const seen = useMemo(() => profile?.badgesSeen ?? [], [profile?.badgesSeen])
  const earnedAt = useMemo(() => profile?.badgeEarnedAt ?? {}, [profile?.badgeEarnedAt])
  const masteryPrompted = useMemo(
    () => profile?.masteryPromptsSeen ?? [],
    [profile?.masteryPromptsSeen]
  )
  const dailyGoal = Math.round((profile?.weeklyGoalMinutes ?? 300) / 7)

  const { current: streak, longest: longestStreak } = useMemo(
    () => computeStreak(sessions, frozen),
    [sessions, frozen]
  )

  const week = useMemo(() => weekStrip(sessions, frozen), [sessions, frozen])
  const progression = useMemo(() => computeProgression(sessions, dailyGoal), [sessions, dailyGoal])

  // The level goes in rather than being patched over the top afterwards —
  // buildBadgeContext no longer invents one.
  const badgeCtx = useMemo(
    () => buildBadgeContext(sessions, frozen, progression.level),
    [sessions, frozen, progression.level]
  )
  const badges = useMemo(() => earnedBadges(badgeCtx), [badgeCtx])
  const families = useMemo(() => badgeFamilies(badgeCtx), [badgeCtx])

  // Derived, not queued: if the data still says the piece is ready, the
  // prompt is still valid. Answering either way writes the piece id, which
  // removes it from consideration for good.
  const pendingMastery = useMemo(
    () => findMasteryCandidate(pieces, sessions, masteryPrompted),
    [pieces, sessions, masteryPrompted]
  )

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
    const nextUsed = [...new Set([...frozen, ...decision.freeze])]

    recordStreakFreezes(profile.uid, decision.freeze)
      .then(() => {
        // Reflect locally so the streak reads correctly straight away —
        // against the live profile, not this render's copy.
        const latest = useAuthStore.getState().profile ?? profile
        // Union against whatever is live, so this cannot drop dates another
        // write added in the meantime — mirroring the arrayUnion on the server.
        const merged = [...new Set([...(latest.streakFreezesUsed ?? []), ...decision.freeze])]
        setProfile({ ...latest, streakFreezesUsed: merged })
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

  // ── queue unseen badges, and stamp when they were won ────────────────
  useEffect(() => {
    if (!profile?.uid) return

    // The date goes in the moment the app first sees the badge earned, not
    // when the celebration is dismissed: someone who never comes back still
    // won it today. Ids that already carry a date are skipped, or a merge
    // would push it forward every time this ran.
    const undated = badges.filter((b) => !earnedAt[b.id]).map((b) => b.id)
    if (undated.length > 0) {
      const at = new Date().toISOString()
      recordBadgesEarned(profile.uid, undated, at)
        .then(() => {
          const latest = useAuthStore.getState().profile
          if (!latest) return
          const merged = { ...(latest.badgeEarnedAt ?? {}) }
          for (const id of undated) if (!merged[id]) merged[id] = at
          setProfile({ ...latest, badgeEarnedAt: merged })
        })
        .catch(() => {})
    }

    const unseen = badges.filter((b) => !seen.includes(b.id))
    if (unseen.length === 0) return

    setBadgeQueue((q) => {
      const known = new Set(q.map((b) => b.id))
      const additions = unseen.filter((b) => !known.has(b.id))
      return additions.length ? [...q, ...additions] : q
    })
  }, [badges, seen, earnedAt, profile?.uid, setProfile])

  function dismissBadge() {
    const shown = badgeQueue[0]
    setBadgeQueue((q) => q.slice(1))
    if (!shown || !profile?.uid) return

    markBadgesSeen(profile.uid, [shown.id])
      .then(() => {
        // Read the live profile rather than this render's closure. Dismissing
        // two badges in quick succession resolved both writes against the
        // same stale `seen`, so the second overwrote the first locally — and
        // the queue effect, seeing it unseen again, replayed its celebration.
        // (arrayUnion meant the server was always right; only the UI lied.)
        const latest = useAuthStore.getState().profile
        if (!latest) return
        if (latest.badgesSeen?.includes(shown.id)) return
        setProfile({ ...latest, badgesSeen: [...(latest.badgesSeen ?? []), shown.id] })
      })
      .catch(() => {})
  }

  function recordMasteryPrompt(pieceId: string) {
    if (!profile?.uid) return
    markMasteryPrompted(profile.uid, [pieceId])
      .then(() => {
        const latest = useAuthStore.getState().profile
        if (!latest) return
        const prompted = latest.masteryPromptsSeen ?? []
        if (prompted.includes(pieceId)) return
        setProfile({ ...latest, masteryPromptsSeen: [...prompted, pieceId] })
      })
      .catch(() => {})
  }

  function dismissMastery() {
    if (pendingMastery) recordMasteryPrompt(pendingMastery.piece.id)
  }

  function confirmMastery() {
    if (!pendingMastery) return
    const id = pendingMastery.piece.id
    // completionPercentage is derived from status for a mastered piece, so
    // only the status needs writing here.
    updatePiece(id, { status: 'mastered' }).catch(() => {})
    recordMasteryPrompt(id)
  }

  return {
    streak,
    longestStreak,
    freezesLeft: freezesAvailable(longestStreak, frozen),
    week,
    progression,
    badges,
    badgeCtx,
    families,
    // A freeze always takes priority — it explains why the streak survived.
    pendingBadge: pendingFreeze ? null : (badgeQueue[0] ?? null),
    pendingFreeze,
    // One moment at a time, and mastery yields to both — the streak rescue
    // and the badge auto-dismiss, whereas this one waits for an answer.
    pendingMastery: pendingFreeze || badgeQueue.length > 0 ? null : pendingMastery,
    dismissBadge,
    dismissFreeze: () => setPendingFreeze(null),
    dismissMastery,
    confirmMastery,
  }
}
