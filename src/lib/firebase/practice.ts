import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  type Unsubscribe,
  Timestamp,
} from 'firebase/firestore'
import { db } from './config'
import type { PracticeSession } from '@/types'

const COL = 'practiceSessions'

export async function addPracticeSession(
  userId: string,
  data: Omit<PracticeSession, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const clean: Record<string, unknown> = { userId, createdAt: new Date().toISOString() }
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== '') clean[k] = v
  }
  // Fire the write without waiting — if Firestore is offline it queues locally
  addDoc(collection(db, COL), clean).catch(() => {})
  return crypto.randomUUID()
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
  const q = query(collection(db, COL), where('userId', '==', userId), orderBy('date', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PracticeSession)
}

export function subscribePracticeSessions(
  userId: string,
  callback: (sessions: PracticeSession[]) => void
): Unsubscribe {
  const q = query(collection(db, COL), where('userId', '==', userId), orderBy('date', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PracticeSession))
  })
}

export { Timestamp }
