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
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './config'
import type { TeacherNote, UserProfile } from '@/types'

const USERS = 'users'

// Look up a teacher's UID given their studioCode.
export async function getTeacherByStudioCode(code: string): Promise<string | null> {
  try {
    const q = query(
      collection(db, USERS),
      where('studioCode', '==', code.toUpperCase()),
      where('role', '==', 'teacher')
    )
    const snap = await getDocs(q)
    if (!snap.empty) {
      console.log('[Teacher] Found teacher for code', code, '→', snap.docs[0].id)
      return snap.docs[0].id
    }
    console.warn('[Teacher] No teacher found for code:', code)
    return null
  } catch (e) {
    console.warn('[Teacher] getTeacherByStudioCode error:', e)
    return null
  }
}

export function subscribeStudents(
  teacherId: string,
  callback: (students: UserProfile[]) => void
): Unsubscribe {
  console.log('[TeacherDashboard] teacher uid:', teacherId)
  const q = query(
    collection(db, USERS),
    where('role', '==', 'student'),
    where('teacherId', '==', teacherId)
  )
  return onSnapshot(
    q,
    (snap) => {
      console.log('[TeacherDashboard] query snapshot size:', snap.size)
      callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UserProfile))
    },
    (err) => console.error('[TeacherDashboard] query error:', err.message)
  )
}

export async function getStudentsForTeacher(teacherId: string): Promise<UserProfile[]> {
  const q = query(collection(db, USERS), where('teacherId', '==', teacherId), where('role', '==', 'student'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UserProfile)
}

export async function removeStudentFromStudio(studentId: string): Promise<void> {
  await updateDoc(doc(db, USERS, studentId), { teacherId: null })
}

export async function addTeacherNote(
  teacherId: string,
  studentId: string,
  content: string
): Promise<string> {
  const ref = await addDoc(collection(db, 'teacherNotes'), {
    teacherId,
    studentId,
    content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateTeacherNote(id: string, content: string): Promise<void> {
  await updateDoc(doc(db, 'teacherNotes', id), {
    content,
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteTeacherNote(id: string): Promise<void> {
  await deleteDoc(doc(db, 'teacherNotes', id))
}

export function subscribeTeacherNotes(
  studentId: string,
  callback: (notes: TeacherNote[]) => void
): Unsubscribe {
  const q = query(collection(db, 'teacherNotes'), where('studentId', '==', studentId))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TeacherNote))
  })
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  await setDoc(doc(db, USERS, uid), { ...data, updatedAt: new Date().toISOString() }, { merge: true })
}
