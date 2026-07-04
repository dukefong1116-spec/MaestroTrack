import { create } from 'zustand'
import type { PracticeSession, Piece, Performance, Recording, TeacherNote } from '@/types'

interface PracticeState {
  sessions: PracticeSession[]
  pieces: Piece[]
  performances: Performance[]
  recordings: Recording[]
  teacherNotes: TeacherNote[]
  setSessions: (sessions: PracticeSession[]) => void
  setPieces: (pieces: Piece[]) => void
  setPerformances: (performances: Performance[]) => void
  setRecordings: (recordings: Recording[]) => void
  setTeacherNotes: (notes: TeacherNote[]) => void
  addSession: (session: PracticeSession) => void
  addPiece: (piece: Piece) => void
  addPerformance: (performance: Performance) => void
  // Timer
  timerRunning: boolean
  timerStartedAt: number | null
  startTimer: () => void
  stopTimer: () => number  // returns elapsed seconds
  resetTimer: () => void
}

export const usePracticeStore = create<PracticeState>((set, get) => ({
  sessions: [],
  pieces: [],
  performances: [],
  recordings: [],
  teacherNotes: [],
  setSessions: (sessions) => set({ sessions }),
  setPieces: (pieces) => set({ pieces }),
  setPerformances: (performances) => set({ performances }),
  setRecordings: (recordings) => set({ recordings }),
  setTeacherNotes: (notes) => set({ teacherNotes: notes }),
  addSession: (session) => set((s) => ({ sessions: [session, ...s.sessions] })),
  addPiece: (piece) => set((s) => ({ pieces: [piece, ...s.pieces] })),
  addPerformance: (performance) => set((s) => ({ performances: [performance, ...s.performances] })),
  // Timer
  timerRunning: false,
  timerStartedAt: null,
  startTimer: () => set({ timerRunning: true, timerStartedAt: Date.now() }),
  stopTimer: () => {
    const { timerStartedAt } = get()
    const elapsed = timerStartedAt ? Math.floor((Date.now() - timerStartedAt) / 1000) : 0
    set({ timerRunning: false, timerStartedAt: null })
    return elapsed
  },
  resetTimer: () => set({ timerRunning: false, timerStartedAt: null }),
}))
