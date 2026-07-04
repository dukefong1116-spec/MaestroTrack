import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './config'
import type { LessonSlot } from '@/types'

const COL = 'lessonSlots'

export async function createLessonSlot(
  teacherId: string,
  data: Omit<LessonSlot, 'id' | 'teacherId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date().toISOString()
  const ref = await addDoc(collection(db, COL), { ...data, teacherId, createdAt: now, updatedAt: now })
  return ref.id
}

export async function updateLessonSlot(id: string, data: Partial<LessonSlot>): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteLessonSlot(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}

export function subscribeTeacherSchedule(
  teacherId: string,
  callback: (slots: LessonSlot[]) => void
): Unsubscribe {
  const q = query(collection(db, COL), where('teacherId', '==', teacherId))
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LessonSlot))
  )
}

export function subscribeStudentSchedule(
  studentId: string,
  callback: (slots: LessonSlot[]) => void
): Unsubscribe {
  const q = query(collection(db, COL), where('studentId', '==', studentId))
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LessonSlot))
  )
}
