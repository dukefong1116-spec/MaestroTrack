/**
 * The launch screen (index.html's #boot) waits for the first real page.
 * Whatever draws one says so here; LaunchScreen listens.
 */
let ready = false
export function bootReady() {
  if (ready) return
  ready = true
  window.dispatchEvent(new Event('femata:ready'))
}
export const isBootReady = () => ready

/** The launch screen has gone (or there never was one, as in a browser tab). */
let finished = typeof document === 'undefined' || !document.getElementById('boot')
const waiting = new Set<() => void>()
export function bootFinished() {
  if (finished) return
  finished = true
  waiting.forEach((f) => f())
}
export const isBootFinished = () => finished
export function onBootFinished(f: () => void) {
  waiting.add(f)
  return () => { waiting.delete(f) }
}
