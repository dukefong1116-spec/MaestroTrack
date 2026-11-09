import type { TourCheckpoint } from '@/types'

/**
 * The first-run tour, and the one-time intros after it.
 *
 * A new student is walked through the app by doing it: start a session,
 * pick a category, finish, and see it land in their history. The steps
 * that matter can't be skipped — the only way forward is the thing the
 * step asks for — and everything else on the screen is blocked meanwhile.
 *
 * This file is only data and one decision: what to show, given where
 * someone is. No React, so every path through it is unit-tested; the
 * TourLayer component draws whatever this returns.
 *
 * Only checkpoints are saved to the profile (TourCheckpoint). The steps
 * inside the first session are kept in memory (SessionSub), so a reload
 * mid-session falls back to "tap Start" rather than pointing at a session
 * that no longer exists.
 */

export type SessionSub = 'category' | 'tools' | 'finish' | 'saving'

export type ShowId =
  | 'welcome' | 'today' | 'start' | 'category' | 'tools' | 'finish' | 'streak' | 'history'
  | 'intro-library' | 'intro-progress' | 'piece-prompt'

export interface Show {
  id: ShowId
  text: string
  /** `[data-coach]` to light up. None: the bubble alone. */
  target?: string
  /** The only way on is tapping the target. Otherwise a button does it. */
  mustTap?: boolean
  /** The button's label, for steps that have one. */
  button?: string
  /** Block the rest of the screen while this shows. */
  block: boolean
}

const HOME = '/student'
const SESSION = '/student/session'

export interface TourInput {
  tour?: TourCheckpoint
  seen?: string[]
  path: string
  sub: SessionSub | null
  /** The student has at least one active piece to pick. */
  hasPieces: boolean
  firstName: string
}

export type Decision =
  | { kind: 'none' }
  | { kind: 'show'; show: Show }
  /** In the tour but on the wrong page: go home, where it carries on. */
  | { kind: 'redirect'; to: string }

const NONE: Decision = { kind: 'none' }
const show = (s: Show): Decision => ({ kind: 'show', show: s })

export function whatToShow(i: TourInput): Decision {
  const path = i.path.replace(/\/+$/, '') || '/'

  // Accounts made before the tour existed have no checkpoint at all, and
  // are never shown any of it.
  if (!i.tour) return NONE
  // Only inside the student app. A new student arriving through a
  // teacher's invite lands on /join first, and must be left to finish it.
  if (path !== HOME && !path.startsWith(HOME + '/')) return NONE

  if (i.tour !== 'done') {
    // The first session. Its steps live in memory; none of them is saved.
    if (path === SESSION) {
      if (i.tour !== 'start') return NONE // e.g. the celebration, before Today
      const sub = i.sub ?? 'category'
      if (sub === 'category') return show({
        id: 'category', target: 'session-categories', mustTap: true, block: true,
        text: 'What are you practicing? Tap a category.',
      })
      if (sub === 'tools') return show({
        id: 'tools', target: 'session-tools', button: 'Got it', block: true,
        text: 'Nice! Add notes anytime, and try the metronome, tuner or recorder.',
      })
      if (sub === 'finish') return show({
        // Not blocking: they should be free to actually practise.
        id: 'finish', target: 'session-finish', mustTap: true, block: false,
        text: 'Play as long as you like, then tap Finish.',
      })
      return NONE // 'saving': the finish sheet and celebration run as normal
    }

    if (path !== HOME) return { kind: 'redirect', to: HOME }

    switch (i.tour) {
      case 'welcome': return show({
        id: 'welcome', button: "Let's go", block: true,
        text: `Hi ${i.firstName}! Welcome to MaestroTrack 🎵 Let me show you around — it takes a minute.`,
      })
      case 'today': return show({
        id: 'today', target: 'week-ring', button: 'Next', block: true,
        text: 'This is Today — your week at a glance. It fills up as you practice.',
      })
      case 'start': return show({
        id: 'start', target: 'start-practising', mustTap: true, block: true,
        text: "Let's start your first session. Tap Start.",
      })
      case 'streak': return show({
        id: 'streak', target: 'week-strip', button: 'Next', block: true,
        text: 'First session logged! 🔥 Day 1 of your streak — come back tomorrow to keep it going.',
      })
      case 'history': return show({
        id: 'history', target: 'tab-practice', mustTap: true, block: true,
        text: 'Your history lives here. Tap Practice.',
      })
    }
  }

  // After the tour: a few things introduced the first time they come up.
  const seen = new Set(i.seen ?? [])
  if (path === '/student/library' && !seen.has('library')) return show({
    // Either way on: add a piece, or just "Got it".
    id: 'intro-library', target: 'add-piece', mustTap: true, button: 'Got it', block: true,
    text: "Your Library. Add pieces you're learning and performances coming up. Try adding your first piece!",
  })
  if (path === '/student/progress' && !seen.has('progress')) return show({
    id: 'intro-progress', button: 'Got it', block: true,
    text: 'Your progress lives here — badges, goals and patterns. Keep the streak going!',
  })
  if (path === SESSION && i.hasPieces && !seen.has('piece-prompt')) return show({
    id: 'piece-prompt', target: 'session-pieces', mustTap: true, block: true,
    text: "You've got pieces now! Pick what you're working on — you can choose more than one.",
  })
  return NONE
}

/** The one-time intros, by the `seen` id each one writes. */
export const INTRO_SEEN: Partial<Record<ShowId, string>> = {
  'intro-library': 'library',
  'intro-progress': 'progress',
  'piece-prompt': 'piece-prompt',
}
