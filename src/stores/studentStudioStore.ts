import { create } from 'zustand'
import type { LessonNote, PracticeCorrection, TeacherPracticeEntry } from '@/types'

/**
 * What a student's teacher has written for them in the studio: notes
 * shared from lessons, suggested corrections to their log, and practice
 * the teacher recorded for them. Kept apart from the practice store so
 * nothing the student owns is mixed with what someone else wrote.
 */
interface StudentStudioState {
  sharedNotes: LessonNote[]
  corrections: PracticeCorrection[]
  teacherPractice: TeacherPracticeEntry[]
  set: (patch: Partial<Pick<StudentStudioState, 'sharedNotes' | 'corrections' | 'teacherPractice'>>) => void
  reset: () => void
}

export const useStudentStudioStore = create<StudentStudioState>((set) => ({
  sharedNotes: [],
  corrections: [],
  teacherPractice: [],
  set: (patch) => set(patch),
  reset: () => set({ sharedNotes: [], corrections: [], teacherPractice: [] }),
}))
