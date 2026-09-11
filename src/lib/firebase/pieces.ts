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
import type { Piece } from '@/types'

const COL = 'pieces'

export async function addPiece(userId: string, data: Omit<Piece, 'id' | 'userId'>): Promise<string> {
  // Firestore rejects `undefined` outright, which would fail the whole
  // write when an optional field (composer, targetDate, notes) is blank.
  const clean: Record<string, unknown> = { userId }
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== '') clean[k] = v
  }
  const ref = await addDoc(collection(db, COL), clean)
  return ref.id
}

export async function updatePiece(id: string, data: Partial<Piece>): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...data, updatedAt: new Date().toISOString() })
}

export async function deletePiece(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}

export async function getPieces(userId: string): Promise<Piece[]> {
  const q = query(collection(db, COL), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Piece)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function subscribePieces(userId: string, callback: (pieces: Piece[]) => void): Unsubscribe {
  const q = query(collection(db, COL), where('userId', '==', userId))
  return onSnapshot(q, (snap) => {
    const sorted = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Piece)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    callback(sorted)
  })
}
