import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest'
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where,
} from 'firebase/firestore'

/**
 * The teacher studio: roster, families, settings, invoices, the calendar,
 * notes, corrections, teacher-added practice, and assignments for a
 * student not on the app yet.
 *
 * Requires the emulators: `npm run emulate`, then `npm run test:rules`.
 */

const PROJECT = 'demo-maestrotrack'
const T = 'teacher-1'
const T2 = 'teacher-2'
const ANA = 'student-ana'     // in T's studio
const ZOE = 'student-zoe'     // in T2's studio

let env: RulesTestEnvironment
const as = (uid: string) => env.authenticatedContext(uid).firestore()
const ts = () => new Date().toISOString()

const lesson = (over: Record<string, unknown> = {}) => ({
  teacherId: T, rosterIds: ['r-ana'], studentUids: [ANA], title: 'Ana', tagId: 'private',
  dayOfWeek: 3, startTime: '15:30', durationMinutes: 30, startsOn: '2026-01-01', createdAt: ts(), updatedAt: ts(),
  ...over,
})

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
  })
})
afterAll(async () => { await env?.cleanup() })

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', T), { role: 'teacher', displayName: 'Ms T' })
    await setDoc(doc(db, 'users', T2), { role: 'teacher', displayName: 'Mr U' })
    await setDoc(doc(db, 'users', ANA), { role: 'student', displayName: 'Ana', teacherId: T })
    await setDoc(doc(db, 'users', ZOE), { role: 'student', displayName: 'Zoe', teacherId: T2 })
    await setDoc(doc(db, 'studioStudents', 'r-ana'), { teacherId: T, uid: ANA, name: 'Ana', status: 'active' })
    await setDoc(doc(db, 'studioStudents', 'r-ben'), { teacherId: T, uid: null, name: 'Ben', status: 'active' })
    await setDoc(doc(db, 'studioStudents', 'r-zoe'), { teacherId: T2, uid: ZOE, name: 'Zoe', status: 'active' })
  })
})

describe('roster', () => {
  it('teacher reads and adds their own students, account or not', async () => {
    await assertSucceeds(getDoc(doc(as(T), 'studioStudents', 'r-ana')))
    await assertSucceeds(getDocs(query(collection(as(T), 'studioStudents'), where('teacherId', '==', T))))
    await assertSucceeds(setDoc(doc(as(T), 'studioStudents', 'r-new'), { teacherId: T, uid: null, name: 'Leo', status: 'active' }))
  })
  it('nobody else reads them — not another teacher, not the student', async () => {
    await assertFails(getDoc(doc(as(T2), 'studioStudents', 'r-ana')))
    await assertFails(getDoc(doc(as(ANA), 'studioStudents', 'r-ana')))
    await assertFails(getDocs(query(collection(as(T2), 'studioStudents'), where('teacherId', '==', T))))
  })
  it('cannot be written in another teacher’s name or point at a stranger', async () => {
    await assertFails(setDoc(doc(as(T), 'studioStudents', 'x'), { teacherId: T2, uid: null, name: 'X', status: 'active' }))
    await assertFails(setDoc(doc(as(T), 'studioStudents', 'x'), { teacherId: T, uid: ZOE, name: 'Zoe', status: 'active' }))
    await assertFails(updateDoc(doc(as(T), 'studioStudents', 'r-ben'), { uid: ZOE }))
  })
  it('linking an account works only for a student in the studio', async () => {
    await assertSucceeds(updateDoc(doc(as(T), 'studioStudents', 'r-ben'), { uid: ANA }))
  })
  it('the owner cannot be changed, and others cannot edit or delete', async () => {
    await assertFails(updateDoc(doc(as(T), 'studioStudents', 'r-ana'), { teacherId: T2 }))
    await assertFails(updateDoc(doc(as(T2), 'studioStudents', 'r-ana'), { name: 'X' }))
    await assertFails(deleteDoc(doc(as(T2), 'studioStudents', 'r-ana')))
    await assertSucceeds(deleteDoc(doc(as(T), 'studioStudents', 'r-ben')))
  })
})

describe('families, settings, invoices', () => {
  it('are the teacher’s alone', async () => {
    await assertSucceeds(setDoc(doc(as(T), 'families', 'f1'), { teacherId: T, name: 'Reyes', contacts: [] }))
    await assertFails(getDoc(doc(as(T2), 'families', 'f1')))
    await assertFails(getDoc(doc(as(ANA), 'families', 'f1')))
    await assertSucceeds(setDoc(doc(as(T), 'studioSettings', T), { teacherId: T, defaultLessonMinutes: 30 }))
    await assertFails(setDoc(doc(as(T), 'studioSettings', T2), { teacherId: T2, defaultLessonMinutes: 30 }))
    await assertFails(getDoc(doc(as(ANA), 'studioSettings', T)))
    await assertSucceeds(setDoc(doc(as(T), 'invoices', 'i1'), { teacherId: T, familyId: 'f1', totalCents: 100, payments: [] }))
    await assertFails(getDoc(doc(as(ANA), 'invoices', 'i1')))
    await assertFails(updateDoc(doc(as(T2), 'invoices', 'i1'), { totalCents: 0 }))
    await assertFails(updateDoc(doc(as(T), 'invoices', 'i1'), { teacherId: T2 }))
  })
})

describe('calendar', () => {
  it('teacher writes lessons; the student named reads them by array-contains', async () => {
    await assertSucceeds(setDoc(doc(as(T), 'studioLessons', 'L1'), lesson()))
    await assertSucceeds(getDocs(query(collection(as(ANA), 'studioLessons'), where('studentUids', 'array-contains', ANA))))
    await assertSucceeds(getDoc(doc(as(ANA), 'studioLessons', 'L1')))
    await assertFails(getDoc(doc(as(ZOE), 'studioLessons', 'L1')))
    await assertFails(getDocs(query(collection(as(ZOE), 'studioLessons'), where('studentUids', 'array-contains', ANA))))
  })
  it('the student cannot change a lesson, another teacher cannot either', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'studioLessons', 'L1'), lesson()) })
    await assertFails(updateDoc(doc(as(ANA), 'studioLessons', 'L1'), { startTime: '09:00' }))
    await assertFails(updateDoc(doc(as(T2), 'studioLessons', 'L1'), { startTime: '09:00' }))
    await assertFails(deleteDoc(doc(as(ANA), 'studioLessons', 'L1')))
    await assertSucceeds(updateDoc(doc(as(T), 'studioLessons', 'L1'), { startTime: '16:00' }))
  })
  it('occurrences: same, and a nonsense length is refused', async () => {
    await assertSucceeds(setDoc(doc(as(T), 'lessonOccurrences', 'L1_2026-11-11'), { ...lesson(), date: '2026-11-11', lessonId: 'L1', originalDate: '2026-11-11', attendance: { 'r-ana': 'present' } }))
    await assertSucceeds(getDocs(query(collection(as(ANA), 'lessonOccurrences'), where('studentUids', 'array-contains', ANA))))
    await assertFails(setDoc(doc(as(T), 'lessonOccurrences', 'x'), { ...lesson({ durationMinutes: 0 }), date: '2026-11-11' }))
    await assertFails(setDoc(doc(as(T), 'lessonOccurrences', 'y'), { ...lesson({ teacherId: T2 }), date: '2026-11-11' }))
  })
})

describe('lesson notes', () => {
  const note = (over: Record<string, unknown> = {}) => ({
    teacherId: T, rosterId: 'r-ana', studentUid: ANA, date: '2026-11-11', visibility: 'shared', text: 'Good pulse', createdAt: ts(), updatedAt: ts(), ...over,
  })
  it('a student reads shared notes about them, never private ones', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'lessonNotes', 'shared'), note())
      await setDoc(doc(ctx.firestore(), 'lessonNotes', 'private'), note({ visibility: 'private', text: 'tired' }))
    })
    await assertSucceeds(getDoc(doc(as(ANA), 'lessonNotes', 'shared')))
    await assertFails(getDoc(doc(as(ANA), 'lessonNotes', 'private')))
    await assertSucceeds(getDocs(query(collection(as(ANA), 'lessonNotes'), where('studentUid', '==', ANA), where('visibility', '==', 'shared'))))
    // Asking for everything about them would include the private note: refused.
    await assertFails(getDocs(query(collection(as(ANA), 'lessonNotes'), where('studentUid', '==', ANA))))
    await assertFails(getDoc(doc(as(ZOE), 'lessonNotes', 'shared')))
  })
  it('a teacher writes notes only for their own roster and students', async () => {
    await assertSucceeds(addDoc(collection(as(T), 'lessonNotes'), note()))
    await assertSucceeds(addDoc(collection(as(T), 'lessonNotes'), note({ rosterId: 'r-ben', studentUid: '' })))
    await assertFails(addDoc(collection(as(T), 'lessonNotes'), note({ rosterId: 'r-zoe', studentUid: ZOE })))
    await assertFails(addDoc(collection(as(T), 'lessonNotes'), note({ studentUid: ZOE })))
    await assertFails(addDoc(collection(as(T), 'lessonNotes'), note({ visibility: 'public' })))
  })
  it('a student cannot write or edit notes', async () => {
    await assertFails(addDoc(collection(as(ANA), 'lessonNotes'), note({ teacherId: ANA })))
  })
})

describe('practice corrections', () => {
  const corr = (over: Record<string, unknown> = {}) => ({
    teacherId: T, studentId: ANA, sessionId: 's1', sessionDate: '2026-11-09', fromMinutes: 45, toMinutes: 20, status: 'pending', createdAt: ts(), ...over,
  })
  it('a teacher suggests to their own student only', async () => {
    await assertSucceeds(setDoc(doc(as(T), 'practiceCorrections', 'c1'), corr()))
    await assertFails(setDoc(doc(as(T), 'practiceCorrections', 'c2'), corr({ studentId: ZOE })))
    await assertFails(setDoc(doc(as(T), 'practiceCorrections', 'c3'), corr({ status: 'accepted' })))
  })
  it('the student answers once, and cannot change the minutes', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'practiceCorrections', 'c1'), corr()) })
    await assertSucceeds(getDocs(query(collection(as(ANA), 'practiceCorrections'), where('studentId', '==', ANA))))
    await assertFails(updateDoc(doc(as(ANA), 'practiceCorrections', 'c1'), { status: 'accepted', toMinutes: 45 }))
    await assertFails(updateDoc(doc(as(ZOE), 'practiceCorrections', 'c1'), { status: 'declined', decidedAt: ts() }))
    await assertSucceeds(updateDoc(doc(as(ANA), 'practiceCorrections', 'c1'), { status: 'accepted', decidedAt: ts() }))
    await assertFails(updateDoc(doc(as(ANA), 'practiceCorrections', 'c1'), { status: 'declined', decidedAt: ts() }))
  })
})

describe('teacher-added practice', () => {
  const entry = (over: Record<string, unknown> = {}) => ({
    teacherId: T, rosterId: 'r-ana', studentUid: ANA, date: '2026-11-10', minutes: 30, createdAt: ts(), ...over,
  })
  it('the teacher adds it; the student reads it; nobody else does', async () => {
    await assertSucceeds(setDoc(doc(as(T), 'teacherPractice', 'p1'), entry()))
    await assertSucceeds(getDocs(query(collection(as(ANA), 'teacherPractice'), where('studentUid', '==', ANA))))
    await assertFails(getDoc(doc(as(ZOE), 'teacherPractice', 'p1')))
    await assertFails(setDoc(doc(as(T), 'teacherPractice', 'p2'), entry({ minutes: 9999 })))
    await assertFails(setDoc(doc(as(T), 'teacherPractice', 'p3'), entry({ rosterId: 'r-zoe', studentUid: ZOE })))
    await assertFails(setDoc(doc(as(ANA), 'teacherPractice', 'p4'), entry({ teacherId: ANA })))
  })
})

describe('assignments for a student not on the app', () => {
  const work = (over: Record<string, unknown> = {}) => ({
    teacherId: T, studentId: '', rosterId: 'r-ben', title: 'D major scale', status: 'active', createdAt: ts(), updatedAt: ts(), ...over,
  })
  it('can be set for the teacher’s own roster row only', async () => {
    await assertSucceeds(setDoc(doc(as(T), 'assignments', 'a1'), work()))
    await assertFails(setDoc(doc(as(T), 'assignments', 'a2'), work({ rosterId: 'r-zoe' })))
    await assertFails(setDoc(doc(as(T2), 'assignments', 'a3'), work({ teacherId: T2 })))
  })
  it('becomes the student’s when they join — and only that changes', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'assignments', 'a1'), work()) })
    await assertFails(updateDoc(doc(as(T), 'assignments', 'a1'), { studentId: ZOE, updatedAt: ts() }))
    await assertFails(updateDoc(doc(as(T), 'assignments', 'a1'), { studentId: ANA, status: 'approved', updatedAt: ts() }))
    await assertSucceeds(updateDoc(doc(as(T), 'assignments', 'a1'), { studentId: ANA, updatedAt: ts() }))
  })
  it('the existing rules still hold: a student cannot approve their own work', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'assignments', 'a1'), work({ studentId: ANA })) })
    await assertFails(updateDoc(doc(as(ANA), 'assignments', 'a1'), { status: 'approved' }))
  })
})
