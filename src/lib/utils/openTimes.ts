/**
 * How long the app took to open, measured on this device, so the real
 * figures can be read off a phone (Settings › About) rather than guessed.
 *
 * Milliseconds from the instant the page started loading:
 *  - shown:   Today first drew something real (saved copy or live)
 *  - auth:    Firebase said who is signed in
 *  - profile: the server's copy of the profile arrived
 *  - live:    the live practice data arrived
 * The last five opens are kept. Nothing leaves the device.
 */

const KEY = 'maestro_open_times'
export interface OpenTime { at: number; shown?: number; auth?: number; profile?: number; live?: number }
type Moment = Exclude<keyof OpenTime, 'at'>

const current: OpenTime = { at: Date.now() }
// Only what was measured from a real start counts: a moment reached long
// after opening (signing in by hand, returning to Today later) says
// nothing about how fast the app opens.
const LATE_MS = 60_000

function read(): OpenTime[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/** Once per page load, per moment. */
export function markOpen(moment: Moment) {
  if (current[moment] !== undefined) return
  const ms = Math.round(performance.now())
  if (ms > LATE_MS) return
  current[moment] = ms
  // Saved only once Today has drawn, so a visit to the login page or the
  // teacher side does not fill the list.
  if (current.shown === undefined) return
  try {
    const list = read().filter((t) => t.at !== current.at)
    localStorage.setItem(KEY, JSON.stringify([current, ...list].slice(0, 5)))
  } catch { /* storage unavailable */ }
}

export function recentOpenTimes(): OpenTime[] {
  return read()
}
