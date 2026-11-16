import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, describe, it } from 'vitest'
import { initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, writeBatch, Timestamp } from 'firebase/firestore'
import { ref, uploadBytes, getBytes } from 'firebase/storage'

/**
 * The security audit, kept.
 *
 * Every attack tried when the app was audited end to end — a student and
 * a teacher each doing their worst, against the database and the bucket —
 * with what must happen. Most were refused from the start; fourteen got
 * through, and the rules were changed until they did not. A failure here
 * is a hole reopened.
 *
 * One shared world, built once, and tests that run in order: several
 * attacks only make sense after something has happened (a student
 * leaving a studio, a request being raised).
 */

const PROJECT = 'demo-maestrotrack'
const T = 'au-T', T2 = 'au-T2', FAKE_T = 'au-FakeT'
const A = 'au-A', B = 'au-B', C = 'au-C', D = 'au-D', E = 'au-E'
const BUCKET_URL = 'https://firebasestorage.googleapis.com/v0/b/maestrotrack-3c2cf.firebasestorage.app/o'

let env: RulesTestEnvironment
const fs = (u?: string) => (u ? env.authenticatedContext(u).firestore() : env.unauthenticatedContext().firestore())
const st = (u?: string) => (u ? env.authenticatedContext(u).storage() : env.unauthenticatedContext().storage())
const future = () => Timestamp.fromMillis(Date.now() + 3 * 864e5)
const bytes = () => new Uint8Array([1, 2, 3, 4])
const admin = (fn: (db: ReturnType<typeof fs>) => Promise<unknown>) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()) as Promise<void>)

/** Raise a join request the app's way: the invitation is spent in the same write. */
function raiseRequest(student: string, teacher: string, token: string) {
  const db = fs(student)
  const batch = writeBatch(db)
  batch.set(doc(db, 'studioRequests', `${student}_${teacher}`), { studentId: student, teacherId: teacher, status: 'pending', inviteToken: token, studentName: 'x', createdAt: 'x' })
  batch.update(doc(db, 'studioInvites', token), { status: 'claimed', updatedAt: 'x' })
  return batch.commit()
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  })
  await env.clearFirestore()
  await env.clearStorage()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const u = (id: string, d: object) => setDoc(doc(db, 'users', id), d)
    await u(T, { role: 'teacher', displayName: 'Ms T' })
    await u(T2, { role: 'teacher', displayName: 'Mr T2' })
    await u(FAKE_T, { role: 'teacher', displayName: 'Self-made teacher' })
    await u(A, { role: 'student', displayName: 'Ana Reyes', teacherId: T })
    await u(B, { role: 'student', displayName: 'Ben Lee', teacherId: T })
    await u(C, { role: 'student', displayName: 'Cleo' })
    await u(D, { role: 'student', displayName: 'Dev' })
    await u(E, { role: 'student', displayName: 'Eve', teacherId: T2 })
    await setDoc(doc(db, 'studioStats', B), { uid: B, displayName: 'Ben Lee', teacherId: T, dailyMinutes: {} })
    await setDoc(doc(db, 'practiceSessions', 'au-sB'), { userId: B, date: '2026-11-10', durationMinutes: 30, notes: 'secret' })
    await setDoc(doc(db, 'practiceSessions', 'au-sA'), { userId: A, date: '2026-11-10', durationMinutes: 30, source: 'timer', timedMinutes: 30, ticket: 'x.y' })
    await setDoc(doc(db, 'practiceSummary', A), { uid: A, days: {} })
    await setDoc(doc(db, 'verifiedPractice', A), { uid: A, from: '2026-11-01', days: { '2026-11-10': 30 } })
    await setDoc(doc(db, 'recordings', 'au-rB'), { userId: B, sharedWithTeacher: true, date: '2026-11-10' })
    await setDoc(doc(db, 'recordings', 'au-rA-priv'), { userId: A, date: '2026-11-10' })
    await setDoc(doc(db, 'recordings', 'au-rA-shared'), { userId: A, sharedWithTeacher: true, date: '2026-11-10' })
    await setDoc(doc(db, 'recordings', 'au-rE'), { userId: E, sharedWithTeacher: true, date: '2026-11-10' })
    await setDoc(doc(db, 'assignments', 'au-asA'), { teacherId: T, studentId: A, title: 'Scales', status: 'assigned', submissions: [], feedback: [] })
    await setDoc(doc(db, 'studioStudents', 'au-rosA'), { teacherId: T, uid: A, name: 'Ana Reyes', priceCents: 5000 })
    await setDoc(doc(db, 'studioStudents', 'au-rosE'), { teacherId: T2, uid: E, name: 'Eve', priceCents: 7000 })
    await setDoc(doc(db, 'invoices', 'au-invT2'), { teacherId: T2, amountCents: 7000 })
    await setDoc(doc(db, 'families', 'au-famT2'), { teacherId: T2, name: 'Eve family', emails: ['eve@x.test'] })
    await setDoc(doc(db, 'studioSettings', T), { teacherId: T })
    await setDoc(doc(db, 'lessonNotes', 'au-nPriv'), { teacherId: T, rosterId: 'au-rosA', studentUid: A, visibility: 'private', text: 'private', date: '2026-11-10' })
    await setDoc(doc(db, 'lessonNotes', 'au-nShared'), { teacherId: T, rosterId: 'au-rosA', studentUid: A, visibility: 'shared', text: 'shared', date: '2026-11-10' })
    await setDoc(doc(db, 'teacherNotes', 'au-tnT2'), { teacherId: T2, studentId: A, content: 'from a previous teacher' })
    await setDoc(doc(db, 'leagueRooms', 'au-room'), { members: { [E]: { xp: 1 } } })
    await setDoc(doc(db, 'messages', 'au-msg'), { teacherId: T, studentId: A, from: 'teacher', text: 'hi', createdAt: 'x' })
    await setDoc(doc(db, 'practiceCorrections', 'au-pc'), { teacherId: T, studentId: A, status: 'pending', toMinutes: 20 })
    await setDoc(doc(db, 'teacherPractice', 'au-tp'), { teacherId: T, rosterId: 'au-rosA', studentUid: A, minutes: 30 })
    await setDoc(doc(db, 'studioInvites', 'au-tok1'), { teacherId: T, status: 'open', expiresAt: future(), teacherName: 'Ms T' })
    await setDoc(doc(db, 'studioInvites', 'au-tokT2'), { teacherId: T2, status: 'open', expiresAt: future() })
    const s = ctx.storage()
    const audio = { contentType: 'audio/webm' }
    await uploadBytes(ref(s, `recordings/${B}/au-rB/take.webm`), bytes(), audio)
    await uploadBytes(ref(s, `recordings/${A}/au-rA-priv/take.webm`), bytes(), audio)
    await uploadBytes(ref(s, `recordings/${A}/au-rA-shared/take.webm`), bytes(), audio)
    await uploadBytes(ref(s, `studio/${T}/attachments/score.pdf`), bytes(), { contentType: 'application/pdf' })
    await uploadBytes(ref(s, `avatars/${A}/profile`), bytes(), { contentType: 'image/png' })
  })
}, 60_000)

afterAll(async () => { await env?.cleanup() })

describe('a student doing their worst', () => {
  it('cannot promote themselves, move studio, or grant themselves a league tier', async () => {
    await assertFails(updateDoc(doc(fs(A), 'users', A), { role: 'teacher' }))
    await assertFails(updateDoc(doc(fs(A), 'users', A), { teacherId: T2 }))
    await assertFails(updateDoc(doc(fs(A), 'users', A), { league: { tier: 5 } }))
    await assertFails(deleteDoc(doc(fs(A), 'users', A)))
  })
  it('cannot read a classmate: profile, sessions, summary, timer figures, studio figures, recording', async () => {
    await assertFails(getDoc(doc(fs(A), 'users', B)))
    await assertFails(getDoc(doc(fs(A), 'practiceSessions', 'au-sB')))
    await assertFails(getDocs(collection(fs(A), 'practiceSessions')))
    await assertFails(getDoc(doc(fs(A), 'practiceSummary', B)))
    await assertFails(getDoc(doc(fs(B), 'verifiedPractice', A)))
    await assertFails(getDoc(doc(fs(A), 'studioStats', B)))
    await assertFails(getDoc(doc(fs(A), 'recordings', 'au-rB')))
  })
  it('renaming themselves after a classmate gets them nowhere: nobody else can read the row', async () => {
    await updateDoc(doc(fs(A), 'users', A), { displayName: 'Ben Lee' })
    await assertSucceeds(setDoc(doc(fs(A), 'studioStats', A), { uid: A, displayName: 'Ben Lee', teacherId: T, dailyMinutes: {} }))
    await assertFails(getDoc(doc(fs(B), 'studioStats', A)))
    await admin((db) => updateDoc(doc(db, 'users', A), { displayName: 'Ana Reyes' }))
  })
  it('cannot publish figures under another name, studio or uid', async () => {
    await assertFails(setDoc(doc(fs(A), 'studioStats', A), { uid: A, displayName: 'Ben Lee', teacherId: T }))
    await assertFails(setDoc(doc(fs(A), 'studioStats', A), { uid: A, displayName: 'Ana Reyes', teacherId: T2 }))
    await assertFails(setDoc(doc(fs(A), 'studioStats', B), { uid: B, displayName: 'Ben Lee', teacherId: T }))
  })
  it('can inflate their own self-reported figures — but never the timer-checked ones', async () => {
    // By design: the summary is the student's own arithmetic over their own log.
    await assertSucceeds(setDoc(doc(fs(A), 'studioStats', A), { uid: A, displayName: 'Ana Reyes', teacherId: T, dailyMinutes: { '2026-11-10': 100000 } }))
    await assertFails(setDoc(doc(fs(A), 'verifiedPractice', A), { uid: A, days: { '2026-11-10': 100000 } }))
    await assertFails(updateDoc(doc(fs(A), 'verifiedPractice', A), { days: {} }))
  })
  it('cannot approve, rewrite or forge feedback on their own work', async () => {
    await assertFails(updateDoc(doc(fs(A), 'assignments', 'au-asA'), { status: 'approved' }))
    await assertFails(updateDoc(doc(fs(A), 'assignments', 'au-asA'), { status: 'submitted', submissions: [{ at: 'x' }], feedback: [{ verdict: 'approved', at: 'x' }] }))
    await assertFails(updateDoc(doc(fs(A), 'assignments', 'au-asA'), { title: 'nothing' }))
    await assertFails(setDoc(doc(fs(A), 'assignments', 'au-as2'), { teacherId: T, studentId: A, status: 'approved' }))
  })
  it('reads shared lesson notes only — never private ones, never prices, settings, invoices or family emails', async () => {
    await assertFails(getDoc(doc(fs(A), 'lessonNotes', 'au-nPriv')))
    await assertFails(getDocs(query(collection(fs(A), 'lessonNotes'), where('studentUid', '==', A))))
    await assertSucceeds(getDoc(doc(fs(A), 'lessonNotes', 'au-nShared')))
    await assertFails(getDoc(doc(fs(A), 'studioStudents', 'au-rosA')))
    await assertFails(getDoc(doc(fs(A), 'studioSettings', T)))
    await assertFails(getDoc(doc(fs(E), 'invoices', 'au-invT2')))
    await assertFails(getDoc(doc(fs(E), 'families', 'au-famT2')))
  })
  it('cannot message a teacher who is not theirs, pose as a teacher, or touch a teacher message', async () => {
    await assertFails(setDoc(doc(fs(A), 'messages', 'au-m1'), { teacherId: T2, studentId: A, from: 'student', text: 'hi', createdAt: 'x' }))
    await assertFails(setDoc(doc(fs(A), 'messages', 'au-m2'), { teacherId: T, studentId: A, from: 'teacher', text: 'you got an A', createdAt: 'x' }))
    await assertFails(updateDoc(doc(fs(A), 'messages', 'au-msg'), { text: 'changed' }))
    await assertFails(deleteDoc(doc(fs(A), 'messages', 'au-msg')))
  })
  it('cannot cheat the timer, the league or the corrections', async () => {
    await assertFails(updateDoc(doc(fs(A), 'practiceCorrections', 'au-pc'), { status: 'accepted', toMinutes: 999 }))
    await assertFails(getDoc(doc(fs(A), 'leagueRooms', 'au-room')))
    await assertFails(setDoc(doc(fs(A), 'leagueRooms', 'au-room2'), { members: { [A]: { xp: 9999 } } }))
    await assertFails(updateDoc(doc(fs(A), 'practiceSessions', 'au-sA'), { timedMinutes: 300 }))
    await assertFails(updateDoc(doc(fs(A), 'practiceSessions', 'au-sA'), { userId: B }))
    await assertFails(setDoc(doc(fs(A), 'practiceSessions', 'au-plant'), { userId: B, date: '2026-11-10', durationMinutes: 600 }))
    await assertFails(setDoc(doc(fs(A), 'teacherPractice', 'au-tp2'), { teacherId: A, rosterId: 'au-rosA', studentUid: A, minutes: 600 }))
  })
  it('an outsider sees nothing of a studio, and a new account arrives in no studio', async () => {
    await assertFails(getDoc(doc(fs(C), 'studioStats', B)))
    await assertFails(setDoc(doc(fs('au-new1'), 'users', 'au-new1'), { role: 'student', teacherId: T }))
  })
})

describe('share links', () => {
  const good = (slug: string, over: Record<string, unknown> = {}) => ({
    ownerId: A, kind: 'session', createdAt: 'x', fields: { minutes: 30, dateLabel: 'Tuesday, 10 November' }, ...over,
  })
  it('nobody lists them, and nobody publishes for someone else', async () => {
    await assertFails(getDocs(collection(fs(), 'shares')))
    await assertFails(setDoc(doc(fs(A), 'shares', 'auShareAAAAAAAAAAAAAAA1'), good('1', { ownerId: B })))
  })
  it('the picture must be this project’s, from the owner’s own folder', async () => {
    await assertFails(setDoc(doc(fs(A), 'shares', 'auShareAAAAAAAAAAAAAAA2'), good('2', { image: 'https://firebasestorage.googleapis.com/v0/b/evil-project.appspot.com/o/x.png?alt=media' })))
    await assertFails(setDoc(doc(fs(A), 'shares', 'auShareAAAAAAAAAAAAAAA3'), good('3', { image: `${BUCKET_URL}/shares%2F${B}%2FauShareAAAAAAAAAAAAAAA3.png?alt=media&token=1-2` })))
    await assertSucceeds(setDoc(doc(fs(A), 'shares', 'auShareAAAAAAAAAAAAAAA4'), good('4', { image: `${BUCKET_URL}/shares%2F${A}%2FauShareAAAAAAAAAAAAAAA4.png?alt=media&token=0b1c2d3e-aaaa-bbbb-cccc-1234567890ab` })))
  })
  it('every field is bounded', async () => {
    await assertFails(setDoc(doc(fs(A), 'shares', 'auShareAAAAAAAAAAAAAAA5'), good('5', { fields: { minutes: 1, dateLabel: 'x'.repeat(500_000) } })))
    await assertFails(setDoc(doc(fs(A), 'shares', 'auShareAAAAAAAAAAAAAAA6'), good('6', { fields: { minutes: 999999, dateLabel: '' } })))
    await assertFails(setDoc(doc(fs(A), 'shares', 'auShareAAAAAAAAAAAAAAA7'), good('7', { fields: { minutes: 1, dateLabel: '', badgeLabel: 'x'.repeat(200) } })))
    await assertFails(setDoc(doc(fs(A), 'shares', 'auShareAAAAAAAAAAAAAAA8'), good('8', { fields: { minutes: 1, dateLabel: '', week: [1, 2, 3, 4, 5, 6, 7, 8] } })))
  })
  it('a name on the card is the owner’s own', async () => {
    await assertFails(setDoc(doc(fs(A), 'shares', 'auShareAAAAAAAAAAAAAAA9'), good('9', { fields: { minutes: 1, dateLabel: '', name: 'Ben Lee' } })))
    await assertSucceeds(setDoc(doc(fs(A), 'shares', 'auShareAAAAAAAAAAAAAA10'), good('10', { fields: { minutes: 1, dateLabel: '', name: 'Ana Reyes' } })))
  })
  it('a published share cannot be edited', async () => {
    await assertFails(updateDoc(doc(fs(A), 'shares', 'auShareAAAAAAAAAAAAAA10'), { fields: { minutes: 2, dateLabel: '' } }))
  })
})

describe('joining a studio', () => {
  it('invitations cannot be listed', async () => {
    await assertFails(getDocs(collection(fs(), 'studioInvites')))
  })
  it('a request must spend its invitation; a second student cannot reuse it', async () => {
    await assertFails(setDoc(doc(fs(C), 'studioRequests', `${C}_${T}`), { studentId: C, teacherId: T, status: 'pending', inviteToken: 'au-tok1' }))
    await assertSucceeds(raiseRequest(C, T, 'au-tok1'))
    await assertFails(raiseRequest(D, T, 'au-tok1'))
  })
  it('nobody raises a request for someone else, or accepts their own', async () => {
    await assertFails(setDoc(doc(fs(C), 'studioRequests', `${D}_${T2}`), { studentId: D, teacherId: T2, status: 'pending', inviteToken: 'au-tokT2' }))
    await assertFails(updateDoc(doc(fs(C), 'studioRequests', `${C}_${T}`), { status: 'accepted' }))
  })
  it('holding a link does not let you burn it for its student', async () => {
    await assertFails(updateDoc(doc(fs(D), 'studioInvites', 'au-tokT2'), { status: 'claimed' }))
  })
  it('only the teacher asked can accept, and only the studio fields', async () => {
    await assertFails(updateDoc(doc(fs(T2), 'users', C), { teacherId: T2 }))
    await assertFails(updateDoc(doc(fs(T), 'users', C), { teacherId: T, displayName: 'renamed' }))
    await assertSucceeds(updateDoc(doc(fs(T), 'users', C), { teacherId: T, studioName: 'S', teacherName: 'Ms T' }))
  })
  it('a teacher may refresh their own student’s studio name — and nothing else with it', async () => {
    await assertSucceeds(updateDoc(doc(fs(T), 'users', A), { studioName: 'Harper Strings', teacherName: 'Ms T', updatedAt: 'x' }))
    await assertFails(updateDoc(doc(fs(T), 'users', A), { studioName: 'Harper Strings', displayName: 'renamed' }))
    await assertFails(updateDoc(doc(fs(T), 'users', A), { studioName: 'x'.repeat(200) }))
    await assertFails(updateDoc(doc(fs(T2), 'users', A), { studioName: 'Poached' }))
    await assertFails(updateDoc(doc(fs(T), 'users', E), { studioName: 'Poached' }))
  })
  it('teachers cannot take or release a colleague’s student', async () => {
    await assertFails(updateDoc(doc(fs(T), 'users', E), { teacherId: T, studioName: 'x' }))
    await assertFails(updateDoc(doc(fs(T2), 'users', A), { teacherId: null }))
  })
  it('a student cannot mint an invitation; a code points only at your own invitation', async () => {
    await assertFails(setDoc(doc(fs(D), 'studioInvites', 'au-tokX'), { teacherId: D, status: 'open', expiresAt: future() }))
    await assertFails(setDoc(doc(fs(FAKE_T), 'inviteCodes', 'AUXX01'), { teacherId: FAKE_T, token: 'au-tok1', expiresAt: future() }))
    // The app's way: invitation and code in one write.
    const db = fs(FAKE_T)
    const batch = writeBatch(db)
    batch.set(doc(db, 'studioInvites', 'au-tokFake'), { teacherId: FAKE_T, status: 'open', expiresAt: future() })
    batch.set(doc(db, 'inviteCodes', 'AUXX02'), { teacherId: FAKE_T, token: 'au-tokFake', expiresAt: future() })
    await assertSucceeds(batch.commit())
  })
})

describe('a teacher doing their worst', () => {
  it('never reads raw sessions, or anything of another studio', async () => {
    await assertFails(getDoc(doc(fs(T), 'practiceSessions', 'au-sA')))
    await assertSucceeds(getDoc(doc(fs(T), 'practiceSummary', A)))
    await assertSucceeds(getDoc(doc(fs(T), 'verifiedPractice', A)))
    await assertFails(getDoc(doc(fs(T2), 'practiceSummary', A)))
    await assertFails(getDoc(doc(fs(T2), 'verifiedPractice', A)))
    await assertFails(getDoc(doc(fs(T2), 'users', A)))
    await assertFails(getDoc(doc(fs(T), 'recordings', 'au-rA-priv')))
    await assertFails(getDoc(doc(fs(T), 'recordings', 'au-rE')))
    await assertFails(getDoc(doc(fs(T), 'leagueRooms', 'au-room')))
  })
  it('writes nothing about a student who is not theirs', async () => {
    await assertFails(setDoc(doc(fs(T), 'assignments', 'au-as3'), { teacherId: T, studentId: E, status: 'assigned' }))
    await assertFails(updateDoc(doc(fs(T), 'assignments', 'au-asA'), { studentId: B }))
    await assertFails(setDoc(doc(fs(T), 'lessonNotes', 'au-n3'), { teacherId: T, rosterId: 'au-rosA', studentUid: E, visibility: 'shared', text: 'hello' }))
    await assertFails(setDoc(doc(fs(T), 'studioStudents', 'au-ros2'), { teacherId: T, uid: E, name: 'Eve' }))
    await assertFails(updateDoc(doc(fs(T), 'studioStudents', 'au-rosA'), { uid: E }))
    await assertFails(setDoc(doc(fs(T), 'messages', 'au-m3'), { teacherId: T, studentId: E, from: 'teacher', text: 'hi', createdAt: 'x' }))
    await assertFails(setDoc(doc(fs(T), 'practiceCorrections', 'au-pc2'), { teacherId: T, studentId: E, status: 'pending', toMinutes: 1 }))
    await assertFails(updateDoc(doc(fs(T), 'users', A), { displayName: 'x' }))
  })
  it('naming a stranger in a lesson plants nothing: the stranger cannot read it', async () => {
    await assertSucceeds(setDoc(doc(fs(T), 'studioLessons', 'au-L1'), { teacherId: T, rosterIds: [], studentUids: [E], startTime: '10:00', durationMinutes: 30, dayOfWeek: 1 }))
    await assertSucceeds(setDoc(doc(fs(T), 'lessonOccurrences', 'au-O1'), { teacherId: T, rosterIds: [], studentUids: [E], startTime: '10:00', durationMinutes: 30, date: '2026-11-20' }))
    await assertFails(getDoc(doc(fs(E), 'studioLessons', 'au-L1')))
    await assertFails(getDoc(doc(fs(E), 'lessonOccurrences', 'au-O1')))
    await assertFails(getDocs(query(collection(fs(E), 'studioLessons'), where('studentUids', 'array-contains', E), where('teacherId', '==', T))))
  })
  it('touches nothing of a colleague’s: roster, invoices, families, settings', async () => {
    await assertFails(getDoc(doc(fs(T), 'studioStudents', 'au-rosE')))
    await assertFails(getDoc(doc(fs(T), 'invoices', 'au-invT2')))
    await assertFails(updateDoc(doc(fs(T), 'invoices', 'au-invT2'), { amountCents: 1 }))
    await assertFails(setDoc(doc(fs(T), 'invoices', 'au-inv2'), { teacherId: T2, amountCents: 1 }))
    await assertFails(getDoc(doc(fs(T), 'families', 'au-famT2')))
    await assertFails(setDoc(doc(fs(T), 'studioSettings', T2), { teacherId: T2 }))
  })
  it('cannot read what a previous teacher wrote in the old notes', async () => {
    await assertFails(getDoc(doc(fs(T), 'teacherNotes', 'au-tnT2')))
    await assertSucceeds(getDoc(doc(fs(A), 'teacherNotes', 'au-tnT2')))
  })
  it('cannot edit recorded practice past the limits it was written within', async () => {
    await assertFails(updateDoc(doc(fs(T), 'teacherPractice', 'au-tp'), { minutes: 100000 }))
    await assertFails(updateDoc(doc(fs(T), 'teacherPractice', 'au-tp'), { minutes: 0 }))
    await assertSucceeds(updateDoc(doc(fs(T), 'teacherPractice', 'au-tp'), { minutes: 45 }))
  })
  it('once a student leaves, their former teacher can no longer write to them', async () => {
    await updateDoc(doc(fs(A), 'users', A), { teacherId: null })
    await assertFails(updateDoc(doc(fs(T), 'lessonNotes', 'au-nShared'), { text: 'you will regret leaving' }))
    await assertFails(updateDoc(doc(fs(T), 'assignments', 'au-asA'), { title: 'changed after leaving' }))
    await assertFails(setDoc(doc(fs(T), 'messages', 'au-m4'), { teacherId: T, studentId: A, from: 'teacher', text: 'come back', createdAt: 'x' }))
    await assertFails(getDoc(doc(fs(T), 'practiceSummary', A)))
    // …and the student cannot hand work in to them either.
    await assertFails(updateDoc(doc(fs(A), 'assignments', 'au-asA'), { status: 'submitted', submissions: [{ at: 'x' }] }))
    // Tidying up is still allowed.
    await assertSucceeds(deleteDoc(doc(fs(T), 'lessonNotes', 'au-nShared')))
    await admin((db) => updateDoc(doc(db, 'users', A), { teacherId: T }))
  })
  it('while the student is theirs, both sides work as before', async () => {
    await assertSucceeds(updateDoc(doc(fs(T), 'assignments', 'au-asA'), { title: 'Scales, two octaves' }))
    await assertSucceeds(updateDoc(doc(fs(A), 'assignments', 'au-asA'), { status: 'submitted', submissions: [{ at: 'x' }], updatedAt: 'x' }))
  })
})

describe('announcements', () => {
  const post = (u: string, d: Record<string, unknown>) => setDoc(doc(fs(u), 'announcements', `au-ann-${Math.random().toString(36).slice(2)}`), d)
  it('a teacher posts to their own studio; nobody posts in someone else’s name', async () => {
    await assertSucceeds(setDoc(doc(fs(T), 'announcements', 'au-ann1'), { teacherId: T, text: 'Recital Saturday at 2', createdAt: 'x' }))
    await assertFails(post(T, { teacherId: T2, text: 'Fake', createdAt: 'x' }))
    await assertFails(post(A, { teacherId: T, text: 'From a student', createdAt: 'x' }))
    await assertFails(post(T, { teacherId: T, text: '', createdAt: 'x' }))
    await assertFails(post(T, { teacherId: T, text: 'x'.repeat(2001), createdAt: 'x' }))
    await assertFails(post(T, { teacherId: T, text: 'hi', createdAt: 'x', pinned: true }))
  })
  it('the studio’s students read it — by asking for their own teacher’s; nobody else does', async () => {
    await assertSucceeds(getDoc(doc(fs(A), 'announcements', 'au-ann1')))
    await assertSucceeds(getDocs(query(collection(fs(A), 'announcements'), where('teacherId', '==', T))))
    await assertFails(getDocs(collection(fs(A), 'announcements')))
    await assertFails(getDoc(doc(fs(E), 'announcements', 'au-ann1')))
    await assertFails(getDocs(query(collection(fs(E), 'announcements'), where('teacherId', '==', T))))
    await assertFails(getDoc(doc(fs(T2), 'announcements', 'au-ann1')))
  })
  it('never edited; only its teacher takes it down', async () => {
    await assertFails(updateDoc(doc(fs(T), 'announcements', 'au-ann1'), { text: 'changed' }))
    await assertFails(deleteDoc(doc(fs(A), 'announcements', 'au-ann1')))
    await assertFails(deleteDoc(doc(fs(T2), 'announcements', 'au-ann1')))
    await assertSucceeds(deleteDoc(doc(fs(T), 'announcements', 'au-ann1')))
  })
})

describe('the bucket', () => {
  it('a take is heard by its owner, and by their teacher only once handed in', async () => {
    await assertFails(getBytes(ref(st(A), `recordings/${B}/au-rB/take.webm`)))
    await assertSucceeds(getBytes(ref(st(T), `recordings/${A}/au-rA-shared/take.webm`)))
    await assertFails(getBytes(ref(st(T), `recordings/${A}/au-rA-priv/take.webm`)))
    await assertFails(getBytes(ref(st(T2), `recordings/${A}/au-rE/take.webm`)))
  })
  it('only real audio is stored as a take — not web pages, not made-up audio types', async () => {
    await assertFails(uploadBytes(ref(st(A), `recordings/${A}/x/evil.html`), bytes(), { contentType: 'text/html' }))
    await assertFails(uploadBytes(ref(st(A), `recordings/${A}/y/t.html`), bytes(), { contentType: 'audio/html' }))
    await assertSucceeds(uploadBytes(ref(st(A), `recordings/${A}/z/t.webm`), bytes(), { contentType: 'audio/webm;codecs=opus' }))
    await assertSucceeds(uploadBytes(ref(st(A), `recordings/${A}/z/t.mp4`), bytes(), { contentType: 'audio/mp4' }))
    await assertFails(uploadBytes(ref(st(T), `recordings/${A}/x/t.webm`), bytes(), { contentType: 'audio/webm' }))
  })
  it('photos are never SVG, never readable anonymously, never in someone else’s folder', async () => {
    await assertFails(uploadBytes(ref(st(A), `avatars/${A}/profile`), bytes(), { contentType: 'image/svg+xml' }))
    await assertFails(getBytes(ref(st(), `avatars/${A}/profile`)))
    await assertFails(uploadBytes(ref(st(A), `shares/${B}/x`), bytes(), { contentType: 'image/png' }))
  })
  it('a teacher’s attachments: their students only, and real file types only', async () => {
    await assertFails(getBytes(ref(st(E), `studio/${T}/attachments/score.pdf`)))
    await assertSucceeds(getBytes(ref(st(A), `studio/${T}/attachments/score.pdf`)))
    await assertFails(uploadBytes(ref(st(T), `studio/${T}/attachments/x.html`), bytes(), { contentType: 'text/html' }))
    await assertFails(uploadBytes(ref(st(T), `studio/${T}/attachments/x.bin`), bytes(), { contentType: 'video/x-made-up' }))
    await assertSucceeds(uploadBytes(ref(st(T), `studio/${T}/attachments/demo.mp3`), bytes(), { contentType: 'audio/mpeg' }))
    await assertSucceeds(uploadBytes(ref(st(T), `studio/${T}/attachments/demo.mov`), bytes(), { contentType: 'video/quicktime' }))
  })
})
