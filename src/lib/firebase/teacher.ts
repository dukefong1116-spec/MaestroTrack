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

// Find teacher UID from a studio code, then link the student to that teacher
export async function joinStudioByCode(studentId: string, code: string): Promise<boolean> {
  const upperCode = code.toUpperCase()
  console.log('[Studio] Student', studentId, 'joining with code', upperCode)

  // Find teacher by studioCode in Firestore
  let teacherId: string | null = null
  try {
    const q = query(
      collection(db, USERS),
      where('studioCode', '==', upperCode),
      where('role', '==', 'teacher')
    )
    const snap = await getDocs(q)
    if (!snap.empty) {
      teacherId = snap.docs[0].id
      console.log('[Studio] Found teacher in Firestore:', teacherId)
    } else {
      console.warn('[Studio] No teacher found with studioCode', upperCode)
    }
  } catch (e) {
    console.warn('[Studio] Firestore query failed:', e)
  }

  if (!teacherId) return false

  // Write teacherId to student's Firestore doc
  console.log('[Studio] Writing teacherId', teacherId, 'to student doc', studentId)
  try {
    await setDoc(doc(db, USERS, studentId), { teacherId }, { merge: true })
    console.log('[Studio] Student linked to teacher ✓')
  } catch (e) {
    console.warn('[Studio] Failed to write teacherId:', e)
    return false
  }

  // Keep localStorage in sync
  const cached = localStorage.getItem(`maestro_profile_${studentId}`)
  if (cached) {
    try {
      const parsed = JSON.parse(cached)
      localStorage.setItem(`maestro_profile_${studentId}`, JSON.stringify({ ...parsed, teacherId }))
    } catch { /* ignore */ }
  }

  return true
}

export async function getStudentsForTeacher(teacherId: string): Promise<UserProfile[]> {
  const q = query(collection(db, USERS), where('teacherId', '==', teacherId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UserProfile)
}

export function subscribeStudents(
  teacherId: string,
  callback: (students: UserProfile[]) => void
): Unsubscribe {
  console.log('[Teacher] Subscribing to students for teacher:', teacherId)
  const q = query(collection(db, USERS), where('teacherId', '==', teacherId))
  return onSnapshot(q, (snap) => {
    const students = snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UserProfile)
    console.log('[Teacher] Students snapshot:', students.length, 'student(s)')
    callback(students)
  }, (err) => {
    console.error('[Teacher] subscribeStudents error:', err)
  })
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
  console.log('[Profile] Updating profile for', uid)
  await setDoc(doc(db, USERS, uid), { ...data, updatedAt: new Date().toISOString() }, { merge: true })
}
