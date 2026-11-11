import { create } from 'zustand'
import type { UserProfile, PracticeSession, Assignment, LessonSlot, StudioRequest, Message } from '@/types'

/** What a teacher's pages read, as saved on the device between visits. */
export interface TeacherSnapshot {
  students: UserProfile[]
  studentSessions: Record<string, PracticeSession[]>
  schedule: LessonSlot[]
  requests: StudioRequest[]
  messages: Message[]
  assignments: Assignment[]
}
type TeacherSnapshotKey = keyof TeacherSnapshot
export const TEACHER_SNAPSHOT_KEYS: TeacherSnapshotKey[] = ['students', 'studentSessions', 'schedule', 'requests', 'messages', 'assignments']
const NOT_LIVE = Object.fromEntries(TEACHER_SNAPSHOT_KEYS.map((k) => [k, false])) as Record<TeacherSnapshotKey, boolean>

interface TeacherState {
  students: UserProfile[]
  selectedStudentId: string | null
  studentSessions: Record<string, PracticeSession[]>
  studentAssignments: Record<string, Assignment[]>
  schedule: LessonSlot[]
  /** Students waiting to be let in. Pending only — see subscribeStudioRequests. */
  requests: StudioRequest[]
  /** Every message with every student, oldest first. */
  messages: Message[]
  /** Every assignment this teacher has set, across every student. */
  assignments: Assignment[]
  /**
   * Which lists have had their live data. Until then a list may be showing
   * the copy saved on this device last visit (see lib/cache/snapshot).
   */
  live: Record<TeacherSnapshotKey, boolean>
  /** Fill in, from the saved copy, whatever has not arrived live yet. */
  hydrate: (snap: Partial<TeacherSnapshot>) => void
  resetTeacherData: () => void
  setStudents: (students: UserProfile[]) => void
  setSelectedStudent: (id: string | null) => void
  setStudentSessions: (studentId: string, sessions: PracticeSession[]) => void
  setStudentAssignments: (studentId: string, assignments: Assignment[]) => void
  setSchedule: (slots: LessonSlot[]) => void
  setRequests: (requests: StudioRequest[]) => void
  setMessages: (messages: Message[]) => void
  setAssignments: (assignments: Assignment[]) => void
}

export const useTeacherStore = create<TeacherState>((set) => ({
  students: [],
  selectedStudentId: null,
  studentSessions: {},
  studentAssignments: {},
  schedule: [],
  requests: [],
  messages: [],
  assignments: [],
  live: { ...NOT_LIVE },
  hydrate: (snap) => set((s) => {
    const next: Record<string, unknown> = {}
    for (const k of TEACHER_SNAPSHOT_KEYS) {
      const v = snap[k]
      if (s.live[k] || !v || typeof v !== 'object') continue
      // A student's live sessions that arrived first win over the saved ones.
      next[k] = k === 'studentSessions' ? { ...(v as object), ...s.studentSessions } : v
    }
    return next as Partial<TeacherState>
  }),
  resetTeacherData: () => set({
    students: [], selectedStudentId: null, studentSessions: {}, studentAssignments: {}, schedule: [], requests: [], messages: [], assignments: [],
    live: { ...NOT_LIVE },
  }),
  setStudents: (students) => set((s) => ({ students, live: { ...s.live, students: true } })),
  setSelectedStudent: (id) => set({ selectedStudentId: id }),
  // One student at a time, so not marked live here: useTeacherData marks
  // them once every student's have arrived.
  setStudentSessions: (studentId, sessions) =>
    set((state) => ({ studentSessions: { ...state.studentSessions, [studentId]: sessions } })),
  setStudentAssignments: (studentId, assignments) =>
    set((state) => ({ studentAssignments: { ...state.studentAssignments, [studentId]: assignments } })),
  setSchedule: (slots) => set((s) => ({ schedule: slots, live: { ...s.live, schedule: true } })),
  setRequests: (requests) => set((s) => ({ requests, live: { ...s.live, requests: true } })),
  setMessages: (messages) => set((s) => ({ messages, live: { ...s.live, messages: true } })),
  setAssignments: (assignments) => set((s) => ({ assignments, live: { ...s.live, assignments: true } })),
}))
