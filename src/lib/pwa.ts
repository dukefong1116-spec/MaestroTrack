import { registerSW } from 'virtual:pwa-register'
import { usePracticeStore } from '@/stores/practiceStore'

/**
 * The service worker: the app's own files kept on the phone, so opening it
 * starts from there rather than the network (see VitePWA in
 * vite.config.ts).
 *
 * A new version downloads in the background. Switching to it reloads the
 * page, so it only happens when nothing can be lost:
 *  - right as the app opens, before anything has been touched, or
 *  - when you leave the app from one of the main screens,
 * and never during a practice session, with a timer counting, or with a
 * form half filled in on some other screen. Otherwise it simply waits for
 * the next of those moments.
 */

const LAUNCH_WINDOW_MS = 4000
// Screens with nothing to lose: no form, no timer, no recording.
const CALM = /^\/(student|teacher)(\/(league|streak|practice\/progress|library))?\/?$/

export function startServiceWorker(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return

  const openedAt = performance.now()
  let touched = false
  const markTouched = () => { touched = true }
  window.addEventListener('pointerdown', markTouched, { once: true, capture: true })
  window.addEventListener('keydown', markTouched, { once: true, capture: true })

  let waiting = false
  let applying = false

  const busy = () => {
    const { timerRunning, timerAccumulatedSec } = usePracticeStore.getState()
    return timerRunning || timerAccumulatedSec > 0 || location.pathname.startsWith('/student/session')
  }

  const apply = () => {
    if (!waiting || applying || busy()) return
    const atLaunch = !touched && performance.now() - openedAt < LAUNCH_WINDOW_MS
    const leaving = document.visibilityState === 'hidden' && CALM.test(location.pathname)
    if (!atLaunch && !leaving) return
    applying = true
    void updateSW(true)
  }

  const updateSW = registerSW({
    onNeedRefresh() {
      waiting = true
      apply()
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // Look for a new version whenever the app comes back to the front,
      // and every hour it stays open.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update().catch(() => {})
      })
      setInterval(() => { void registration.update().catch(() => {}) }, 60 * 60 * 1000)
    },
  })

  document.addEventListener('visibilitychange', apply)
}
