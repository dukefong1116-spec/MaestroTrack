import { describe, it, expect } from 'vitest'
import {
  normaliseStatus, isOpen, needsReview, awaitingStudent,
  deriveProgress, dueness, dueLabel, sortForStudent, sortForReview, latestSubmission,
  deriveDailyProgress, assignmentType, isDaily, sessionCounts, todayStanding,
} from '../assignments'
import type { Assignment, PracticeSession } from '@/types'

const a = (over: Partial<Assignment> = {}): Assignment => ({
  id: 'a1', teacherId: 't1', studentId: 's1', title: 'Scales in C',
  status: 'active', createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z', ...over,
})

const sess = (date: string, minutes: number, over: Partial<PracticeSession> = {}): PracticeSession => ({
  id: date + minutes, userId: 's1', date, durationMinutes: minutes,
  category: 'Technique', difficultyRating: 3, confidenceRating: 7, createdAt: '', ...over,
})

/**
 * The compatibility layer matters most: there are live assignment
 * documents written before the review loop existed, and they must keep
 * working rather than being migrated.
 */
describe('normaliseStatus — old documents keep working', () => {
  it('reads the vocabulary already in the database', () => {
    expect(normaliseStatus('active')).toBe('assigned')
    expect(normaliseStatus('completed')).toBe('approved')
    expect(normaliseStatus('dismissed')).toBe('cancelled')
  })

  it('reads the new vocabulary', () => {
    expect(normaliseStatus('assigned')).toBe('assigned')
    expect(normaliseStatus('submitted')).toBe('submitted')
    expect(normaliseStatus('returned')).toBe('returned')
    expect(normaliseStatus('approved')).toBe('approved')
    expect(normaliseStatus('cancelled')).toBe('cancelled')
  })

  it('treats anything unrecognised as still assigned, never as done', () => {
    // Failing open would quietly mark work complete; failing closed only
    // means someone sees a task they have already finished.
    expect(normaliseStatus(undefined)).toBe('assigned')
    expect(normaliseStatus('nonsense')).toBe('assigned')
  })
})

describe('who owes what', () => {
  it('a legacy active assignment still awaits the student', () => {
    expect(awaitingStudent(a({ status: 'active' }))).toBe(true)
    expect(needsReview(a({ status: 'active' }))).toBe(false)
  })

  it('a submitted one awaits the teacher, not the student', () => {
    expect(needsReview(a({ status: 'submitted' }))).toBe(true)
    expect(awaitingStudent(a({ status: 'submitted' }))).toBe(false)
  })

  it('a returned one is back with the student', () => {
    expect(awaitingStudent(a({ status: 'returned' }))).toBe(true)
  })

  it('approved and cancelled are closed', () => {
    expect(isOpen(a({ status: 'approved' }))).toBe(false)
    expect(isOpen(a({ status: 'completed' }))).toBe(false)   // legacy
    expect(isOpen(a({ status: 'cancelled' }))).toBe(false)
  })
})

describe('deriveProgress', () => {
  const sessions = [
    sess('2026-08-20', 60),                       // before the assignment
    sess('2026-09-02', 30),
    sess('2026-09-03', 40),
  ]

  it('reports nothing to track when no minutes target is set', () => {
    const p = deriveProgress(a(), sessions)
    expect(p.tracked).toBe(false)
    expect(p.percent).toBeNull()
  })

  it('counts only practice logged after the assignment was created', () => {
    const p = deriveProgress(a({ targetMinutes: 100 }), sessions)
    expect(p.minutesDone).toBe(70)      // 60 predates it and must not count
    expect(p.percent).toBe(70)
    expect(p.targetMet).toBe(false)
  })

  it('knows when the target is met', () => {
    expect(deriveProgress(a({ targetMinutes: 70 }), sessions).targetMet).toBe(true)
  })

  it('caps at 100 rather than reporting 180%', () => {
    expect(deriveProgress(a({ targetMinutes: 10 }), sessions).percent).toBe(100)
  })

  it('counts only the assigned piece when one is named', () => {
    const mixed = [
      sess('2026-09-02', 30, { pieceName: 'p1' }),
      sess('2026-09-02', 45, { pieceName: 'p2' }),
    ]
    expect(deriveProgress(a({ targetMinutes: 60, pieceId: 'p1' }), mixed).minutesDone).toBe(30)
  })

  it('counts only the assigned category when one is named', () => {
    const mixed = [
      sess('2026-09-02', 30, { category: 'Scales' }),
      sess('2026-09-02', 45, { category: 'Repertoire' }),
    ]
    expect(deriveProgress(a({ targetMinutes: 60, category: 'Scales' }), mixed).minutesDone).toBe(30)
  })
})

describe('dueness', () => {
  const now = new Date('2026-09-10T12:00:00')

  it('is silent for work that is already done', () => {
    expect(dueness(a({ dueDate: '2026-09-01', status: 'approved' }), now)).toBe('none')
    expect(dueness(a({ dueDate: '2026-09-01', status: 'submitted' }), now)).toBe('none')
  })

  it('grades by calendar days', () => {
    expect(dueness(a({ dueDate: '2026-09-08' }), now)).toBe('overdue')
    expect(dueness(a({ dueDate: '2026-09-10' }), now)).toBe('today')
    expect(dueness(a({ dueDate: '2026-09-12' }), now)).toBe('soon')
    expect(dueness(a({ dueDate: '2026-09-20' }), now)).toBe('later')
  })

  it('a returned assignment becomes pressing again', () => {
    expect(dueness(a({ dueDate: '2026-09-10', status: 'returned' }), now)).toBe('today')
  })

  it('reads dates locally, not as UTC midnight', () => {
    // The whole suite runs in America/Los_Angeles; new Date() on a
    // date-only string would shift this a day and has done so twice.
    expect(dueness(a({ dueDate: '2026-09-10' }), new Date('2026-09-10T23:30:00'))).toBe('today')
  })
})

describe('dueLabel', () => {
  const now = new Date('2026-09-10T12:00:00')
  it('reads the way a person would say it', () => {
    expect(dueLabel(a({ dueDate: '2026-09-10' }), now)).toBe('Due today')
    expect(dueLabel(a({ dueDate: '2026-09-11' }), now)).toBe('Due tomorrow')
    expect(dueLabel(a({ dueDate: '2026-09-09' }), now)).toBe('Due yesterday')
    expect(dueLabel(a({ dueDate: '2026-09-05' }), now)).toBe('5 days overdue')
  })
})

describe('ordering', () => {
  const now = new Date('2026-09-10T12:00:00')

  it('puts the most pressing work first for a student', () => {
    const list = [
      a({ id: 'later', dueDate: '2026-09-25' }),
      a({ id: 'overdue', dueDate: '2026-09-05' }),
      a({ id: 'today', dueDate: '2026-09-10' }),
      a({ id: 'soon', dueDate: '2026-09-11' }),
    ]
    expect(sortForStudent(list, now).map((x) => x.id))
      .toEqual(['overdue', 'today', 'soon', 'later'])
  })

  it('serves whoever has waited longest first, and ignores the rest', () => {
    const list = [
      a({ id: 'new', status: 'submitted', submissions: [{ at: '2026-09-09T10:00:00.000Z' }] }),
      a({ id: 'old', status: 'submitted', submissions: [{ at: '2026-09-02T10:00:00.000Z' }] }),
      a({ id: 'notmine', status: 'active' }),
      a({ id: 'done', status: 'approved' }),
    ]
    expect(sortForReview(list).map((x) => x.id)).toEqual(['old', 'new'])
  })
})

describe('latestSubmission', () => {
  it('returns the most recent attempt, not the first', () => {
    const withTwo = a({
      submissions: [
        { at: '2026-09-02T10:00:00.000Z', note: 'first go' },
        { at: '2026-09-06T10:00:00.000Z', note: 'after feedback' },
      ],
    })
    expect(latestSubmission(withTwo)?.note).toBe('after feedback')
  })

  it('is null before anything is handed in', () => {
    expect(latestSubmission(a())).toBeNull()
  })
})

describe('deriveDailyProgress — "N minutes a day"', () => {
  const now = new Date('2026-09-10T12:00:00')
  const daily = (over: Partial<Assignment> = {}): Assignment =>
    a({ createdAt: '2026-09-08T00:00:00.000Z', dueDate: '2026-09-12',
        dailyTargetMinutes: 30, ...over })

  it('is untracked without a daily target', () => {
    expect(deriveDailyProgress(a({ dueDate: '2026-09-12' }), [], now).tracked).toBe(false)
  })

  it('is untracked without a due date — an open window cannot be measured', () => {
    expect(deriveDailyProgress(a({ dailyTargetMinutes: 30 }), [], now).tracked).toBe(false)
  })

  it('covers every day from the day it was set to the due date', () => {
    const p = deriveDailyProgress(daily(), [], now)
    expect(p.days.map((d) => d.date))
      .toEqual(['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12'])
    expect(p.daysRequired).toBe(5)
    expect(p.minutesRequired).toBe(150)   // 30 a day for five days
  })

  it('marks a day met only when the day reaches the target', () => {
    const p = deriveDailyProgress(daily(), [sess('2026-09-08', 29), sess('2026-09-09', 30)], now)
    expect(p.days[0].met).toBe(false)
    expect(p.days[1].met).toBe(true)
  })

  it('adds up several sessions in one day', () => {
    const p = deriveDailyProgress(daily(), [sess('2026-09-08', 10), sess('2026-09-08', 25)], now)
    expect(p.days[0].minutes).toBe(35)
    expect(p.days[0].met).toBe(true)
  })

  it('does not count today as missed — the day is not over', () => {
    // 8th and 9th met, nothing yet today (the 10th).
    const p = deriveDailyProgress(daily(), [sess('2026-09-08', 30), sess('2026-09-09', 30)], now)
    expect(p.onTrack).toBe(true)
  })

  it('knows when a day was genuinely missed', () => {
    const p = deriveDailyProgress(daily(), [sess('2026-09-08', 30)], now)  // 9th missed
    expect(p.onTrack).toBe(false)
  })

  it('does not hold the future against anyone', () => {
    const p = deriveDailyProgress(daily(), [], now)
    expect(p.days.filter((d) => d.isFuture).map((d) => d.date))
      .toEqual(['2026-09-11', '2026-09-12'])
  })

  it('unlocks hand-in once every day is met', () => {
    const all = ['2026-09-08','2026-09-09','2026-09-10','2026-09-11','2026-09-12'].map((d) => sess(d, 30))
    expect(deriveDailyProgress(daily(), all, now).targetMet).toBe(true)
  })

  it('does not unlock part-way through', () => {
    expect(deriveDailyProgress(daily(), [sess('2026-09-08', 30)], now).targetMet).toBe(false)
  })

  it('unlocks after the due date even if days were missed, rather than stranding them', () => {
    const after = new Date('2026-09-15T12:00:00')
    const p = deriveDailyProgress(daily(), [sess('2026-09-08', 30)], after)
    expect(p.daysMet).toBe(1)
    expect(p.onTrack).toBe(false)
    expect(p.targetMet).toBe(true)   // can hand in and explain
  })

  it('counts only the assigned piece when one is named', () => {
    const mixed = [
      sess('2026-09-08', 30, { pieceName: 'p1' }),
      sess('2026-09-09', 30, { pieceName: 'p2' }),
    ]
    const p = deriveDailyProgress(daily({ pieceId: 'p1' }), mixed, now)
    expect(p.days[0].met).toBe(true)
    expect(p.days[1].met).toBe(false)
  })

  it('walks days safely across a DST change', () => {
    // US clocks spring forward 2026-03-08; a fixed 24h step would skip it.
    const p = deriveDailyProgress(
      daily({ createdAt: '2026-03-06T00:00:00.000Z', dueDate: '2026-03-10' }),
      [], new Date('2026-03-11T12:00:00')
    )
    expect(p.days.map((d) => d.date))
      .toEqual(['2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'])
  })
})

describe('assignmentType — inferred, so old documents keep measuring', () => {
  it('reads an explicit type', () => {
    expect(assignmentType(a({ type: 'daily' }))).toBe('daily')
    expect(assignmentType(a({ type: 'task' }))).toBe('task')
  })

  it('infers daily from a daily target when no type was stored', () => {
    // Everything created before the two kinds were distinguished has no
    // type. Defaulting to 'task' would make these silently stop measuring.
    expect(assignmentType(a({ dailyTargetMinutes: 30 }))).toBe('daily')
    expect(isDaily(a({ dailyTargetMinutes: 30 }))).toBe(true)
  })

  it('treats everything else as a task', () => {
    expect(assignmentType(a())).toBe('task')
    expect(assignmentType(a({ targetMinutes: 200 }))).toBe('task')
  })
})

describe('sessionCounts — the warning the student gets before saving', () => {
  it('counts anything when the assignment is unscoped', () => {
    expect(sessionCounts(a(), { category: 'Technique' })).toBe(true)
  })

  it('counts only the named category', () => {
    const scoped = a({ category: 'Scales' })
    expect(sessionCounts(scoped, { category: 'Scales' })).toBe(true)
    expect(sessionCounts(scoped, { category: 'Technique' })).toBe(false)
  })

  it('a named piece wins over a category', () => {
    const scoped = a({ category: 'Scales', pieceId: 'p1' })
    expect(sessionCounts(scoped, { category: 'Technique', pieceName: 'p1' })).toBe(true)
    expect(sessionCounts(scoped, { category: 'Scales', pieceName: 'p2' })).toBe(false)
  })
})

describe('todayStanding', () => {
  const now = new Date('2026-09-10T12:00:00')
  const daily = a({ dailyTargetMinutes: 30, createdAt: '2026-09-08T00:00:00.000Z', dueDate: '2026-09-12' })

  it('counts only today', () => {
    const s = [sess('2026-09-09', 30), sess('2026-09-10', 12)]
    expect(todayStanding(daily, s, 0, now).done).toBe(12)
  })

  it('includes a session still running, so the bar moves while you play', () => {
    const t = todayStanding(daily, [sess('2026-09-10', 12)], 9, now)
    expect(t.withLive).toBe(21)
    expect(t.remaining).toBe(9)
    expect(t.met).toBe(false)
  })

  it('crosses the target mid-session', () => {
    expect(todayStanding(daily, [sess('2026-09-10', 12)], 20, now).met).toBe(true)
  })

  it('never reports negative remaining', () => {
    expect(todayStanding(daily, [sess('2026-09-10', 99)], 0, now).remaining).toBe(0)
  })

  it('ignores practice that does not match a scoped assignment', () => {
    const scoped = a({ dailyTargetMinutes: 30, category: 'Scales',
                       createdAt: '2026-09-08T00:00:00.000Z', dueDate: '2026-09-12' })
    const s = [sess('2026-09-10', 40, { category: 'Technique' })]
    expect(todayStanding(scoped, s, 0, now).done).toBe(0)
  })
})
