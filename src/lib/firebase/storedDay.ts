/**
 * A stored `date`, as the 'yyyy-MM-dd' string the whole app expects.
 *
 * Every writer in the app saves `date` as that string, and more than
 * twenty places read it as one — `date.substring(0, 10)` to find the day.
 * But a document is only as tidy as whatever wrote it, and one session
 * saved with its date as a Firestore Timestamp (by a version of the code
 * that never shipped, run against the live database) made every one of
 * those reads throw, and took the whole app down with it.
 *
 * So the shape is settled here, once, as documents are read, rather than
 * trusted in twenty places:
 *  - a string that starts with a date is kept as it is;
 *  - a Timestamp, Date or epoch number becomes its day. In UTC, because
 *    the one writer known to have saved Timestamps saved the day at UTC
 *    midnight, which UTC reads back exactly;
 *  - anything else falls back to the day it was created;
 *  - and with neither, null — the caller leaves that document out rather
 *    than show a session on no day at all.
 */

const STARTS_WITH_DAY = /^\d{4}-\d{2}-\d{2}/

function asJsDate(raw: unknown): Date | null {
  let d: Date | null = null
  if (raw instanceof Date) d = raw
  else if (typeof raw === 'number') d = new Date(raw)
  else if (raw && typeof raw === 'object') {
    const t = raw as { toDate?: () => Date; seconds?: number }
    if (typeof t.toDate === 'function') d = t.toDate()
    else if (typeof t.seconds === 'number') d = new Date(t.seconds * 1000)
  }
  return d && !Number.isNaN(d.getTime()) ? d : null
}

export function storedDay(raw: unknown, createdAt?: unknown): string | null {
  if (typeof raw === 'string' && STARTS_WITH_DAY.test(raw)) return raw
  const d = asJsDate(raw)
  if (d) return d.toISOString().slice(0, 10)
  if (typeof createdAt === 'string' && STARTS_WITH_DAY.test(createdAt)) return createdAt.slice(0, 10)
  return null
}

/**
 * A document's data with its `date` settled, or null when it has no day
 * at all. Shared by sessions and recordings, which are read the same way.
 */
export function withStoredDay<T extends { date: string }>(id: string, data: Record<string, unknown>, kind: string): T | null {
  const date = storedDay(data.date, data.createdAt)
  if (date === null) {
    console.warn(`[${kind}] ${id} has no readable date and is left out`)
    return null
  }
  return { id, ...data, date } as unknown as T
}
