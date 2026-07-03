import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
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
  const ref = await addDoc(collection(db, COL), clean)
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

export function subscribePracticeSessions(
  userId: string,
  callback: (sessions: PracticeSession[]) => void
): Unsubscribe {
  const q = query(collection(db, COL), where('userId', '==', userId))
  return onSnapshot(q, (snap) => {
    const sorted = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as PracticeSession)
      .sort((a, b) => b.date.localeCompare(a.date))
    callback(sorted)
  })
}

export { Timestamp }
