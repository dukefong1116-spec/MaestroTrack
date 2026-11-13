import { describe, it, expect } from 'vitest'
import { expandRange, freeTimes, movedStart, resizedLength, monthGrid, occurrenceId } from '../calendar'
import { creditsFor, draftInvoice, balanceCents, standing, toCsv } from '../billing'
import { studentSlots } from '../studentLessons'
import { lessonMinutes, lessonPriceCents, typePriceCents, withDefaults } from '../settings'
import { addDays, mondayOf, weekday, clock, money } from '../dates'
import { nextOccurrence } from '@/lib/utils/notifications'
import type { LessonOccurrence, RosterStudent, StudioLesson } from '@/types'

const S = withDefaults('t', null)
const L = (over: Partial<StudioLesson> = {}): StudioLesson => ({
  id: 'L1', teacherId: 't', rosterIds: ['r1'], studentUids: ['u1'], title: 'Ana', tagId: 'private',
  dayOfWeek: 3, startTime: '15:30', durationMinutes: 30, startsOn: '2026-01-01', createdAt: '', updatedAt: '', ...over,
})
const O = (over: Partial<LessonOccurrence>): LessonOccurrence => ({
  id: 'o', teacherId: 't', rosterIds: ['r1'], studentUids: ['u1'], title: 'Ana', tagId: 'private',
  date: '2026-11-11', startTime: '15:30', durationMinutes: 30, createdAt: '', updatedAt: '', ...over,
})
const R = (over: Partial<RosterStudent> = {}): RosterStudent => ({
  id: 'r1', teacherId: 't', uid: 'u1', name: 'Ana Reyes', status: 'active', createdAt: '', updatedAt: '', ...over,
})

describe('dates', () => {
  it('works on local days', () => {
    expect(weekday('2026-11-11')).toBe(3)
    expect(mondayOf('2026-11-11')).toBe('2026-11-09')
    expect(mondayOf('2026-11-15')).toBe('2026-11-09')
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(clock('15:30')).toBe('3:30 PM')
    expect(clock('00:05')).toBe('12:05 AM')
    expect(money(3500)).toBe('$35')
    expect(money(3550)).toBe('$35.50')
  })
})

describe('lengths and prices', () => {
  it('falls through student → studio default', () => {
    expect(lessonMinutes(R(), S)).toBe(30)
    expect(lessonMinutes(R({ lessonMinutes: 45 }), S)).toBe(45)
    expect(lessonPriceCents(R(), S)).toBe(3000)
    expect(lessonPriceCents(R({ lessonMinutes: 45 }), S)).toBe(4500)
    expect(lessonPriceCents(R({ priceCents: 3500 }), S)).toBe(3500)
  })
  it('scales the default price for a length with no type of its own', () => {
    expect(typePriceCents(90, S)).toBe(9000)
  })
  it('follows a changed default length', () => {
    const s2 = { ...S, defaultLessonMinutes: 45 }
    expect(lessonMinutes(R(), s2)).toBe(45)
    expect(lessonPriceCents(R(), s2)).toBe(4500)
  })
})

describe('expandRange', () => {
  it('lays a weekly lesson onto its dates', () => {
    const items = expandRange('2026-11-09', '2026-11-29', [L()], [])
    expect(items.map((i) => i.date)).toEqual(['2026-11-11', '2026-11-18', '2026-11-25'])
    expect(items[0].key).toBe(occurrenceId('L1', '2026-11-11'))
  })
  it('respects startsOn and endsOn', () => {
    expect(expandRange('2026-11-09', '2026-11-29', [L({ startsOn: '2026-11-12', endsOn: '2026-11-20' })], []).map((i) => i.date)).toEqual(['2026-11-18'])
  })
  it('a moved date replaces the weekly one, even into another week', () => {
    const moved = O({ id: 'L1_2026-11-11', lessonId: 'L1', originalDate: '2026-11-11', date: '2026-11-17', startTime: '16:00' })
    const wk1 = expandRange('2026-11-09', '2026-11-15', [L()], [moved])
    expect(wk1).toHaveLength(0)
    const wk2 = expandRange('2026-11-16', '2026-11-22', [L()], [moved])
    expect(wk2.map((i) => `${i.date} ${i.startTime}`)).toEqual(['2026-11-17 16:00', '2026-11-18 15:30'])
  })
  it('includes one-offs and keeps attendance', () => {
    const items = expandRange('2026-11-09', '2026-11-15', [], [O({ id: 'x', date: '2026-11-10', attendance: { r1: 'present' } })])
    expect(items[0].attendance.r1).toBe('present')
  })
})

describe('free times', () => {
  it('skips busy stretches', () => {
    const items = expandRange('2026-11-11', '2026-11-11', [L({ startTime: '15:00', durationMinutes: 60 })], [])
    const free = freeTimes('2026-11-11', items, 30, 14, 17)
    expect(free).toEqual(['14:00', '14:30', '16:00', '16:30'])
  })
})

describe('dragging', () => {
  it('snaps to 15 minutes and stays inside the day', () => {
    expect(movedStart('15:30', 46 / 4, 46, 30, 8, 20)).toBe('15:45')
    expect(movedStart('15:30', 30, 46, 30, 8, 20)).toBe('16:15')
    expect(movedStart('08:15', -200, 46, 30, 8, 20)).toBe('08:00')
    expect(movedStart('19:00', 500, 46, 45, 8, 20)).toBe('19:15')
    expect(resizedLength('15:30', 30, 23, 46, 20)).toBe(60)
    expect(resizedLength('15:30', 30, -200, 46, 20)).toBe(15)
  })
  it('month grids are whole Monday weeks', () => {
    const g = monthGrid(2026, 10)
    expect(g[0]).toBe('2026-10-26')
    expect(g.length % 7).toBe(0)
    expect(g).toContain('2026-11-30')
  })
})

describe('credits and invoices', () => {
  const items = expandRange('2026-11-01', '2026-11-30', [L()], [
    O({ id: 'L1_2026-11-04', lessonId: 'L1', originalDate: '2026-11-04', date: '2026-11-04', attendance: { r1: 'teacher_cancel' } }),
    O({ id: 'L1_2026-11-11', lessonId: 'L1', originalDate: '2026-11-11', date: '2026-11-11', attendance: { r1: 'present' } }),
    O({ id: 'L1_2026-11-18', lessonId: 'L1', originalDate: '2026-11-18', date: '2026-11-18', attendance: { r1: 'missed' } }),
  ])
  it('a cancelled lesson earns a credit; booking a make-up uses it', () => {
    expect(creditsFor('r1', items, S, 0, '2026-11-20')).toBe(1)
    const withMakeup = [...items, ...expandRange('2026-11-01', '2026-11-30', [], [O({ id: 'm', date: '2026-11-13', makeupFor: 'r1', tagId: 'makeup' })])]
    expect(creditsFor('r1', withMakeup, S, 0, '2026-11-20')).toBe(0)
    expect(creditsFor('r1', items, { ...S, policy: { ...S.policy, teacherCancelCredit: false } }, 0, '2026-11-20')).toBe(0)
    expect(creditsFor('r1', items, S, 2, '2026-11-20')).toBe(3)
  })
  it('bills attended and missed lessons at the student’s price', () => {
    const d = draftInvoice([R({ priceCents: 3500 })], items, S)
    expect(d.lines[0].text).toBe('Ana · 2 lessons × $35')
    expect(d.totalCents).toBe(7000)
  })
  it('balance, standing and CSV', () => {
    const inv = { totalCents: 7000, payments: [{ at: '', amountCents: 2000, method: 'cash' as const }], status: 'open' as const }
    expect(balanceCents(inv)).toBe(5000)
    expect(standing([{ ...inv, id: 'i', teacherId: 't', familyId: 'f', period: '2026-11', lines: [], dueOn: '2026-11-01', createdAt: '', updatedAt: '' }], '2026-11-12')).toBe('overdue')
    expect(toCsv([['a,b', 'c"d']])).toBe('"a,b","c""d"')
  })
})

describe('what the student app sees', () => {
  const now = new Date(2026, 10, 9, 9, 0)
  it('a weekly lesson, skipping a week it was moved from, plus the moved one', () => {
    const moved = O({ id: 'L1_2026-11-11', lessonId: 'L1', originalDate: '2026-11-11', date: '2026-11-12', startTime: '17:00' })
    const slots = studentSlots('u1', 't', [L()], [moved], now)
    expect(slots).toHaveLength(2)
    const weekly = slots.find((s) => s.id === 'L1')!
    expect(weekly.skipDates).toEqual(['2026-11-11'])
    const next = nextOccurrence(weekly, now)
    expect(next.getDate()).toBe(18)
    const oneOff = slots.find((s) => s.date)!
    expect(nextOccurrence(oneOff, now).getDate()).toBe(12)
  })
  it('ignores lessons from anyone but the current teacher', () => {
    expect(studentSlots('u1', 'someone-else', [L()], [], now)).toHaveLength(0)
  })
  it('a past one-off is never "next"', () => {
    const slot = { id: 'x', teacherId: 't', studentId: 'u1', studentName: '', dayOfWeek: 1 as const, startTime: '10:00', durationMinutes: 30, createdAt: '', updatedAt: '', date: '2026-11-02' }
    expect(nextOccurrence(slot, now).getFullYear()).toBeGreaterThan(2030)
  })
})

import { correctedSession } from '../corrections'
describe('accepting a correction', () => {
  it('keeps the breakdowns adding up to the new length', () => {
    const c = correctedSession({ durationMinutes: 45, categoryMinutes: { Scales: 15, Repertoire: 30 }, pieceMinutes: { p1: 45 } }, 20)
    expect(c.durationMinutes).toBe(20)
    expect(Object.values(c.categoryMinutes ?? {}).reduce((a, b) => a + (b ?? 0), 0)).toBe(20)
    expect(c.pieceMinutes).toEqual({ p1: 20 })
  })
  it('a plain session just changes length', () => {
    expect(correctedSession({ durationMinutes: 45 }, 20)).toEqual({ durationMinutes: 20 })
  })
})
