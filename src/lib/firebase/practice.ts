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
  const q = query(
    collection(db, COL),
    where('userId', '==', userId),
    orderBy('date', 'desc'),
    limit(max)
  )
  return onSnapshot(q, (snap) => {
    const sorted = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as PracticeSession)
      .sort((a, b) => b.date.localeCompare(a.date))
    callback(sorted)
  })
}

export { Timestamp }
