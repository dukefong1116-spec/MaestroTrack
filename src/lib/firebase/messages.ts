import {
  addDoc, collection, deleteDoc, doc, query, where, type Unsubscribe,
} from 'firebase/firestore'
import { db } from './config'
import { onSnapshotError, onServerSnapshot } from './snapshotError'
import { cleanForFirestore } from './clean'
import type { Message } from '@/types'

/**
 * Messages between a teacher and a student.
 *
 * One flat collection, each message carrying both ids, so each side reads
 * its own with one equality query the rules can prove: a student by
 * studentId, a teacher by teacherId. Ordered here rather than in the
 * query, so no composite index is needed. Messages are never edited; the
 * sender may delete their own.
 */

const COL = 'messages'

const byTime = (a: Message, b: Message) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)

export async function sendMessage(m: Omit<Message, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, COL), cleanForFirestore({ ...m, createdAt: new Date().toISOString() }))
  return ref.id
}

export async function deleteMessage(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}

/** Every message a student is part of, oldest first. */
export function subscribeStudentMessages(studentId: string, callback: (messages: Message[]) => void): Unsubscribe {
  const q = query(collection(db, COL), where('studentId', '==', studentId))
  return onServerSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Message).sort(byTime))
  }, onSnapshotError('messages'))
}

/** Every message a teacher is part of, across all their students, oldest first. */
export function subscribeTeacherMessages(teacherId: string, callback: (messages: Message[]) => void): Unsubscribe {
  const q = query(collection(db, COL), where('teacherId', '==', teacherId))
  return onServerSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Message).sort(byTime))
  }, onSnapshotError('messages'))
}
