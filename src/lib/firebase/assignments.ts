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
import type { Assignment, PracticeCategory } from '@/types'

const COL = 'assignments'

export async function createAssignment(
  teacherId: string,
  studentId: string,
  data: {
    title: string
    description?: string
    dueDate?: string
    category?: PracticeCategory
    targetMinutes?: number
  }
): Promise<string> {
  const now = new Date().toISOString()
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
  const ref = await addDoc(collection(db, COL), {
    teacherId,
    studentId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...clean,
  })
  return ref.id
}

export function subscribeStudentAssignments(
  studentId: string,
  callback: (assignments: Assignment[]) => void
): Unsubscribe {
  const q = query(collection(db, COL), where('studentId', '==', studentId))
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Assignment))
  )
}

export function subscribeTeacherStudentAssignments(
  teacherId: string,
  studentId: string,
  callback: (assignments: Assignment[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where('teacherId', '==', teacherId),
    where('studentId', '==', studentId)
  )
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Assignment))
  )
}

export async function updateAssignmentStatus(
  id: string,
  status: Assignment['status']
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    status,
    updatedAt: new Date().toISOString(),
    ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}),
  })
}

export async function deleteAssignment(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}
