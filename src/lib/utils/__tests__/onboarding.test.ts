import { describe, expect, it } from 'vitest'
import {
  onboardingState, shouldCoach, STEPS, DEFAULT_WEEKLY_GOAL,
  type OnboardingContext,
} from '../onboarding'
import type { Piece, PracticeSession, Recording, UserProfile } from '@/types'

/**
 * The checklist is only worth having if it cannot lie. Every step here is
 * derived from the same data the rest of the app reads, so these assert
 * that each one ticks when — and only when — the person actually did the
 * thing.
 */

const TODAY = '2026-11-03'

function session(date: string): PracticeSession {
  return {
    id: `s-${date}`, userId: 'u', date, durationMinutes: 30,
    category: 'Technique', difficultyRating: 3, confidenceRating: 7,
    createdAt: date,
  } as PracticeSession
}

function ctx(over: Partial<OnboardingContext> = {}): OnboardingContext {
  return {
    sessions: [], pieces: [], recordings: [],
    profile: { uid: 'u', email: 'a@b.c', role: 'student', createdAt: '', updatedAt: '' } as UserProfile,
    seen: [], today: TODAY,
    ...over,
  }
}

const idsDone = (c: OnboardingContext) =>
  onboardingState(c).steps.filter((s) => s.done).map((s) => s.step.id)

describe('a brand-new account', () => {
  it('has nothing done and is pointed at the first step', () => {
    const s = onboardingState(ctx())
    expect(s.doneCount).toBe(0)
    expect(s.total).toBe(STEPS.length)
    expect(s.next?.id).toBe('session')
    expect(s.complete).toBe(false)
  })

  it('is offered the card', () => {
    expect(shouldCoach(ctx())).toBe(true)
  })
})

describe('step 1 — log a session', () => {
  it('ticks on any session at all', () => {
    expect(idsDone(ctx({ sessions: [session(TODAY)] }))).toContain('session')
  })
})

describe('step 2 — log a PAST session', () => {
  it('does not tick for today’s practice', () => {
    // Logging today through the same form is fine, but it teaches nothing
    // about back-dating, which is the part nobody finds on their own.
    expect(idsDone(ctx({ sessions: [session(TODAY)] }))).not.toContain('logPast')
  })

  it('ticks for a session dated earlier', () => {
    expect(idsDone(ctx({ sessions: [session('2026-11-01')] }))).toContain('logPast')
  })

  it('reads an ISO instant the same as a bare date', () => {
    // Newer rows store the full instant; older ones a bare yyyy-MM-dd.
    const iso = { ...session('2026-11-01'), date: '2026-11-01T18:00:00.000Z' }
    expect(idsDone(ctx({ sessions: [iso] }))).toContain('logPast')
  })

  it('does not trip on today stored as an instant', () => {
    const iso = { ...session(TODAY), date: `${TODAY}T23:59:00.000Z` }
    expect(idsDone(ctx({ sessions: [iso] }))).not.toContain('logPast')
  })
})

describe('step 3 — add a piece', () => {
  it('ticks once one exists', () => {
    const pieces = [{ id: 'p', userId: 'u', title: 'Ballade' } as Piece]
    expect(idsDone(ctx({ pieces }))).toContain('piece')
  })
})

describe('step 4 — your weekly goal', () => {
  it('stays open while the goal is still the default', () => {
    const profile = { weeklyGoalMinutes: DEFAULT_WEEKLY_GOAL } as UserProfile
    expect(idsDone(ctx({ profile }))).not.toContain('goal')
  })

  it('stays open when no goal is set at all', () => {
    expect(idsDone(ctx({ profile: {} as UserProfile }))).not.toContain('goal')
  })

  it('ticks once it has been changed', () => {
    const profile = { weeklyGoalMinutes: 420 } as UserProfile
    expect(idsDone(ctx({ profile }))).toContain('goal')
  })
})

describe('step 5 — look at Progress', () => {
  it('needs telling, because visiting a page leaves no data behind', () => {
    expect(idsDone(ctx())).not.toContain('progress')
    expect(idsDone(ctx({ seen: ['progress'] }))).toContain('progress')
  })
})

describe('recording', () => {
  it('is reported separately, not as a step', () => {
    // It happens inside the first session, so it is taught there rather
    // than sending somebody back in a second time to press Record.
    expect(STEPS.map((s) => s.id)).not.toContain('record')
    expect(onboardingState(ctx()).hasRecorded).toBe(false)
    expect(onboardingState(ctx({ recordings: [{ id: 'r' } as Recording] })).hasRecorded).toBe(true)
  })
})

describe('when the card goes away', () => {
  const allDone = ctx({
    sessions: [session('2026-11-01')],
    pieces: [{ id: 'p' } as Piece],
    profile: { weeklyGoalMinutes: 420 } as UserProfile,
    seen: ['progress'],
  })

  it('once every step is done', () => {
    expect(onboardingState(allDone).complete).toBe(true)
    expect(shouldCoach(allDone)).toBe(false)
  })

  it('once dismissed, even with steps outstanding', () => {
    const p = { onboarding: { dismissed: true } } as UserProfile
    expect(shouldCoach(ctx({ profile: p }))).toBe(false)
  })

  it('once finished, even if a step later reads as undone', () => {
    // Deleting your only piece should not reopen a checklist you have
    // already been through.
    const p = { onboarding: { completedAt: '2026-11-02T00:00:00.000Z' } } as UserProfile
    expect(shouldCoach(ctx({ profile: p }))).toBe(false)
  })

  it('for somebody who was already using the app', () => {
    // No migration and no date cutoff: their own history is the evidence.
    const busy = ctx({ sessions: [session('2026-10-01'), session('2026-10-02'), session('2026-10-03'), session('2026-10-04')] })
    expect(shouldCoach(busy)).toBe(false)
  })

  it('but not for somebody three sessions in with steps left', () => {
    const early = ctx({ sessions: [session(TODAY), session(TODAY), session(TODAY)] })
    expect(shouldCoach(early)).toBe(true)
  })
})

describe('the step list itself', () => {
  it('asks for the session before anything that happens inside one', () => {
    const order = STEPS.map((s) => s.id)
    expect(order.indexOf('session')).toBe(0)
    expect(order.indexOf('logPast')).toBe(1)
  })

  it('gives every step somewhere to go and something to say', () => {
    for (const s of STEPS) {
      expect(s.say.length).toBeGreaterThan(10)
      expect(s.action.length).toBeGreaterThan(2)
      expect(s.to.startsWith('/student')).toBe(true)
    }
  })

  it('has no duplicate ids', () => {
    expect(new Set(STEPS.map((s) => s.id)).size).toBe(STEPS.length)
  })
})
