import { create } from 'zustand'
import type { UserProfile, PracticeSession } from '@/types'

interface TeacherState {
  students: UserProfile[]
  selectedStudentId: string | null
  studentSessions: Record<string, PracticeSession[]>
  setStudents: (students: UserProfile[]) => void
  setSelectedStudent: (id: string | null) => void
  setStudentSessions: (studentId: string, sessions: PracticeSession[]) => void
}

export const useTeacherStore = create<TeacherState>((set) => ({
  students: [],
  selectedStudentId: null,
  studentSessions: {},
  setStudents: (students) => set({ students }),
  setSelectedStudent: (id) => set({ selectedStudentId: id }),
  setStudentSessions: (studentId, sessions) =>
    set((state) => ({ studentSessions: { ...state.studentSessions, [studentId]: sessions } })),
}))
