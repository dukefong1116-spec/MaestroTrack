import { describe, expect, it } from 'vitest'
import { organise, dueGroup, tabOf } from '../assignmentGroups'
import type { Assignment } from '@/types'

const NOW = new Date('2026-11-09T12:00:00') // a Monday
const a = (id: string, over: Partial<Assignment> = {}): Assignment => ({
  id, teacherId: 't', studentId: 's', title: id, status: 'active',
  createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z', ...over,
})
const wrap = (x: Assignment) => ({ assignment: x })

describe('which tab', () => {
  it('to do, handed in, done — and a withdrawn one nowhere', () => {
    expect(tabOf(a('x'))).toBe('todo')
    expect(tabOf(a('x', { status: 'returned' }))).toBe('todo')
    expect(tabOf(a('x', { status: 'submitted' }))).toBe('handed')
    expect(tabOf(a('x', { status: 'approved' }))).toBe('done')
    expect(tabOf(a('x', { status: 'cancelled' }))).toBeNull()
  })
})

describe('when it is due', () => {
  it('groups by calendar day, and a daily target is today’s work', () => {
    expect(dueGroup(a('x', { dueDate: '2026-11-07' }), NOW)).toBe('overdue')
    expect(dueGroup(a('x', { dueDate: '2026-11-09' }), NOW)).toBe('today')
    expect(dueGroup(a('x', { dueDate: '2026-11-13' }), NOW)).toBe('week')
    expect(dueGroup(a('x', { dueDate: '2026-12-02' }), NOW)).toBe('later')
    expect(dueGroup(a('x'), NOW)).toBe('none')
    expect(dueGroup(a('x', { type: 'daily', dailyTargetMinutes: 15 }), NOW)).toBe('today')
  })
})

describe('the whole list', () => {
  it('sorts each assignment into its tab, and To do into ordered groups', () => {
    const { tabs, groups } = organise([
      wrap(a('later', { dueDate: '2026-12-02' })),
      wrap(a('late', { dueDate: '2026-11-07' })),
      wrap(a('sent', { status: 'submitted', updatedAt: '2026-11-08T00:00:00.000Z' })),
      wrap(a('sent2', { status: 'submitted', updatedAt: '2026-11-09T00:00:00.000Z' })),
      wrap(a('ok', { status: 'approved' })),
      wrap(a('loose')),
    ], NOW)
    expect(groups.map((g) => g.group)).toEqual(['overdue', 'later', 'none'])
    expect(tabs.todo).toHaveLength(3)
    expect(tabs.handed.map((x) => x.assignment.id)).toEqual(['sent2', 'sent'])
    expect(tabs.done.map((x) => x.assignment.id)).toEqual(['ok'])
  })
})

describe('most pressing first', () => {
  it('overdue, then today\u2019s daily target, then the soonest due date', () => {
    const { mostPressing } = organise([
      wrap(a('haydn', { dueDate: '2026-12-02' })),
      wrap(a('scales', { dueDate: '2026-11-13' })),
      wrap(a('daily', { type: 'daily', dailyTargetMinutes: 15 })),
      wrap(a('bach', { dueDate: '2026-11-07' })),
      wrap(a('sight')),
      wrap(a('sent', { status: 'submitted' })),
    ], NOW)
    expect(mostPressing.map((x) => x.assignment.id)).toEqual(['bach', 'daily', 'scales', 'haydn', 'sight'])
  })
})
