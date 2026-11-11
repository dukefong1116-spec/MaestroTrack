import { create } from 'zustand'
import type { PracticeSession, Piece, Performance, Recording, Message, LessonSlot, Assignment } from '@/types'
import type { Snapshot } from '@/lib/cache/snapshot'

type SnapshotKey = keyof Snapshot

interface PracticeState {
  sessions: PracticeSession[]
  pieces: Piece[]
  performances: Performance[]
  recordings: Recording[]
  /** This student's messages with their teacher, oldest first. */
  messages: Message[]
  lessons: LessonSlot[]
  /** Every assignment set for this student — one subscription for the whole app. */
  assignments: Assignment[]
  /** True after the current user's first practice-session snapshot arrives. */
  sessionsLoaded: boolean
  /**
   * Which lists have had their live data. Until then a list may be showing
   * the saved copy from the last visit (see lib/cache/snapshot) — fine to
   * look at, never to act on. `sessionsLoaded` is the live one for sessions.
   */
  live: Record<SnapshotKey, boolean>
  /** Fill in, from the saved copy, whatever has not arrived live yet. */
  hydrate: (snap: Snapshot) => void
  resetUserData: () => void
  setSessions: (sessions: PracticeSession[]) => void
  setPieces: (pieces: Piece[]) => void
  setPerformances: (performances: Performance[]) => void
  setRecordings: (recordings: Recording[]) => void
  setMessages: (messages: Message[]) => void
  setLessons: (lessons: LessonSlot[]) => void
  setAssignments: (assignments: Assignment[]) => void
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

/**
 * Optimistic prepend that ignores anything already present.
 *
 * Every one of these lists is also filled by a live Firestore
 * subscription. The write helpers resolve only once Firestore has
 * acknowledged the document, and the subscription has usually delivered it
 * through the matching setter before that promise settles — so adding it
 * again showed it twice, and nothing removed the copy until some unrelated
 * change triggered a fresh snapshot.
 *
 * It bit sessions first and pieces second. Shared so it cannot bite a
 * third list separately.
 */
function prepend<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list : [item, ...list]
}

export const usePracticeStore = create<PracticeState>((set, get) => ({
  sessions: [],
  pieces: [],
  performances: [],
  recordings: [],
  messages: [],
  lessons: [],
  assignments: [],
  sessionsLoaded: false,
  live: { sessions: false, pieces: false, assignments: false, lessons: false },
  hydrate: (snap) => set((s) => ({
    sessions: s.live.sessions ? s.sessions : snap.sessions,
    pieces: s.live.pieces ? s.pieces : snap.pieces,
    assignments: s.live.assignments ? s.assignments : snap.assignments,
    lessons: s.live.lessons ? s.lessons : snap.lessons,
  })),
  resetUserData: () => set({
    sessions: [], pieces: [], performances: [], recordings: [], messages: [], lessons: [], assignments: [],
    sessionsLoaded: false, live: { sessions: false, pieces: false, assignments: false, lessons: false },
    timerRunning: false, timerStartedAt: null, timerAccumulatedSec: 0,
  }),
  setSessions: (sessions) => set((s) => ({ sessions, sessionsLoaded: true, live: { ...s.live, sessions: true } })),
  setPieces: (pieces) => set((s) => ({ pieces, live: { ...s.live, pieces: true } })),
  setPerformances: (performances) => set({ performances }),
  setRecordings: (recordings) => set({ recordings }),
  setMessages: (messages) => set({ messages }),
  setLessons: (lessons) => set((s) => ({ lessons, live: { ...s.live, lessons: true } })),
  setAssignments: (assignments) => set((s) => ({ assignments, live: { ...s.live, assignments: true } })),
  addSession: (session) => set((s) => ({ sessions: prepend(s.sessions, session) })),
  addPiece: (piece) => set((s) => ({ pieces: prepend(s.pieces, piece) })),
  addPerformance: (performance) => set((s) => ({ performances: prepend(s.performances, performance) })),
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
