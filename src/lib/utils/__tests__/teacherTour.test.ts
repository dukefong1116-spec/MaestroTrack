import { describe, it, expect } from 'vitest'
import { whatToShowTeacher, TEACHER_TAB_STEPS, type TeacherTourInput } from '../teacherTour'
import type { TeacherTourCheckpoint } from '@/types'

const at = (tour: TeacherTourCheckpoint | undefined, path: string, over: Partial<TeacherTourInput> = {}) =>
  whatToShowTeacher({ tour, path, firstName: 'Duke', compact: true, ...over })
const id = (d: ReturnType<typeof whatToShowTeacher>) => (d.kind === 'show' ? d.show.id : d.kind)

describe('teacher tutorial', () => {
  it('every teacher starts it once, accounts from before it included', () => {
    const d = at(undefined, '/teacher')
    expect(id(d)).toBe('t-welcome')
    if (d.kind === 'show') {
      expect(d.show.title).toBe('Hi Duke! 👋')
      expect(d.show.big).toBe(true)
      expect(d.show.progress).toEqual([1, 12])
    }
  })

  it('walks every page in order, each step on its own page', () => {
    const steps: [TeacherTourCheckpoint, string, string][] = [
      ['welcome', '/teacher', 't-welcome'],
      ['today', '/teacher', 't-today'],
      ['students', '/teacher', 't-students'],
      ['add-student', '/teacher/students', 't-add-student'],
      ['calendar', '/teacher/students', 't-calendar'],
      ['new-lesson', '/teacher/calendar', 't-new-lesson'],
      ['lessons', '/teacher/calendar', 't-lessons'],
      ['review', '/teacher/calendar', 't-review'],
      ['review-tip', '/teacher/review', 't-review-tip'],
      ['billing', '/teacher/review', 't-more'],
      ['billing-tip', '/teacher/families', 't-billing-tip'],
      ['finish', '/teacher/families', 't-finish'],
    ]
    for (const [tour, path, want] of steps) expect(id(at(tour, path))).toBe(want)
  })

  it('tab steps must be tapped, and block everything else', () => {
    const d = at('students', '/teacher')
    expect(d.kind === 'show' && d.show.mustTap && d.show.block).toBe(true)
    expect(d.kind === 'show' && d.show.target).toBe('tab-students')
    // On a computer the side menu is lit instead.
    const wide = at('students', '/teacher', { compact: false })
    expect(wide.kind === 'show' && wide.show.target).toBe('rail-students')
  })

  it('a tab step’s page opening is the cue to move on (no bubble meanwhile)', () => {
    for (const [tour, step] of Object.entries(TEACHER_TAB_STEPS)) {
      expect(at(tour as TeacherTourCheckpoint, step!.to).kind).toBe('none')
    }
  })

  it('Billing: under More on a phone, straight from the side menu on a computer', () => {
    expect(id(at('billing', '/teacher/more'))).toBe('t-more-billing')
    expect(id(at('billing', '/teacher/review', { compact: false }))).toBe('t-billing')
    const tip = at('billing-tip', '/teacher/families')
    expect(tip.kind === 'show' && tip.show.text).toContain('Lessons and prices')
  })

  it('wandering off mid-tour leads back to where it carries on', () => {
    expect(at('lessons', '/teacher/students')).toEqual({ kind: 'redirect', to: '/teacher/calendar' })
    expect(at('today', '/teacher/settings')).toEqual({ kind: 'redirect', to: '/teacher' })
    expect(at('billing', '/teacher/more', { compact: false })).toEqual({ kind: 'redirect', to: '/teacher/review' })
  })

  it('only inside the teacher app', () => {
    expect(at('welcome', '/student').kind).toBe('none')
    expect(at('welcome', '/start/setup').kind).toBe('none')
  })

  it('after it: a one-time tip on a student’s record', () => {
    expect(id(at('done', '/teacher/students/r1'))).toBe('t-record')
    expect(at('done', '/teacher/students/r1', { seen: ['teacher-record'] }).kind).toBe('none')
    expect(at('done', '/teacher').kind).toBe('none')
    expect(at('done', '/teacher/students').kind).toBe('none')
  })
})
