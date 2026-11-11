/**
 * How long Today took to appear, measured on this device, so the real
 * figure can be read off a phone (Settings › About) rather than guessed.
 *
 * Two moments per open, from the instant the page started loading:
 *  - shown: Today first drew something real (from the saved copy or live)
 *  - live:  the live practice data had arrived
 * The last five opens are kept. Nothing leaves the device.
 */

const KEY = 'maestro_open_times'
export interface OpenTime { at: number; shown: number; live?: number }

let current: OpenTime | null = null

function read(): OpenTime[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function save() {
  if (!current) return
  try {
    const list = read().filter((t) => t.at !== current!.at)
    localStorage.setItem(KEY, JSON.stringify([current, ...list].slice(0, 5)))
  } catch { /* storage unavailable */ }
}

/** Once per page load: Today has something real on it. */
export function markTodayShown() {
  if (current) return
  current = { at: Date.now(), shown: Math.round(performance.now()) }
  save()
}

/** Once per page load: the live data is in. */
export function markTodayLive() {
  if (!current || current.live !== undefined) return
  current.live = Math.round(performance.now())
  save()
}

export function recentOpenTimes(): OpenTime[] {
  return read()
}
