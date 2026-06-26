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
} from 'firebase/firestore'
import { db } from './config'
import type { Performance } from '@/types'

const COL = 'performances'

export async function addPerformance(
  userId: string,
  data: Omit<Performance, 'id' | 'userId'>
): Promise<string> {
  addDoc(collection(db, COL), { ...data, userId }).catch(() => {})
  return crypto.randomUUID()
}

export async function updatePerformance(id: string, data: Partial<Performance>): Promise<void> {
  await updateDoc(doc(db, COL, id), data)
}

export async function deletePerformance(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}

export function subscribePerformances(
  userId: string,
  callback: (performances: Performance[]) => void
): Unsubscribe {
  const q = query(collection(db, COL), where('userId', '==', userId), orderBy('date', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Performance))
  })
}
