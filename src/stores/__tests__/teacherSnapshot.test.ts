import { beforeEach, describe, expect, it } from 'vitest'
import { useTeacherStore, type TeacherSnapshot } from '../teacherStore'
import type { PracticeSession, UserProfile } from '@/types'

/** A teacher's saved studio fills in what has not arrived live — never the reverse. */
const student = (uid: string) => ({ uid }) as UserProfile
const session = (id: string) => ({ id }) as PracticeSession
// Partial: a copy saved before the studio lists existed has none of them.
const snap: Partial<TeacherSnapshot> = {
  students: [student('saved')], studentSessions: { a: [session('old-a')], b: [session('old-b')] },
  schedule: [], requests: [], messages: [], assignments: [],
}

describe("a teacher's saved copy vs live data", () => {
  beforeEach(() => useTeacherStore.getState().resetTeacherData())

  it('shows until live data arrives', () => {
    useTeacherStore.getState().hydrate(snap)
    expect(useTeacherStore.getState().students.map((s) => s.uid)).toEqual(['saved'])
    useTeacherStore.getState().setStudents([student('live')])
    expect(useTeacherStore.getState().students.map((s) => s.uid)).toEqual(['live'])
  })
  it('a saved copy read late never overwrites live data', () => {
    useTeacherStore.getState().setStudents([])
    useTeacherStore.getState().hydrate(snap)
    expect(useTeacherStore.getState().students).toEqual([])
  })
  it("one student's live sessions survive the rest being filled in", () => {
    useTeacherStore.getState().setStudentSessions('a', [session('live-a')])
    useTeacherStore.getState().hydrate(snap)
    const { studentSessions } = useTeacherStore.getState()
    expect(studentSessions.a.map((s) => s.id)).toEqual(['live-a'])
    expect(studentSessions.b.map((s) => s.id)).toEqual(['old-b'])
  })
  it('studio lists hydrate too, and live ones win', () => {
    const roster = [{ id: 'r1' }] as TeacherSnapshot['roster']
    useTeacherStore.getState().setStudio('families', [])
    useTeacherStore.getState().hydrate({ ...snap, roster, families: [{ id: 'f-old' }] as TeacherSnapshot['families'] })
    expect(useTeacherStore.getState().roster.map((r) => r.id)).toEqual(['r1'])
    expect(useTeacherStore.getState().families).toEqual([])
  })
})
