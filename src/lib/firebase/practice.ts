import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  type Unsubscribe,
  Timestamp,
} from 'firebase/firestore'
import { db } from './config'
import { cleanForFirestore } from './clean'
import type { PracticeSession } from '@/types'

const COL = 'practiceSessions'

export async function addPracticeSession(
  userId: string,
  data: Omit<PracticeSession, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(
    collection(db, COL),
    cleanForFirestore({ ...data, userId, createdAt: new Date().toISOString() })
  )
  return ref.id
}

export async function updatePracticeSession(
  id: string,
  data: Partial<PracticeSession>
): Promise<void> {
  await updateDoc(doc(db, COL, id), data)
}

export async function deletePracticeSession(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}

export async function getPracticeSessions(userId: string): Promise<PracticeSession[]> {
  const q = query(collection(db, COL), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as PracticeSession)
    .sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * How much history the app holds at once.
 *
 * Everything derived — streaks, XP, piece totals, assignment progress — is
 * computed from this array, so it has to cover enough history to be
 * correct while staying small enough to download on every visit. Two years
 * of daily practice fits comfortably and outlasts every window any of
 * those calculations look at.
 *
 * Without a bound this fetched a student's entire history forever, growing
 * every single day they practised.
 */
const RECENT_SESSIONS = 800

export function subscribePracticeSessions(
  userId: string,
  callback: (sessions: PracticeSession[]) => void,
  max = RECENT_SESSIONS
): Unsubscribe {
  const toSessions = (snap: { docs: { id: string; data: () => unknown }[] }) =>
    snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as object) }) as PracticeSession)
      .sort((a, b) => b.date.localeCompare(a.date))

  let fallback: Unsubscribe | null = null

  /**
   * The bounded query needs a composite index, and an equality filter
   * combined with an order on another field has no index until someone
   * creates one. Firestore rejects the query entirely when it is missing —
   * and with no error handler the callback simply never fired, so a
   * student with two years of practice saw "No sessions yet" and nothing
   * anywhere said why. The data was never in danger; it was unreachable.
   *
   * So the index is an optimisation, not a requirement. Without it this
   * falls back to the unordered query, which needs no composite index,
   * and trims client-side — more bandwidth, but a working app beats a
   * fast empty one.
   */
  const primary = onSnapshot(
    query(collection(db, COL), where('userId', '==', userId), orderBy('date', 'desc'), limit(max)),
    (snap) => callback(toSessions(snap)),
    (err) => {
      console.warn(
        '[sessions] the ordered query failed (%s) — falling back to the unordered one. ' +
        'If this is failed-precondition, the console error above carries a link that ' +
        'creates the missing index.', err.code
      )
      fallback = onSnapshot(
        query(collection(db, COL), where('userId', '==', userId)),
        (snap) => callback(toSessions(snap).slice(0, max)),
        (e) => console.error('[sessions] could not read practice sessions at all:', e.code)
      )
    }
  )

  return () => { primary(); fallback?.() }
}

export { Timestamp }
