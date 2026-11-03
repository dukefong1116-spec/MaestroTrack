import type { Piece, PracticeSession, Recording, UserProfile } from '@/types'

/**
 * The first five minutes, as five things to do rather than five things to
 * read.
 *
 * A step completes because the person did the thing, not because they
 * ticked a box — the same derived-not-stored rule the badges follow. Four
 * of the five leave evidence in the data, so they are computed from it and
 * cannot drift out of step with reality. Only "looked at Progress" leaves
 * nothing behind, so only that one is recorded, in profile.onboarding.seen.
 *
 * The order follows the real journey. Recording used to be a step of its
 * own, which meant finishing a session, coming back here, and starting a
 * second one purely to press Record — so it is part of the first session
 * now, taught by the strip inside the session screen.
 */

export type StepId = 'session' | 'logPast' | 'piece' | 'goal' | 'progress'

/** Steps whose completion the app has to be told about. */
export const RECORDED_STEPS: StepId[] = ['progress']

export interface OnboardingStep {
  id: StepId
  /** What the card says. One sentence, and it says why. */
  say: string
  /** The button. */
  action: string
  to: string
  done: (ctx: OnboardingContext) => boolean
}

export interface OnboardingContext {
  sessions: PracticeSession[]
  pieces: Piece[]
  recordings: Recording[]
  profile: UserProfile | null | undefined
  seen: string[]
  /** yyyy-MM-dd. Passed in rather than read, so the tests can fix it. */
  today: string
}

/** The goal everybody starts with; changing it is what the step asks for. */
export const DEFAULT_WEEKLY_GOAL = 300

export const STEPS: OnboardingStep[] = [
  {
    id: 'session',
    say: 'Press start — the timer runs while you play.',
    action: 'Start a session',
    to: '/student/session',
    done: (c) => c.sessions.length > 0,
  },
  {
    id: 'logPast',
    say: 'Practised before you found this? Log it after the fact.',
    action: 'Log a past session',
    to: '/student/practice',
    // Dated before today, which is what "past" means. Logging today's
    // practice through the same form is fine but teaches nothing about
    // back-dating, which is the part people do not find on their own.
    done: (c) => c.sessions.some((s) => dayOf(s.date) < c.today),
  },
  {
    id: 'piece',
    say: 'Name what you’re working on, so your minutes attach to a piece.',
    action: 'Add a piece',
    to: '/student/library',
    done: (c) => c.pieces.length > 0,
  },
  {
    id: 'goal',
    say: `${DEFAULT_WEEKLY_GOAL} minutes a week is just a default. Make it yours.`,
    action: 'Set your goal',
    to: '/student/progress',
    // A goal nobody has touched still reads as the default, so changing it
    // is the evidence. Someone who genuinely wants 300 can tap through to
    // Progress and the step stays open — which is the honest outcome, and
    // the list can be dismissed.
    done: (c) => (c.profile?.weeklyGoalMinutes ?? DEFAULT_WEEKLY_GOAL) !== DEFAULT_WEEKLY_GOAL,
  },
  {
    id: 'progress',
    say: 'Have a look at Progress — the badges have been tracking you already.',
    action: 'See Progress',
    to: '/student/progress',
    done: (c) => c.seen.includes('progress'),
  },
]

/**
 * A session's date is stored as an ISO instant on newer rows and as a bare
 * yyyy-MM-dd on older ones. Both compare correctly once cut to ten
 * characters, which is why this does not parse.
 */
function dayOf(date: string): string {
  return (date ?? '').slice(0, 10)
}

export interface OnboardingState {
  steps: { step: OnboardingStep; done: boolean }[]
  /** The first unfinished step, or null when there are none left. */
  next: OnboardingStep | null
  doneCount: number
  total: number
  complete: boolean
  /** Offered once inside the first session, and ticked by recording. */
  hasRecorded: boolean
}

export function onboardingState(ctx: OnboardingContext): OnboardingState {
  const steps = STEPS.map((step) => ({ step, done: step.done(ctx) }))
  const doneCount = steps.filter((s) => s.done).length
  return {
    steps,
    next: steps.find((s) => !s.done)?.step ?? null,
    doneCount,
    total: steps.length,
    complete: doneCount === steps.length,
    hasRecorded: ctx.recordings.length > 0,
  }
}

/**
 * Whether to show the card at all.
 *
 * Hidden once dismissed, once finished, and for anyone who was already
 * using the app before this existed — an account with a month of practice
 * behind it does not need telling to log its first session. The cutoff is
 * their own data rather than a date, so it needs no migration.
 */
export function shouldCoach(ctx: OnboardingContext): boolean {
  if (ctx.profile?.onboarding?.dismissed) return false
  if (ctx.profile?.onboarding?.completedAt) return false
  // Four sessions in is past the point where a five-step list helps.
  if (ctx.sessions.length > 3) return false
  return !onboardingState(ctx).complete
}
