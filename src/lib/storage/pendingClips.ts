import type { PracticeCategory } from '@/types'

/**
 * Takes waiting to be uploaded, held in IndexedDB.
 *
 * Recorded audio used to live only in a JS variable, so closing the tab
 * during an upload destroyed it — and since uploads blocked the end of a
 * session, that window was exactly when people were most likely to give up
 * and close it. The error copy admitted as much: "still held in this tab".
 *
 * A clip is written here the moment recording stops and deleted only once
 * the upload has genuinely landed. Anything still here on a later visit is
 * something we owe the user.
 */

const DB_NAME = 'maestro_pending_clips'
const STORE = 'clips'
const VERSION = 1

export interface PendingClip {
  id: string
  blob: Blob
  seconds: number
  ext: string
  /** Set once the session row exists; null while the session is unfinished. */
  sessionId: string | null
  /** The session's own date, so a clip uploaded tomorrow is still dated today. */
  date: string
  pieceName: string
  notes?: string
  category?: PracticeCategory
  userId: string
  createdAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run<T>(mode: IDBTransactionMode, make: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = make(t.objectStore(STORE))
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
    t.oncomplete = () => db.close()
  })
}

/**
 * Every call is best-effort. Private browsing, a full disk or a browser
 * with storage disabled must degrade to the old in-memory behaviour rather
 * than break recording itself — losing durability is bad, losing the
 * ability to record is worse.
 */
export async function putClip(clip: PendingClip): Promise<void> {
  try {
    await run('readwrite', (s) => s.put(clip))
  } catch {
    /* durability unavailable — the in-memory copy still works this session */
  }
}

export async function deleteClip(id: string): Promise<void> {
  try {
    await run('readwrite', (s) => s.delete(id))
  } catch {
    /* nothing to clean up */
  }
}

/** Clips owed to this user, oldest first. */
export async function listClips(userId: string): Promise<PendingClip[]> {
  try {
    const all = await run<PendingClip[]>('readonly', (s) => s.getAll())
    return all.filter((c) => c.userId === userId).sort((a, b) => a.createdAt - b.createdAt)
  } catch {
    return []
  }
}

/**
 * Attaches a session to clips recorded before it was saved, along with the
 * fields that are only settled at that point — which piece it was, what was
 * written down, and the session's own date (so a clip uploaded tomorrow is
 * still filed under today).
 */
export async function assignSession(
  ids: string[],
  sessionId: string,
  patch: Pick<PendingClip, 'date' | 'pieceName'> & Partial<Pick<PendingClip, 'notes' | 'category'>>
): Promise<void> {
  for (const id of ids) {
    try {
      const existing = await run<PendingClip | undefined>('readonly', (s) => s.get(id))
      if (existing) await putClip({ ...existing, ...patch, sessionId })
    } catch {
      /* best effort */
    }
  }
}
