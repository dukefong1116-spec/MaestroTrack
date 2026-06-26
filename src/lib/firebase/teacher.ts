import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './config'
import type { TeacherNote, UserProfile } from '@/types'

export async function joinStudioByCode(studentId: string, code: string): Promise<boolean> {
  const upperCode = code.toUpperCase()

  // Check all cached profiles in localStorage for a matching studio code
  let teacherId: string | null = null
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith('maestro_profile_')) continue
    try {
      const cached = JSON.parse(localStorage.getItem(key) ?? '{}')
      if (cached.role === 'teacher' && cached.studioCode === upperCode) {
        teacherId = cached.uid
        break
      }
    } catch { /* ignore */ }
  }

  // Also try Firestore (works when online)
  if (!teacherId) {
    try {
      const q = query(collection(db, 'users'), where('studioCode', '==', upperCode), where('role', '==', 'teacher'))
      const snap = await Promise.race([
        getDocs(q),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
      ])
      if (!snap.empty) teacherId = snap.docs[0].id
    } catch { /* offline */ }
  }

  if (!teacherId) return false

  // Update student's teacherId locally and in Firestore
  const cachedStudent = localStorage.getItem(`maestro_profile_${studentId}`)
  if (cachedStudent) {
    try {
      const parsed = JSON.parse(cachedStudent)
      localStorage.setItem(`maestro_profile_${studentId}`, JSON.stringify({ ...parsed, teacherId }))
    } catch { /* ignore */ }
  }
  updateDoc(doc(db, 'users', studentId), { teacherId }).catch(() => {})
  return true
}

export async function getStudentsForTeacher(teacherId: string): Promise<UserProfile[]> {
  const q = query(collection(db, 'users'), where('teacherId', '==', teacherId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UserProfile)
}

export function subscribeStudents(
  teacherId: string,
  studioCode: string | undefined,
  callback: (students: UserProfile[]) => void
): Unsubscribe {
  // Listen for students linked by teacherId OR by studioCode
  const seen = new Map<string, UserProfile>()
  const notify = () => callback(Array.from(seen.values()))

  const q1 = query(collection(db, 'users'), where('teacherId', '==', teacherId))
  const unsub1 = onSnapshot(q1, (snap) => {
    snap.docs.forEach((d) => seen.set(d.id, { uid: d.id, ...d.data() } as UserProfile))
    notify()
  })

  if (!studioCode) return unsub1

  const q2 = query(collection(db, 'users'), where('teacherStudioCode', '==', studioCode))
  const unsub2 = onSnapshot(q2, (snap) => {
    snap.docs.forEach((d) => seen.set(d.id, { uid: d.id, ...d.data() } as UserProfile))
    notify()
  })

  return () => { unsub1(); unsub2() }
}

export async function removeStudentFromStudio(studentId: string): Promise<void> {
  await updateDoc(doc(db, 'users', studentId), { teacherId: null })
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
  updateDoc(doc(db, 'users', uid), { ...data, updatedAt: new Date().toISOString() }).catch(() => {})
}
