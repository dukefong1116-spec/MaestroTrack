/**
 * Local calendar dates as 'yyyy-MM-dd' and times as 'HH:mm'.
 *
 * Never through toISOString: that is UTC, and west of Greenwich it moves
 * an evening lesson onto the next day.
 */

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Midnight, local, on that date. */
export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key)
  d.setDate(d.getDate() + n)
  return dayKey(d)
}

/** 0 = Sunday, as Date.getDay and LessonSlot have it. */
export function weekday(key: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return parseDay(key).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6
}

/** The Monday of the week holding this date. */
export function mondayOf(key: string): string {
  const wd = weekday(key)
  return addDays(key, wd === 0 ? -6 : 1 - wd)
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10))
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

export function fromMinutes(total: number): string {
  const t = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)))
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** '15:30' → '3:30 PM' */
export function clock(time: string | number): string {
  const total = typeof time === 'number' ? time : toMinutes(time)
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export function money(cents: number): string {
  const neg = cents < 0
  const v = Math.abs(cents) / 100
  return `${neg ? '−' : ''}$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)}`
}

export function moneyExact(cents: number): string {
  return `${cents < 0 ? '−' : ''}$${(Math.abs(cents) / 100).toFixed(2)}`
}
