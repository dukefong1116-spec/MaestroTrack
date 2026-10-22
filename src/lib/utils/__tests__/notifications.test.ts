import { describe, it, expect } from 'vitest'
import {
  buildStudentNotifications, buildTeacherNotifications,
  nextOccurrence, unreadCount, isUnread,
} from '../notifications'
import type { Assignment, LessonSlot, UserProfile } from '@/types'

const TEACHER = 'teacher-1'
const ANA = 'student-ana'

const assignment = (over: Partial<Assignment> = {}): Assignment => ({
  id: 'a1', teacherId: TEACHER, studentId: ANA,
  title: 'Kreutzer No. 2', status: 'assigned',
  createdAt: '2026-10-18T09:00:00.000Z',
  updatedAt: '2026-10-18T09:00:00.000Z',
  ...over,
} as Assignment)

const slot = (over: Partial<LessonSlot> = {}): LessonSlot => ({
  id: 'l1', teacherId: TEACHER, studentId: ANA, studentName: 'Ana',
  dayOfWeek: 3, startTime: '16:00', durationMinutes: 45,
  createdAt: '', updatedAt: '', ...over,
})

const NOW = new Date('2026-10-18T10:00:00')

describe('nextOccurrence', () => {
  it('finds this week when the day is still ahead', () => {
    // Sunday 18 Oct 2026 → Wednesday 21st.
    const d = nextOccurrence(slot({ dayOfWeek: 3 }), NOW)
    expect(d.getDay()).toBe(3)
    expect(d.getDate()).toBe(21)
    expect(d.getHours()).toBe(16)
  })

  it('rolls to next week once today’s time has passed', () => {
    const sunday4pm = slot({ dayOfWeek: 0, startTime: '09:00' })
    const d = nextOccurrence(sunday4pm, NOW) // 10:00 already past 09:00
    expect(d.getDate()).toBe(25)
  })

  it('keeps today when the time is still to come', () => {
    const d = nextOccurrence(slot({ dayOfWeek: 0, startTime: '18:00' }), NOW)
    expect(d.getDate()).toBe(18)
  })

  /**
   * The bug this whole file is written to avoid. US clocks go back on
   * 1 November 2026, so the week containing it is 169 hours, not 168.
   * Millisecond arithmetic lands an hour out; date-fns does not.
   */
  it('survives a week that crosses a daylight-saving change', () => {
    const before = new Date('2026-10-28T12:00:00') // Wednesday
    const d = nextOccurrence(slot({ dayOfWeek: 3, startTime: '16:00' }), before)
    expect(d.getDate()).toBe(28)
    const after = nextOccurrence(slot({ dayOfWeek: 3, startTime: '16:00' }), d)
    expect(after.getDate()).toBe(4)       // 4 November
    expect(after.getHours()).toBe(16)     // still 4pm, not 3pm
  })
})

describe('a student’s notifications', () => {
  const build = (a: Assignment[], l: LessonSlot[] = [], now = NOW) =>
    buildStudentNotifications({ assignments: a, lessons: l, options: { now } })

  it('reports a new assignment', () => {
    const out = build([assignment()])
    expect(out.map((n) => n.kind)).toContain('assignment-new')
  })

  it('reports each round of feedback separately', () => {
    const out = build([assignment({
      feedback: [
        { at: '2026-10-18T11:00:00.000Z', verdict: 'returned', note: 'tempo' },
        { at: '2026-10-18T12:00:00.000Z', verdict: 'approved', note: 'better' },
      ],
    } as Partial<Assignment>)])
    expect(out.filter((n) => n.kind === 'assignment-returned')).toHaveLength(1)
    expect(out.filter((n) => n.kind === 'assignment-approved')).toHaveLength(1)
  })

  it('ids are stable across rebuilds, so "seen" sticks', () => {
    const a = [assignment()]
    expect(build(a).map((n) => n.id)).toEqual(build(a).map((n) => n.id))
  })

  it('forgets anything past the horizon', () => {
    const old = assignment({ createdAt: '2026-01-01T09:00:00.000Z' })
    expect(build([old])).toHaveLength(0)
  })

  it('warns the day before a lesson, then within the hour', () => {
    // Lesson Sunday 18:00; at 10:00 that is 8 hours away.
    const dayBefore = build([], [slot({ dayOfWeek: 0, startTime: '18:00' })])
    expect(dayBefore[0].kind).toBe('lesson-tomorrow')

    const soon = build([], [slot({ dayOfWeek: 0, startTime: '10:30' })],
      new Date('2026-10-18T10:00:00'))
    expect(soon[0].kind).toBe('lesson-soon')
    expect(soon[0].body).toContain('30 min')
  })

  it('a lesson a week out is not yet news', () => {
    const out = build([], [slot({ dayOfWeek: 1, startTime: '16:00' })],
      new Date('2026-10-20T10:00:00')) // Tuesday → next Monday
    expect(out).toHaveLength(0)
  })

  it('the most urgent thing is first', () => {
    const out = build(
      [assignment()],
      [slot({ dayOfWeek: 0, startTime: '10:30' })],
      new Date('2026-10-18T10:00:00')
    )
    expect(out[0].kind).toBe('lesson-soon')
  })

  it('never returns more than the cap', () => {
    const many = Array.from({ length: 80 }, (_, i) => assignment({ id: `a${i}` }))
    const out = buildStudentNotifications({
      assignments: many, lessons: [], options: { now: NOW, cap: 10 },
    })
    expect(out).toHaveLength(10)
  })
})

describe('a teacher’s notifications', () => {
  const students = [{ uid: ANA, displayName: 'Ana Rivera' } as UserProfile]
  const build = (a: Assignment[]) =>
    buildTeacherNotifications({ assignments: a, students, options: { now: NOW } })

  it('reports work handed in, by name', () => {
    const out = build([assignment({
      status: 'submitted',
      submissions: [{ at: '2026-10-18T09:30:00.000Z' }],
    } as Partial<Assignment>)])
    expect(out).toHaveLength(1)
    expect(out[0].title).toContain('Ana Rivera')
  })

  it('stops reporting it once the teacher has answered', () => {
    const out = build([assignment({
      submissions: [{ at: '2026-10-18T09:30:00.000Z' }],
      feedback: [{ at: '2026-10-18T09:45:00.000Z', verdict: 'approved' }],
    } as Partial<Assignment>)])
    expect(out).toHaveLength(0)
  })

  it('a second attempt after feedback is news again', () => {
    const out = build([assignment({
      submissions: [
        { at: '2026-10-18T09:30:00.000Z' },
        { at: '2026-10-18T10:00:00.000Z' },
      ],
      feedback: [{ at: '2026-10-18T09:45:00.000Z', verdict: 'returned' }],
    } as Partial<Assignment>)])
    expect(out).toHaveLength(1)
  })
})

describe('read state', () => {
  const items = buildStudentNotifications({
    assignments: [assignment()], lessons: [], options: { now: NOW },
  })

  it('everything is unread until something is read', () => {
    expect(unreadCount(items)).toBe(items.length)
  })

  it('a watermark after the event marks it read', () => {
    expect(unreadCount(items, '2026-10-19T00:00:00.000Z')).toBe(0)
  })

  it('a watermark before it does not', () => {
    expect(isUnread(items[0], '2026-10-01T00:00:00.000Z')).toBe(true)
  })
})
