import { useEffect } from 'react'
import { create } from 'zustand'

/**
 * How many full-screen celebrations are on screen right now. A badge won
 * mid-session waits for the session's own moments to finish rather than
 * landing on top of them.
 */
export const useMomentStore = create<{ open: number }>(() => ({ open: 0 }))

/** Counts this celebration as on screen while `open` is true. */
export function useHoldMoment(open: boolean) {
  useEffect(() => {
    if (!open) return
    useMomentStore.setState((s) => ({ open: s.open + 1 }))
    return () => useMomentStore.setState((s) => ({ open: Math.max(0, s.open - 1) }))
  }, [open])
}
