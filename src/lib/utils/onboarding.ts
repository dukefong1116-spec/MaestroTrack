import type { UserProfile } from '@/types'

/**
 * The guided first look.
 *
 * A new account lands on Today and is shown round it: the screen shades,
 * one thing at a time is left lit, and a line explains what it is. Six
 * steps, all on this one screen, because every tab is reachable from the
 * bar at the bottom — so the tour never navigates, never loses its place
 * on a reload, and never has to put itself back together on a page it did
 * not open.
 *
 * Targets are found by `data-coach` rather than by ref, so a step can
 * point at something several components away without threading a ref
 * through all of them. A step whose target is not on the page is skipped
 * rather than left pointing at nothing.
 */

export type TourStepId =
  | 'week' | 'streak' | 'start' | 'practice' | 'library' | 'progress'

export interface TourStep {
  id: TourStepId
  /** Matched against `[data-coach="…"]`. */
  target: string
  title: string
  body: string
  /** Where the bubble sits relative to the lit element. */
  place: 'above' | 'below'
}

export const TOUR: TourStep[] = [
  {
    id: 'week',
    target: 'week-ring',
    title: 'This is your week',
    body: 'It fills as you log practice, and resets every Monday. The number under it is how far you have to go.',
    place: 'below',
  },
  {
    id: 'streak',
    target: 'week-strip',
    title: 'Seven days at a glance',
    body: 'Each one fills in when you practise. Miss a day and the streak goes — though you get a freeze or two to spend.',
    place: 'below',
  },
  {
    id: 'start',
    target: 'start-practising',
    title: 'Start here',
    body: 'The timer runs while you play. Metronome, tuner and recording are all inside — you do not need to set anything up first.',
    place: 'above',
  },
  {
    id: 'practice',
    target: 'tab-practice',
    title: 'Practice',
    body: 'Everything you have played, newest first. If you practised before you found this app, you can log it after the fact here.',
    place: 'above',
  },
  {
    id: 'library',
    target: 'tab-library',
    title: 'Library',
    body: 'The pieces you are working on, performances you are preparing for, and anything your teacher has set you.',
    place: 'above',
  },
  {
    id: 'progress',
    target: 'tab-progress',
    title: 'Progress',
    body: 'Badges, patterns in how you practise, and every day you have ever logged. Worth a look once you have a week behind you.',
    place: 'above',
  },
]

/**
 * Whether to show somebody round.
 *
 * Offered once, to an account that has not been through it and has not
 * waved it away. Nothing about their data decides it: a tour of what the
 * screen means is just as useful to someone who logged a session before
 * reading anything.
 */
export function shouldTour(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false
  if (profile.role === 'teacher') return false
  const ob = profile.onboarding
  return !ob?.dismissed && !ob?.completedAt
}
