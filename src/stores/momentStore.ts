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

/**
 * How many things are covering the page right now (a sheet, the guide).
 * Apple's glass controls sit above the whole page in the iPhone app, so
 * they step aside while anything is — see lib/nativeGlass.
 */
export const useCoverStore = create<{ open: number }>(() => ({ open: 0 }))

/** Counts this as covering the page while `open` is true. */
export function useHoldCover(open: boolean) {
  useEffect(() => {
    if (!open) return
    useCoverStore.setState((s) => ({ open: s.open + 1 }))
    return () => useCoverStore.setState((s) => ({ open: Math.max(0, s.open - 1) }))
  }, [open])
}
