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
}

export const usePracticeStore = create<PracticeState>((set) => ({
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
}))
