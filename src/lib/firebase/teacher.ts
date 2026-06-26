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

// Primary relationship field is teacherId.
// Query: WHERE role == 'student' AND teacherId == currentTeacherUid
export function subscribeStudents(
  teacherId: string,
  callback: (students: UserProfile[]) => void
): Unsubscribe {
  console.log('[TeacherDashboard] teacher uid:', teacherId)
  console.log('[TeacherDashboard] query used: WHERE role==student AND teacherId==', teacherId)

  const q = query(
    collection(db, USERS),
    where('role', '==', 'student'),
    where('teacherId', '==', teacherId)
  )

  return onSnapshot(
    q,
    (snap) => {
      console.log('[TeacherDashboard] snapshot size:', snap.size)
      const students = snap.docs.map((d) => {
        const data = d.data()
        console.log('[TeacherDashboard] student doc:', d.id, data)
        return { uid: d.id, ...data } as UserProfile
      })
      console.log('[TeacherDashboard] student docs returned:', students.length)
      callback(students)
    },
    (err) => {
      console.error('[TeacherDashboard] subscribeStudents error:', err)
      // Firestore index errors include a link to create the index — check the console
    }
  )
}

// Debug only: find any docs with this studioCode regardless of role
export async function debugFindByStudioCode(studioCode: string): Promise<void> {
  try {
    const q = query(collection(db, USERS), where('studioCode', '==', studioCode))
    const snap = await getDocs(q)
    console.log('[TeacherDashboard] all docs with studioCode', studioCode, ':', snap.size)
    snap.docs.forEach((d) => console.log('[TeacherDashboard]  ↳', d.id, d.data()))
  } catch (e) {
    console.warn('[TeacherDashboard] debugFindByStudioCode error:', e)
  }
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
  console.log('[Profile] Updating profile for', uid)
  await setDoc(doc(db, USERS, uid), { ...data, updatedAt: new Date().toISOString() }, { merge: true })
}
