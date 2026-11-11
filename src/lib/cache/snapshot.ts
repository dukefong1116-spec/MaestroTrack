import type { Assignment, LessonSlot, Piece, PracticeSession } from '@/types'

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
 * One record per account, in IndexedDB (larger and off the main thread,
 * unlike localStorage). Cleared on sign-out. Any failure — private mode,
 * storage full, an old shape — just means starting without it.
 */

export interface Snapshot {
  sessions: PracticeSession[]
  pieces: Piece[]
  assignments: Assignment[]
  lessons: LessonSlot[]
}

const DB = 'maestro-snapshot'
const STORE = 'snapshots'
/** Bump when the shape changes; older records are then ignored. */
const VERSION = 1

interface Row { v: number; savedAt: number; data: Snapshot }

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

export async function readSnapshot(uid: string): Promise<Snapshot | null> {
  try {
    const row = await run<Row | undefined>('readonly', (s) => s.get(uid) as IDBRequest<Row | undefined>)
    if (!row || row.v !== VERSION || !row.data || !Array.isArray(row.data.sessions)) return null
    return row.data
  } catch {
    return null
  }
}

export async function writeSnapshot(uid: string, data: Snapshot): Promise<void> {
  try {
    const row: Row = { v: VERSION, savedAt: Date.now(), data }
    await run('readwrite', (s) => s.put(row, uid))
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
