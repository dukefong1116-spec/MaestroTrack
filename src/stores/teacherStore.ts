import { create } from 'zustand'
import type { UserProfile, PracticeSession, Assignment } from '@/types'

interface TeacherState {
  students: UserProfile[]
  selectedStudentId: string | null
  studentSessions: Record<string, PracticeSession[]>
  studentAssignments: Record<string, Assignment[]>
  setStudents: (students: UserProfile[]) => void
  setSelectedStudent: (id: string | null) => void
  setStudentSessions: (studentId: string, sessions: PracticeSession[]) => void
  setStudentAssignments: (studentId: string, assignments: Assignment[]) => void
}

export const useTeacherStore = create<TeacherState>((set) => ({
  students: [],
  selectedStudentId: null,
  studentSessions: {},
  studentAssignments: {},
  setStudents: (students) => set({ students }),
  setSelectedStudent: (id) => set({ selectedStudentId: id }),
  setStudentSessions: (studentId, sessions) =>
    set((state) => ({ studentSessions: { ...state.studentSessions, [studentId]: sessions } })),
  setStudentAssignments: (studentId, assignments) =>
    set((state) => ({ studentAssignments: { ...state.studentAssignments, [studentId]: assignments } })),
}))
