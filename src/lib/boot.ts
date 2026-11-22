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
