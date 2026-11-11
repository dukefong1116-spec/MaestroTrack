import type { Assignment, LessonSlot, Message, Performance, Piece, PracticeSession, Recording } from '@/types'

/**
 * The last thing you saw, kept on this device, so opening the app shows
 * Today at once instead of waiting on the network — the way the fastest
 * apps start (Linear, Twitter Lite). The live data replaces it a moment
 * later, as it arrives.
 *
 * For showing only. Nothing is ever written to Firestore from here, and
 * nothing that writes on its own runs on it: Firestore's own offline cache
 * was taken out of this app because it queued writes locally and called
 * them saved, and this must never do the same. See useStudentData for
 * where it is read and kept up to date.
 *
 * A few records per account — a student's lists, their league, a
 * teacher's studio — in IndexedDB (larger and off the main thread, unlike
 * localStorage). Cleared on sign-out. Any failure — private mode, storage
 * full, an old shape — just means starting without it.
 */

/** A student's own lists: everything their pages read. */
export interface Snapshot {
  sessions: PracticeSession[]
  pieces: Piece[]
  assignments: Assignment[]
  lessons: LessonSlot[]
  performances: Performance[]
  recordings: Recording[]
  messages: Message[]
}

/** Which record: a student's lists by uid alone, the rest by a suffix. */
export const snapshotKey = {
  student: (uid: string) => uid,
  league: (uid: string) => `${uid}:league`,
  teacher: (uid: string) => `${uid}:teacher`,
}

const DB = 'maestro-snapshot'
const STORE = 'snapshots'
/** Bump when the shape changes; older records are then ignored. */
const VERSION = 2

interface Row<T> { v: number; savedAt: number; data: T }

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); resolve(req.result) }
    tx.onerror = () => { db.close(); reject(tx.error) }
    tx.onabort = () => { db.close(); reject(tx.error) }
  }))
}

export async function readSnapshot<T = Snapshot>(key: string): Promise<T | null> {
  try {
    const row = await run<Row<T> | undefined>('readonly', (s) => s.get(key) as IDBRequest<Row<T> | undefined>)
    if (!row || row.v !== VERSION || !row.data || typeof row.data !== 'object') return null
    return row.data
  } catch {
    return null
  }
}

export async function writeSnapshot<T = Snapshot>(key: string, data: T): Promise<void> {
  try {
    const row: Row<T> = { v: VERSION, savedAt: Date.now(), data }
    await run('readwrite', (s) => s.put(row, key))
  } catch {
    // Full, private, or unavailable: the next open is simply not instant.
  }
}

/** On sign-out: nothing of anyone's stays on the device. */
export async function clearSnapshots(): Promise<void> {
  try {
    await run('readwrite', (s) => s.clear())
  } catch {
    // Nothing stored, or storage unavailable.
  }
}
