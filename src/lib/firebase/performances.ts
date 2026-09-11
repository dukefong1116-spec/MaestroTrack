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
} from 'firebase/firestore'
import { db } from './config'
import type { Performance } from '@/types'

const COL = 'performances'

export async function addPerformance(
  userId: string,
  data: Omit<Performance, 'id' | 'userId'>
): Promise<string> {
  const clean: Record<string, unknown> = { userId }
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== '') clean[k] = v
  }
  const ref = await addDoc(collection(db, COL), clean)
  return ref.id
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
  const q = query(collection(db, COL), where('userId', '==', userId))
  return onSnapshot(q, (snap) => {
    const sorted = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Performance)
      .sort((a, b) => a.date.localeCompare(b.date))
    callback(sorted)
  })
}
