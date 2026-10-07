import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  arrayUnion,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './config'
import { onSnapshotError } from './snapshotError'
import { cleanForFirestore } from './clean'
import type { Assignment, PracticeCategory, Submission, TeacherFeedback } from '@/types'

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
    requiresRecording?: boolean
    dailyTargetMinutes?: number
    type?: 'task' | 'daily'
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
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Assignment)), onSnapshotError('assignments'))
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
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Assignment)), onSnapshotError('assignments'))
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

/* ── the review loop ──────────────────────────────────────────────────
 * Added alongside the originals rather than replacing them: the create,
 * subscribe and delete paths above are untouched and still in use.
 */

/**
 * Hand work in. Appends rather than overwrites, so a resubmission after
 * feedback keeps the earlier attempt — the trail of attempts is the record
 * of the work, and a teacher reviewing a second go wants to see the first.
 *
 * arrayUnion for the same reason it is used for streak freezes: two tabs
 * submitting cannot clobber one another.
 */
export async function submitAssignment(
  id: string,
  submission: Omit<Submission, 'at'>
): Promise<void> {
  const entry = cleanForFirestore({ ...submission, at: new Date().toISOString() })
  await updateDoc(doc(db, COL, id), {
    status: 'submitted',
    submissions: arrayUnion(entry),
    updatedAt: new Date().toISOString(),
  })
}

/**
 * A teacher's response. 'approved' closes the assignment; 'returned' hands
 * it back, which puts it in front of the student again with its due date
 * live once more.
 */
export async function reviewAssignment(
  id: string,
  verdict: TeacherFeedback['verdict'],
  note?: string
): Promise<void> {
  const entry = cleanForFirestore({ at: new Date().toISOString(), verdict, note })
  const now = new Date().toISOString()
  await updateDoc(doc(db, COL, id), {
    status: verdict === 'approved' ? 'approved' : 'returned',
    feedback: arrayUnion(entry),
    updatedAt: now,
    ...(verdict === 'approved' ? { completedAt: now } : {}),
  })
}

/**
 * Every assignment a teacher has set, across all students.
 *
 * The existing subscription is per student, which means reviewing work
 * requires opening each student in turn and noticing. A teacher-wide query
 * is what makes a single "needs review" queue possible. One equality
 * filter, so no composite index is needed.
 */
export function subscribeTeacherAssignments(
  teacherId: string,
  callback: (assignments: Assignment[]) => void
): Unsubscribe {
  const q = query(collection(db, COL), where('teacherId', '==', teacherId))
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Assignment)), onSnapshotError('assignments'))
}
