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
  /** When the current *run* began. Null while paused. */
  timerStartedAt: number | null
  /** Seconds banked by previous runs, so pausing does not discard them. */
  timerAccumulatedSec: number
  startTimer: () => void
  /** Pause without losing the clock. Returns total elapsed seconds. */
  pauseTimer: () => number
  stopTimer: () => number  // returns total elapsed seconds, then clears
  resetTimer: () => void
  /** Total elapsed seconds, running or paused. */
  elapsedSeconds: () => number
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
  /* Timer
   *
   * Elapsed time is banked on pause rather than recomputed from a single
   * start instant. It used to be the latter, which meant pausing cleared
   * timerStartedAt and resuming set it to now — so tapping the big "tap to
   * pause" control and carrying on silently discarded the whole session.
   * A 52-minute practice came back as 00:00.
   */
  timerRunning: false,
  timerStartedAt: null,
  timerAccumulatedSec: 0,

  elapsedSeconds: () => {
    const { timerRunning, timerStartedAt, timerAccumulatedSec } = get()
    const live = timerRunning && timerStartedAt ? (Date.now() - timerStartedAt) / 1000 : 0
    return Math.floor(timerAccumulatedSec + live)
  },

  startTimer: () => set({ timerRunning: true, timerStartedAt: Date.now() }),

  pauseTimer: () => {
    const total = get().elapsedSeconds()
    set({ timerRunning: false, timerStartedAt: null, timerAccumulatedSec: total })
    return total
  },

  stopTimer: () => {
    const total = get().elapsedSeconds()
    set({ timerRunning: false, timerStartedAt: null, timerAccumulatedSec: 0 })
    return total
  },

  resetTimer: () => set({ timerRunning: false, timerStartedAt: null, timerAccumulatedSec: 0 }),
}))
