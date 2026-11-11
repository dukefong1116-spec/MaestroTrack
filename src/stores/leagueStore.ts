import { create } from 'zustand'
import { syncLeague, type SyncResult } from '@/lib/firebase/league'
import type { LeagueRoom } from '@/types'

/**
 * The latest word from the league server, shared app-wide.
 *
 * `climb` is a rank change not yet shown: set when a sync moves you, and
 * cleared by whichever screen plays the climb first — the session
 * celebration, or the League tab if you go there before seeing it.
 */
export interface Climb {
  oldRank: number
  newRank: number
  oldXp: number
  xp: number
  size: number
}

interface LeagueStore {
  result: SyncResult | null
  syncing: boolean
  failed: boolean
  climb: Climb | null
  /** Your room, live — one listener for the League tab and the bell alike. */
  room: LeagueRoom | null
  setRoom: (room: LeagueRoom | null) => void
  /**
   * One sync at a time, in order. A call made while another is running
   * runs after it rather than sharing its answer: the running one may
   * have started before the session just saved, and the celebration needs
   * the count that includes it.
   */
  sync: () => Promise<SyncResult | null>
  takeClimb: () => Climb | null
  reset: () => void
}

let queue: Promise<unknown> = Promise.resolve()

export const useLeagueStore = create<LeagueStore>((set, get) => ({
  result: null,
  syncing: false,
  failed: false,
  climb: null,
  room: null,
  setRoom: (room) => set({ room }),
  sync: () => {
    const run = async (): Promise<SyncResult | null> => {
      set({ syncing: true })
      try {
        const r = await syncLeague()
        const moved = r.roomId && r.oldRank && r.newRank && (r.oldRank !== r.newRank || (r.oldXp ?? r.xp) !== r.xp)
        const climb = moved
          ? { oldRank: r.oldRank!, newRank: r.newRank!, oldXp: r.oldXp ?? r.xp, xp: r.xp, size: r.size ?? 0 }
          : null
        // Two moves before either is shown play as one climb, from where
        // you were first to where you are now.
        const prev = get().climb
        const merged = climb && prev ? { ...climb, oldRank: prev.oldRank, oldXp: prev.oldXp } : climb ?? prev
        set({ result: r, syncing: false, failed: false, climb: merged })
        return r
      } catch {
        set({ syncing: false, failed: true })
        return null
      }
    }
    const next = queue.then(run, run)
    queue = next
    return next
  },
  takeClimb: () => {
    const c = get().climb
    if (c) set({ climb: null })
    return c
  },
  reset: () => set({ result: null, syncing: false, failed: false, climb: null, room: null }),
}))
