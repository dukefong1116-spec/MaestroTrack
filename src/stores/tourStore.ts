import { create } from 'zustand'
import type { SessionSub } from '@/lib/utils/tour'

/**
 * Where the first-run tour is inside the first session.
 *
 * Memory only, on purpose: a reload ends the session, and with it these
 * steps, so the tour falls back to its saved checkpoint ("tap Start")
 * instead of pointing at a session that is not there any more.
 */
export const useTourStore = create<{ sub: SessionSub | null; setSub: (sub: SessionSub | null) => void }>((set) => ({
  sub: null,
  setSub: (sub) => set({ sub }),
}))
