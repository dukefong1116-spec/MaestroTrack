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

// Subscribe to students for a teacher.
// Runs TWO parallel queries and merges results (deduped by uid):
//   1. WHERE role==student AND teacherId==teacherUid  (primary)
//   2. WHERE role==student AND studioCode==studioCode (fallback for students who joined before teacherId was written)
// This makes the dashboard resilient even if a student's doc is missing teacherId.
export function subscribeStudents(
  teacherId: string,
  studioCode: string | undefined,
  callback: (students: UserProfile[]) => void
): Unsubscribe {
  console.log('[TeacherDashboard] teacher uid:', teacherId)
  console.log('[TeacherDashboard] studioCode:', studioCode)

  const seen = new Map<string, UserProfile>()
  let snapshotCount = 0

  function merge(docs: UserProfile[], source: string) {
    docs.forEach((d) => seen.set(d.uid, d))
    const all = Array.from(seen.values())
    console.log(`[TeacherDashboard] merge from ${source}: total unique students = ${all.length}`)
    callback(all)
  }

  // Query 1: by teacherId
  console.log('[TeacherDashboard] Q1: WHERE role==student AND teacherId==', teacherId)
  const q1 = query(
    collection(db, USERS),
    where('role', '==', 'student'),
    where('teacherId', '==', teacherId)
  )
  const unsub1 = onSnapshot(
    q1,
    (snap) => {
      snapshotCount++
      console.log(`[TeacherDashboard] Q1 snapshot (${snapshotCount}): ${snap.size} docs`)
      snap.docs.forEach((d) => console.log('[TeacherDashboard] Q1 doc:', d.id, d.data()))
      merge(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UserProfile), 'teacherId')
    },
    (err) => {
      console.error('[TeacherDashboard] Q1 error:', err.message)
      // If this is an index error, the message contains a URL — open it to create the index
    }
  )

  // Query 2: by studioCode (fallback)
  if (!studioCode) {
    console.log('[TeacherDashboard] No studioCode — skipping Q2 fallback')
    return unsub1
  }

  console.log('[TeacherDashboard] Q2: WHERE role==student AND studioCode==', studioCode)
  const q2 = query(
    collection(db, USERS),
    where('role', '==', 'student'),
    where('studioCode', '==', studioCode)
  )
  const unsub2 = onSnapshot(
    q2,
    (snap) => {
      console.log(`[TeacherDashboard] Q2 snapshot: ${snap.size} docs`)
      snap.docs.forEach((d) => console.log('[TeacherDashboard] Q2 doc:', d.id, d.data()))
      merge(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UserProfile), 'studioCode')
    },
    (err) => {
      console.error('[TeacherDashboard] Q2 error:', err.message)
    }
  )

  return () => { unsub1(); unsub2() }
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
