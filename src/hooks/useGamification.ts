import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { usePracticeStore } from '@/stores/practiceStore'
import { weekStrip, type WeekDay } from '@/lib/utils/streakFreeze'
import { useStreak, useStreakMoments, type FreezeEvent } from '@/hooks/useStreak'
import { planOf } from '@/lib/streak/plan'
import {
  computeProgression, buildBadgeContext, earnedBadges, badgeFamilies,
  type BadgeDef, type BadgeContext, type FamilyState, type Progression,
} from '@/lib/utils/progression'
import {
  markBadgesSeen, markMasteryPrompted, recordBadgesEarned,
  updateUserProfile,
} from '@/lib/firebase/teacher'
import { MAX_PINNED } from '@/hooks/usePinnedBadges'
import { updatePiece } from '@/lib/firebase/pieces'
import { findMasteryCandidate, type MasteryCandidate } from '@/lib/utils/mastery'

export type { FreezeEvent }

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
 * Side effects here are guarded so they fire once — recording that a
 * badge's unlock animation has been shown, and pinning the first badges.
 * Spending freezes is the streak's own upkeep (useStreakUpkeep), and the
 * moment it leaves for Today is read from there.
 *
 * Both write through arrayUnion, so a second tab racing this merges
 * rather than clobbering.
 */
export function useGamification(): Gamification {
  const { profile, profileLive } = useAuth()
  const setProfile = useAuthStore((s) => s.setProfile)
  const { sessions, pieces } = usePracticeStore()
  // Badges are recorded, celebrated and pinned only from live data — not
  // from the copy saved on this device, which may be a step behind and
  // would replay a celebration or overwrite a date.
  const sessionsLoaded = usePracticeStore((s) => s.sessionsLoaded)
  const dataLive = profileLive && sessionsLoaded

  const plan = useMemo(
    () => planOf(profile),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile?.streakRules, profile?.streakFreezesUsed, profile?.streakRepaired]
  )
  const seen = useMemo(() => profile?.badgesSeen ?? [], [profile?.badgesSeen])
  const earnedAt = useMemo(() => profile?.badgeEarnedAt ?? {}, [profile?.badgeEarnedAt])
  const pinned = useMemo(() => profile?.pinnedBadges ?? [], [profile?.pinnedBadges])
  const masteryPrompted = useMemo(
    () => profile?.masteryPromptsSeen ?? [],
    [profile?.masteryPromptsSeen]
  )
  const dailyGoal = Math.round((profile?.weeklyGoalMinutes ?? 300) / 7)

  const live = useStreak()
  const { current: streak, longest: longestStreak } = live

  const week = useMemo(() => weekStrip(live, live.today, plan.rules), [live, plan.rules])
  const progression = useMemo(() => computeProgression(sessions, dailyGoal), [sessions, dailyGoal])

  // The level goes in rather than being patched over the top afterwards —
  // buildBadgeContext no longer invents one.
  const badgeCtx = useMemo(
    () => buildBadgeContext(sessions, plan, progression.level),
    [sessions, plan, progression.level]
  )
  const badges = useMemo(() => earnedBadges(badgeCtx), [badgeCtx])
  const families = useMemo(() => badgeFamilies(badgeCtx), [badgeCtx])

  // Derived, not queued: if the data still says the piece is ready, the
  // prompt is still valid. Answering either way writes the piece id, which
  // removes it from consideration for good.
  const pendingMastery = useMemo(
    () => (dataLive ? findMasteryCandidate(pieces, sessions, masteryPrompted) : null),
    [dataLive, pieces, sessions, masteryPrompted]
  )

  const queued = useStreakMoments((st) => st.freeze)
  const pendingFreeze = queued && queued.uid === profile?.uid ? queued : null
  const [badgeQueue, setBadgeQueue] = useState<BadgeDef[]>([])

  // ── queue unseen badges, and stamp when they were won ────────────────
  useEffect(() => {
    if (!profile?.uid || !dataLive) return

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
  }, [badges, seen, earnedAt, profile?.uid, dataLive, setProfile])

  // ── fill the row on Today, so the feature is found at all ────────────
  //
  // Someone who has never pinned anything sees nothing under the greeting,
  // and nothing anywhere says that space exists. So the app pins the first
  // few on their behalf. The moment they pin or unpin anything themselves
  // the flag goes up and this never runs again — without that, an unpin
  // would be filled straight back in and the button would look broken.
  const pinning = useRef(false)
  useEffect(() => {
    if (pinning.current) return
    if (!profile?.uid || profile.role === 'teacher' || !dataLive) return
    if (profile.badgePinsTouched) return

    const free = MAX_PINNED - pinned.length
    if (free <= 0) return

    // One per family, the highest tier held: the same representative the
    // Progress grid shows, and never two rungs of one ladder.
    const additions: string[] = []
    for (const f of families) {
      if (additions.length >= free) break
      if (!f.highest) continue
      if (f.tiers.some((t) => pinned.includes(t.id))) continue
      additions.push(f.highest.id)
    }
    if (additions.length === 0) return

    pinning.current = true
    const next = [...pinned, ...additions]

    // Deliberately not setting badgePinsTouched: this is the app's doing,
    // not theirs. Every mounted copy computes the same list from the same
    // profile, so two of them racing write the same thing.
    updateUserProfile(profile.uid, { pinnedBadges: next })
      .then(() => {
        const latest = useAuthStore.getState().profile
        if (!latest) return
        setProfile({ ...latest, pinnedBadges: next })
        // Cleared, so a badge won later in the same session still lands in
        // a free slot. A failure leaves it set: one attempt per mount.
        pinning.current = false
      })
      .catch(() => {})
  }, [profile?.uid, profile?.role, profile?.badgePinsTouched, pinned, families, dataLive, setProfile])

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
    freezesLeft: live.held,
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
    dismissFreeze: () => useStreakMoments.getState().setFreeze(null),
    dismissMastery,
    confirmMastery,
  }
}
