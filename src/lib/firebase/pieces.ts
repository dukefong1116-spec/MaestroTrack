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
import type { Piece } from '@/types'

const COL = 'pieces'

export async function addPiece(userId: string, data: Omit<Piece, 'id' | 'userId'>): Promise<string> {
  addDoc(collection(db, COL), { ...data, userId }).catch(() => {})
  return crypto.randomUUID()
}

export async function updatePiece(id: string, data: Partial<Piece>): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...data, updatedAt: new Date().toISOString() })
}

export async function deletePiece(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}

export async function getPieces(userId: string): Promise<Piece[]> {
  const q = query(collection(db, COL), where('userId', '==', userId), orderBy('updatedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Piece)
}

export function subscribePieces(userId: string, callback: (pieces: Piece[]) => void): Unsubscribe {
  const q = query(collection(db, COL), where('userId', '==', userId), orderBy('updatedAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Piece))
  })
}
