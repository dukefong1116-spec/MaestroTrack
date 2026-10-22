import { useEffect, useState } from 'react'

/**
 * One clock for everything that ages.
 *
 * Several things on screen are only correct for a minute at a time — the
 * streak countdown, "your lesson starts in 40 minutes", a notification
 * that becomes true at a particular hour. Each of those used to be
 * entitled to its own setInterval, which meant two timers per tab drifting
 * a few hundred milliseconds apart and two separate re-render cascades
 * every minute for the same reason.
 *
 * Sharing one tick is not just tidier: the values stay consistent with
 * each other, so a nudge and a notification derived from the same instant
 * can never disagree about what time it is.
 */
export function useMinuteTick(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}
