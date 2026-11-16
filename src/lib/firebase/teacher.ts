import {
  collection,
  updateDoc,
  doc,
  query,
  where,
  getDocs,
  setDoc,
  arrayUnion,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './config'
import { onServerSnapshot } from './snapshotError'
import type { StreakRuleEntry, UserProfile } from '@/types'
const USERS = 'users'

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
  return onServerSnapshot(
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
  // studioName goes with teacherId. Accepting a student writes both, so
  // releasing one has to take both back — otherwise their Settings keeps
  // naming a studio they are no longer in.
  await updateDoc(doc(db, USERS, studentId), {
    teacherId: null,
    studioName: '',
    teacherName: '',
    updatedAt: new Date().toISOString(),
  })
}

// The old teacher notes (collection teacherNotes) were replaced by lesson
// notes, and their add/update/subscribe functions removed: nothing called
// them, and the rules now keep that collection read-only. A student still
// gets theirs in a data export.

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  await setDoc(doc(db, USERS, uid), { ...data, updatedAt: new Date().toISOString() }, { merge: true })
}

/**
 * Append-only profile writes.
 *
 * These use arrayUnion rather than reading the array and writing it back:
 * a read-modify-write from two tabs can double-spend a freeze or drop a
 * badge record. arrayUnion merges server-side and is idempotent, so
 * re-sending the same value is harmless.
 */
export async function recordStreakFreezes(uid: string, dates: string[]): Promise<void> {
  if (dates.length === 0) return
  await setDoc(
    doc(db, USERS, uid),
    { streakFreezesUsed: arrayUnion(...dates), updatedAt: new Date().toISOString() },
    { merge: true }
  )
}

/** A comeback completed: the missed day now holds the streak. */
export async function recordStreakRepair(uid: string, date: string): Promise<void> {
  await setDoc(
    doc(db, USERS, uid),
    { streakRepaired: arrayUnion(date), updatedAt: new Date().toISOString() },
    { merge: true }
  )
}

/** The whole rules history, replaced — see withChoice in lib/streak/plan. */
export async function saveStreakRules(uid: string, rules: StreakRuleEntry[]): Promise<void> {
  await setDoc(
    doc(db, USERS, uid),
    { streakRules: rules, updatedAt: new Date().toISOString() },
    { merge: true }
  )
}

export async function markMasteryPrompted(uid: string, pieceIds: string[]): Promise<void> {
  if (pieceIds.length === 0) return
  await setDoc(
    doc(db, USERS, uid),
    { masteryPromptsSeen: arrayUnion(...pieceIds), updatedAt: new Date().toISOString() },
    { merge: true }
  )
}

/**
 * Stamps when a badge was won, once.
 *
 * Written the first time the app notices it earned rather than when the
 * celebration is dismissed — someone who never opens the app again still
 * won it then. The caller skips ids that already carry a date, because a
 * merge would otherwise move it forward on every write.
 */
export async function recordBadgesEarned(uid: string, badgeIds: string[], at: string): Promise<void> {
  if (badgeIds.length === 0) return
  const stamps = Object.fromEntries(badgeIds.map((id) => [id, at]))
  await setDoc(
    doc(db, USERS, uid),
    { badgeEarnedAt: stamps, updatedAt: new Date().toISOString() },
    { merge: true }
  )
}

export async function markBadgesSeen(uid: string, badgeIds: string[]): Promise<void> {
  if (badgeIds.length === 0) return
  await setDoc(
    doc(db, USERS, uid),
    { badgesSeen: arrayUnion(...badgeIds), updatedAt: new Date().toISOString() },
    { merge: true }
  )
}
