import { useState } from 'react'

/**
 * Whether the viewer has asked for reduced motion.
 *
 * Read once on mount rather than subscribed to: every celebration that
 * uses it is short-lived, and a preference flipping mid-animation would
 * strand a half-played tween.
 *
 * Lives apart from the Moment component so that file exports only a
 * component, which is what React Fast Refresh needs to reload it cleanly.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced] = useState(() => {
    if (typeof window === 'undefined') return false
    // Either source counts: the OS setting, or the switch in Settings.
    // CSS handles its own transitions; this is what stops the JS ones.
    if (document.documentElement.dataset.motion === 'reduce') return true
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  })
  return reduced
}
