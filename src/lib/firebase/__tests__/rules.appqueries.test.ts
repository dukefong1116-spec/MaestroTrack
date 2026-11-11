import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
  type RulesTestEnvironment, type RulesTestContext,
} from '@firebase/rules-unit-testing'
import { Timestamp, addDoc, collection, doc, setDoc, updateDoc, type Firestore, type Unsubscribe } from 'firebase/firestore'

/**
 * The app's own queries, run against the rules.
 *
 * Every other rules suite here writes its own queries and asks whether the
 * rules permit them. That answers the wrong question. The rules can be
 * perfect and the app still broken, because a query is only allowed if it
 * *proves* every document it could return is readable — a fact about the
 * query, not about the data. Both the bugs that shipped were of exactly
 * this shape: the rules allowed what the app wanted, and the app asked for
 * it in a way the rules could not prove.
 *
 * So nothing here builds a query. The real modules are imported and their
 * real functions called, with `db` swapped for the emulator. What runs is
 * what ships; if someone adds a `where` clause, this suite sees it.
 *
 * Requires the emulators: `npm run emulate`, then `npm run test:rules`.
 */

/* ── the swap ─────────────────────────────────────────────────────────
 * The app modules read `db` at call time, not at import time, so one
 * mutable holder is enough to let each test act as a different signed-in
 * user through the production code path.
 */
const live: { db: Firestore | null; uid: string | null } = { db: null, uid: null }

vi.mock('../config', () => ({
  get db() { return live.db },
  get auth() { return { currentUser: live.uid ? { uid: live.uid } : null } },
  get storage() { return {} },
  loadStorage: async () => ({ ...(await import('firebase/storage')), storage: {} }),
  default: {},
}))

const practice = await import('../practice')
const pieces = await import('../pieces')
const performances = await import('../performances')
const recordings = await import('../recordings')
const assignments = await import('../assignments')
const schedule = await import('../schedule')
const teacher = await import('../teacher')
const summary = await import('../summary')
const invites = await import('../invites')
const requests = await import('../requests')
const messages = await import('../messages')

const PROJECT = 'demo-maestrotrack'

const TEACHER = 'teacher-1'
const OTHER_TEACHER = 'teacher-2'
const ANA = 'student-ana'       // taught by TEACHER
const BEN = 'student-ben'       // taught by TEACHER — Ana's classmate
const CLARE = 'student-clare'   // taught by OTHER_TEACHER
const CODE = 'CHEN42'
const TOKEN = 'tok_chen_invite_abcde'
/** Invitation expiry is a Timestamp so the rules can compare it; see StudioInvite. */
const WEEK = Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000)

let env: RulesTestEnvironment

/** Act as this user through the real app modules. */
function as(ctx: RulesTestContext, uid: string | null) {
  live.db = ctx.firestore() as unknown as Firestore
  live.uid = uid
}
const asAna = () => as(env.authenticatedContext(ANA), ANA)
const asBen = () => as(env.authenticatedContext(BEN), BEN)
const asClare = () => as(env.authenticatedContext(CLARE), CLARE)
const asTeacher = () => as(env.authenticatedContext(TEACHER), TEACHER)
const asOtherTeacher = () => as(env.authenticatedContext(OTHER_TEACHER), OTHER_TEACHER)

/**
 * What a subscription did.
 *
 * A denied subscription does not reject: the app's error handlers log and
 * the callback never fires, which is indistinguishable from an empty
 * result at the call site. That is itself worth knowing, and it means the
 * only honest way to detect a refusal from outside is that nothing
 * arrives.
 */
async function firstValue<T>(
  subscribe: (cb: (v: T) => void) => Unsubscribe,
  ms = 3000
): Promise<{ delivered: true; value: T } | { delivered: false }> {
  return new Promise((resolve) => {
    let unsub: Unsubscribe | undefined
    const timer = setTimeout(() => { unsub?.(); resolve({ delivered: false }) }, ms)
    unsub = subscribe((value) => {
      clearTimeout(timer)
      unsub?.()
      resolve({ delivered: true, value })
    })
  })
}

async function expectDelivered<T>(subscribe: (cb: (v: T) => void) => Unsubscribe) {
  const r = await firstValue(subscribe)
  expect(r.delivered, 'the subscription delivered nothing — the query was refused').toBe(true)
  return (r as { delivered: true; value: T }).value
}

async function expectNothing<T>(subscribe: (cb: (v: T) => void) => Unsubscribe) {
  const r = await firstValue(subscribe, 1500)
  expect(r.delivered, 'the subscription delivered data it should not have').toBe(false)
}

/**
 * A refused *document* subscription, which is not the same as silence.
 *
 * subscribePracticeSummary and subscribeStudioStats hand the caller `null`
 * on error, so from outside a refusal looks exactly like a document that
 * is not there. Every test using this seeds the document first, so null
 * can only mean the read was refused — and the fact that the app cannot
 * tell these apart is recorded in the findings rather than worked around.
 */
async function expectDocRefused<T>(subscribe: (cb: (v: T | null) => void) => Unsubscribe) {
  const r = await firstValue<T | null>(subscribe, 1500)
  if (r.delivered) {
    expect(r.value, 'the document was readable when it should not have been').toBeNull()
  }
}

async function expectDocDelivered<T>(subscribe: (cb: (v: T | null) => void) => Unsubscribe) {
  const r = await firstValue<T | null>(subscribe, 3000)
  expect(r.delivered, 'nothing arrived at all').toBe(true)
  const value = (r as { delivered: true; value: T | null }).value
  expect(value, 'the seeded document came back null — the read was refused').not.toBeNull()
  return value
}

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
    await setDoc(doc(db, 'users', TEACHER), { role: 'teacher', displayName: 'Dr Chen', studioCode: CODE })
    await setDoc(doc(db, 'users', OTHER_TEACHER), { role: 'teacher', displayName: 'Mr Diaz', studioCode: 'DIAZ77' })
    await setDoc(doc(db, 'studioInvites', TOKEN), {
      teacherId: TEACHER, teacherName: 'Dr Chen', studioName: 'Chen Music',
      createdAt: new Date().toISOString(), expiresAt: WEEK, status: 'open',
    })
    await setDoc(doc(db, 'inviteCodes', CODE), { token: TOKEN, teacherId: TEACHER, expiresAt: WEEK })
    await setDoc(doc(db, 'users', ANA), { role: 'student', displayName: 'Ana', teacherId: TEACHER, studioCode: CODE })
    await setDoc(doc(db, 'users', BEN), { role: 'student', displayName: 'Ben', teacherId: TEACHER, studioCode: CODE })
    await setDoc(doc(db, 'users', CLARE), { role: 'student', displayName: 'Clare', teacherId: OTHER_TEACHER })
  })
})

/** Seed a document with rules off, and hand back its id. */
async function seed(col: string, id: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), col, id), data)
  })
  return id
}

const SESSION = {
  date: '2026-03-01', durationMinutes: 30, category: 'Technique',
  difficultyRating: 3, confidenceRating: 7, createdAt: new Date().toISOString(),
}

/* ══════════════════════════════════════════════════════════════════════
 * A student's own data — the screens they open every day
 * ════════════════════════════════════════════════════════════════════ */

describe("the student's own reads", () => {
  it('subscribePracticeSessions — the bounded, ordered query the whole app derives from', async () => {
    await seed('practiceSessions', 's1', { ...SESSION, userId: ANA })
    asAna()
    const got = await expectDelivered<unknown[]>((cb) => practice.subscribePracticeSessions(ANA, cb))
    expect(got).toHaveLength(1)
  })

  it('getPracticeSessions — the one-shot read', async () => {
    await seed('practiceSessions', 's1', { ...SESSION, userId: ANA })
    asAna()
    expect(await practice.getPracticeSessions(ANA)).toHaveLength(1)
  })

  // A session whose date was saved as a Timestamp — by code that never
  // shipped, run against the live database — made every `date.substring`
  // in the app throw and took the whole app down. The reads now hand back
  // the day as a string, mixed in with ordinary sessions, in order.
  it('a session saved with a Timestamp date reads back as its day', async () => {
    await seed('practiceSessions', 's1', { ...SESSION, userId: ANA, date: '2026-11-08' })
    await seed('practiceSessions', 'stamped', {
      ...SESSION, userId: ANA, date: Timestamp.fromDate(new Date('2026-11-07T00:00:00.000Z')),
    })
    await seed('practiceSessions', 's0', { ...SESSION, userId: ANA, date: '2026-11-06' })
    asAna()
    const live = await expectDelivered<{ id: string; date: string }[]>((cb) => practice.subscribePracticeSessions(ANA, cb))
    expect(live.map((s) => [s.id, s.date])).toEqual([['s1', '2026-11-08'], ['stamped', '2026-11-07'], ['s0', '2026-11-06']])
    const once = await practice.getPracticeSessions(ANA)
    expect(once.map((s) => s.date)).toEqual(['2026-11-08', '2026-11-07', '2026-11-06'])
  })

  it('and so does a take, for the student and for their teacher', async () => {
    const stamped = Timestamp.fromDate(new Date('2026-11-07T00:00:00.000Z'))
    await seed('recordings', 'r1', { userId: ANA, date: stamped, storagePath: 'x', sharedWithTeacher: true })
    asAna()
    const mine = await expectDelivered<{ date: string }[]>((cb) => recordings.subscribeRecordings(ANA, cb))
    expect(mine.map((r) => r.date)).toEqual(['2026-11-07'])
    asTeacher()
    const theirs = await expectDelivered<{ date: string }[]>((cb) => recordings.subscribeSharedRecordings(ANA, cb))
    expect(theirs.map((r) => r.date)).toEqual(['2026-11-07'])
  })

  it('subscribePieces', async () => {
    await seed('pieces', 'p1', { userId: ANA, title: 'Bach', updatedAt: '2026-03-01' })
    asAna()
    expect(await expectDelivered<unknown[]>((cb) => pieces.subscribePieces(ANA, cb))).toHaveLength(1)
  })

  it('getPieces', async () => {
    await seed('pieces', 'p1', { userId: ANA, title: 'Bach', updatedAt: '2026-03-01' })
    asAna()
    expect(await pieces.getPieces(ANA)).toHaveLength(1)
  })

  it('subscribePerformances', async () => {
    await seed('performances', 'f1', { userId: ANA, date: '2026-03-01', title: 'Recital' })
    asAna()
    expect(await expectDelivered<unknown[]>((cb) => performances.subscribePerformances(ANA, cb))).toHaveLength(1)
  })

  it('subscribeRecordings — all of their own takes, shared or not', async () => {
    await seed('recordings', 'r1', { userId: ANA, date: '2026-03-01', audioUrl: 'x' })
    await seed('recordings', 'r2', { userId: ANA, date: '2026-03-02', audioUrl: 'y', sharedWithTeacher: true })
    asAna()
    expect(await expectDelivered<unknown[]>((cb) => recordings.subscribeRecordings(ANA, cb))).toHaveLength(2)
  })

  it('subscribeStudentAssignments', async () => {
    await seed('assignments', 'a1', { teacherId: TEACHER, studentId: ANA, status: 'active' })
    asAna()
    expect(await expectDelivered<unknown[]>((cb) => assignments.subscribeStudentAssignments(ANA, cb))).toHaveLength(1)
  })

  it('subscribeStudentSchedule', async () => {
    await seed('lessonSlots', 'l1', { teacherId: TEACHER, studentId: ANA, start: '2026-03-01T10:00' })
    asAna()
    expect(await expectDelivered<unknown[]>((cb) => schedule.subscribeStudentSchedule(ANA, cb))).toHaveLength(1)
  })

  it("subscribeTeacherNotes — a student reading what's been written about them", async () => {
    await seed('teacherNotes', 'n1', { teacherId: TEACHER, studentId: ANA, content: 'Good bow control' })
    asAna()
    expect(await expectDelivered<unknown[]>((cb) => teacher.subscribeTeacherNotes(ANA, cb))).toHaveLength(1)
  })

  it('subscribePracticeSummary / subscribeStudioStats — their own roll-ups', async () => {
    await seed('practiceSummary', ANA, { uid: ANA, days: {} })
    await seed('studioStats', ANA, { uid: ANA, teacherId: TEACHER, days: {} })
    asAna()
    await expectDocDelivered((cb) => summary.subscribePracticeSummary(ANA, cb))
    await expectDocDelivered((cb) => summary.subscribeStudioStats(ANA, cb))
  })
})

/* ══════════════════════════════════════════════════════════════════════
 * The teacher's screens
 * ════════════════════════════════════════════════════════════════════ */

describe('messages, through the real functions', () => {
  it('sendMessage / subscribeStudentMessages — a student writes to their teacher and reads it back', async () => {
    asAna()
    await assertSucceeds(messages.sendMessage({ teacherId: TEACHER, studentId: ANA, from: 'student', text: 'Hi!' }))
    const got = await expectDelivered<{ text: string }[]>((cb) => messages.subscribeStudentMessages(ANA, cb))
    expect(got.map((m) => m.text)).toEqual(['Hi!'])
  })

  it('subscribeTeacherMessages / deleteMessage — the teacher reads every thread, and removes their own', async () => {
    await seed('messages', 'm1', { teacherId: TEACHER, studentId: ANA, from: 'teacher', text: 'Hello', createdAt: '2026-11-09T10:00:00.000Z' })
    asTeacher()
    const got = await expectDelivered<{ id: string }[]>((cb) => messages.subscribeTeacherMessages(TEACHER, cb))
    expect(got).toHaveLength(1)
    await assertSucceeds(messages.deleteMessage('m1'))
  })
})

describe("the teacher's reads", () => {
  it('subscribeStudents — the roster, by role and teacherId', async () => {
    asTeacher()
    const got = await expectDelivered<unknown[]>((cb) => teacher.subscribeStudents(TEACHER, cb))
    expect(got).toHaveLength(2)
  })

  it('getStudentsForTeacher — the same roster, one-shot, clauses in the other order', async () => {
    asTeacher()
    expect(await teacher.getStudentsForTeacher(TEACHER)).toHaveLength(2)
  })

  it('getInvite / resolveInviteCode — the two ways a student reaches an invitation', async () => {
    asClare()
    expect((await invites.getInvite(TOKEN)).invite?.teacherId).toBe(TEACHER)
    expect((await invites.resolveInviteCode(CODE)).invite?.token).toBe(TOKEN)
    // The spoken code is forgiving about case and stray punctuation.
    expect((await invites.resolveInviteCode(` ${CODE.toLowerCase()} `)).invite?.token).toBe(TOKEN)
    expect((await invites.getInvite('nothing-here')).problem).toBe('not-found')
  })

  it('createInvite / revokeInvite — minting and burning, as the teacher does', async () => {
    asTeacher()
    const minted = await invites.createInvite({
      uid: TEACHER, role: 'teacher', displayName: 'Dr Chen', studioName: 'Chen Music',
    } as never)
    expect(minted.token).toHaveLength(22)
    expect(minted.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
    expect(invites.inviteUrl(minted.token)).toBe(`/join/${minted.token}`)
    expect(invites.generateInviteToken()).not.toBe(invites.generateInviteCode())

    asClare()
    expect((await invites.resolveInviteCode(minted.code)).invite?.token).toBe(minted.token)
    asTeacher()
    await invites.revokeInvite(minted.token)
    expect((await invites.getInvite(minted.token)).problem).toBe('revoked')
  })

  it('requestToJoin / accept — the whole handshake through the real functions', async () => {
    await seed('users', 'loner', { role: 'student', displayName: 'Lo' })
    as(env.authenticatedContext('loner'), 'loner')

    const { invite } = await invites.getInvite(TOKEN)
    const raised = await invites.requestToJoin(
      { uid: 'loner', role: 'student', displayName: 'Lo' } as never,
      invite!
    )
    expect(raised.id).toBe(invites.requestId('loner', TEACHER))
    // Spending it closes it, so the same link cannot be used twice.
    expect((await invites.getInvite(TOKEN)).problem).toBe('claimed')
    expect(await expectDelivered((cb) => requests.subscribeMyStudioRequest('loner', cb))).toBeTruthy()

    asTeacher()
    const waiting = await expectDelivered<unknown[]>((cb) => requests.subscribeStudioRequests(TEACHER, cb))
    expect(waiting, 'the teacher sees it waiting').toHaveLength(1)
    await assertSucceeds(requests.acceptStudioRequest(raised, 'Chen Music'))

    // The student reads when they were let in — the "You've joined" note.
    as(env.authenticatedContext('loner'), 'loner')
    expect(await requests.acceptedAt('loner', TEACHER)).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    // Nobody else can read it.
    asBen()
    await assertFails(requests.acceptedAt('loner', TEACHER))
  })

  it('leaveStudio — a student walking out of their own accord', async () => {
    asAna()
    await assertSucceeds(requests.leaveStudio(ANA))
    // Somebody else's is refused by the function before Firestore is even
    // asked — the rule refuses it too, which rules.join.test.ts covers.
    await expect(requests.leaveStudio(BEN)).rejects.toThrow(/not your studio/i)
  })

  it('declineStudioRequest / withdrawStudioRequest — the other two endings', async () => {
    await seed('users', 'loner', { role: 'student', displayName: 'Lo' })
    await seed('studioRequests', invites.requestId('loner', TEACHER), {
      studentId: 'loner', teacherId: TEACHER, studentName: 'Lo',
      inviteToken: TOKEN, createdAt: new Date().toISOString(), status: 'pending',
    })
    asTeacher()
    await assertSucceeds(requests.declineStudioRequest({
      id: invites.requestId('loner', TEACHER), studentId: 'loner', teacherId: TEACHER,
      studentName: 'Lo', inviteToken: TOKEN, createdAt: '', status: 'pending',
    }))

    await seed('studioRequests', invites.requestId('loner', OTHER_TEACHER), {
      studentId: 'loner', teacherId: OTHER_TEACHER, studentName: 'Lo',
      inviteToken: TOKEN, createdAt: new Date().toISOString(), status: 'pending',
    })
    as(env.authenticatedContext('loner'), 'loner')
    await assertSucceeds(requests.withdrawStudioRequest('loner', OTHER_TEACHER))
  })

  it('subscribeSharedRecordings — handed-in takes only (the query that broke once)', async () => {
    await seed('recordings', 'r1', { userId: ANA, date: '2026-03-01', audioUrl: 'x' })
    await seed('recordings', 'r2', { userId: ANA, date: '2026-03-02', audioUrl: 'y', sharedWithTeacher: true })
    asTeacher()
    const got = await expectDelivered<unknown[]>((cb) => recordings.subscribeSharedRecordings(ANA, cb))
    expect(got, 'only the handed-in take is readable').toHaveLength(1)
  })

  it('subscribeTeacherAssignments — every assignment they set, across all students', async () => {
    await seed('assignments', 'a1', { teacherId: TEACHER, studentId: ANA, status: 'active' })
    await seed('assignments', 'a2', { teacherId: TEACHER, studentId: BEN, status: 'active' })
    asTeacher()
    expect(await expectDelivered<unknown[]>((cb) => assignments.subscribeTeacherAssignments(TEACHER, cb))).toHaveLength(2)
  })

  it('subscribeTeacherStudentAssignments — one student at a time', async () => {
    await seed('assignments', 'a1', { teacherId: TEACHER, studentId: ANA, status: 'active' })
    asTeacher()
    expect(await expectDelivered<unknown[]>(
      (cb) => assignments.subscribeTeacherStudentAssignments(TEACHER, ANA, cb)
    )).toHaveLength(1)
  })

  it('subscribeTeacherSchedule', async () => {
    await seed('lessonSlots', 'l1', { teacherId: TEACHER, studentId: ANA, start: '2026-03-01T10:00' })
    asTeacher()
    expect(await expectDelivered<unknown[]>((cb) => schedule.subscribeTeacherSchedule(TEACHER, cb))).toHaveLength(1)
  })

  it('subscribeTeacherNotes — the teacher reading their own notes on a student', async () => {
    await seed('teacherNotes', 'n1', { teacherId: TEACHER, studentId: ANA, content: 'Good bow control' })
    asTeacher()
    expect(await expectDelivered<unknown[]>((cb) => teacher.subscribeTeacherNotes(ANA, cb))).toHaveLength(1)
  })

  it("subscribePracticeSummary — a student's roll-up, which is what the charts draw", async () => {
    await seed('practiceSummary', ANA, { uid: ANA, days: {} })
    asTeacher()
    await expectDocDelivered((cb) => summary.subscribePracticeSummary(ANA, cb))
  })
})

/* ══════════════════════════════════════════════════════════════════════
 * The leaderboard — a classmate, not the owner, not the teacher
 * ════════════════════════════════════════════════════════════════════ */

describe('the leaderboard', () => {
  it("a classmate reads studioStats, and only the studio's", async () => {
    await seed('studioStats', ANA, { uid: ANA, teacherId: TEACHER, days: { '2026-03-01': 30 } })
    await seed('studioStats', CLARE, { uid: CLARE, teacherId: OTHER_TEACHER, days: {} })
    asBen()
    await expectDocDelivered((cb) => summary.subscribeStudioStats(ANA, cb))
    await expectDocRefused((cb) => summary.subscribeStudioStats(CLARE, cb))
  })

  it('a classmate cannot reach the richer practiceSummary', async () => {
    await seed('practiceSummary', ANA, { uid: ANA, days: {} })
    asBen()
    await expectDocRefused((cb) => summary.subscribePracticeSummary(ANA, cb))
  })
})

/* ══════════════════════════════════════════════════════════════════════
 * Writes — the real payloads, not approximations of them
 * ════════════════════════════════════════════════════════════════════ */

describe("the student's own writes", () => {
  it('addPracticeSession / updatePracticeSession / deletePracticeSession', async () => {
    asAna()
    const id = await assertSucceeds(practice.addPracticeSession(ANA, SESSION as never))
    await assertSucceeds(practice.updatePracticeSession(id, { durationMinutes: 45 }))
    await assertSucceeds(practice.deletePracticeSession(id))
  })

  it('addPiece / updatePiece / deletePiece', async () => {
    asAna()
    const id = await assertSucceeds(pieces.addPiece(ANA, { title: 'Bach', composer: 'JSB' } as never))
    await assertSucceeds(pieces.updatePiece(id, { title: 'Bach, Partita' } as never))
    await assertSucceeds(pieces.deletePiece(id))
  })

  it('addPerformance / updatePerformance / deletePerformance', async () => {
    asAna()
    const id = await assertSucceeds(
      performances.addPerformance(ANA, { date: '2026-03-01', title: 'Recital' } as never)
    )
    await assertSucceeds(performances.updatePerformance(id, { title: 'Spring Recital' } as never))
    await assertSucceeds(performances.deletePerformance(id))
  })

  it('shareRecordings — handing takes in', async () => {
    await seed('recordings', 'r1', { userId: ANA, date: '2026-03-01', audioUrl: 'x' })
    asAna()
    await assertSucceeds(recordings.shareRecordings(['r1']))
  })

  it('deleteRecording — the row goes even when the storage object is unreachable', async () => {
    await seed('recordings', 'r1', { userId: ANA, date: '2026-03-01', audioUrl: 'x' })
    asAna()
    await assertSucceeds(recordings.deleteRecording('r1', { audioUrl: 'gs://nowhere/x' }))
  })

  it('renameRecording — naming your own take', async () => {
    await seed('recordings', 'r1', { userId: ANA, date: '2026-03-01', audioUrl: 'x' })
    asAna()
    await assertSucceeds(recordings.renameRecording('r1', 'Slow run, bar 12 clean'))
  })

  it('renameRecording — but not somebody else’s', async () => {
    // The rule that stops this is the same one that pins userId on every
    // other recording write; said out loud because a title is the first
    // field a reader might assume is harmless.
    await seed('recordings', 'r1', { userId: BEN, date: '2026-03-01', audioUrl: 'x' })
    asAna()
    await assertFails(recordings.renameRecording('r1', 'mine now'))
  })

  it('writeSummaries — both roll-ups, as the app writes them together', async () => {
    asAna()
    await assertSucceeds(summary.writeSummaries(
      { uid: ANA, teacherId: TEACHER, displayName: 'Ana', days: { '2026-03-01': 30 } } as never,
      { uid: ANA, days: { '2026-03-01': { technique: 30 } } } as never
    ))
  })

  it('updateUserProfile — editing your own name', async () => {
    asAna()
    await assertSucceeds(teacher.updateUserProfile(ANA, { displayName: 'Ana M.' }))
  })

  it('recordStreakFreezes / markMasteryPrompted / markBadgesSeen — the arrayUnion writes', async () => {
    asAna()
    await assertSucceeds(teacher.recordStreakFreezes(ANA, ['2026-03-02']))
    await assertSucceeds(teacher.markMasteryPrompted(ANA, ['p1']))
    await assertSucceeds(teacher.markBadgesSeen(ANA, ['first-week']))
    await assertSucceeds(teacher.recordBadgesEarned(ANA, ['first-week'], '2026-03-02T00:00:00.000Z'))
  })

  it('saveStreakRules / recordStreakRepair — your streak rules and a comeback', async () => {
    asAna()
    await assertSucceeds(teacher.saveStreakRules(ANA, [{ from: '2026-03-03', min: 15, lessonDay: 3 }]))
    await assertSucceeds(teacher.recordStreakRepair(ANA, '2026-03-02'))
  })

  it('and nobody writes them onto someone else', async () => {
    asBen()
    await assertFails(teacher.saveStreakRules(ANA, [{ from: '2026-03-03', min: 0, lessonDay: null }]))
    await assertFails(teacher.recordStreakRepair(ANA, '2026-03-02'))
  })

  it('submitAssignment — handing work in, and again after feedback', async () => {
    await seed('assignments', 'a1', { teacherId: TEACHER, studentId: ANA, status: 'active' })
    asAna()
    await assertSucceeds(assignments.submitAssignment('a1', { note: 'first go' } as never))
    await assertSucceeds(assignments.submitAssignment('a1', { note: 'second go' } as never))
  })

  it('submitAssignment on an assignment already returned for revision', async () => {
    await seed('assignments', 'a1', {
      teacherId: TEACHER, studentId: ANA, status: 'returned',
      submissions: [{ at: '2026-03-01T10:00:00.000Z', note: 'first go' }],
      feedback: [{ at: '2026-03-01T11:00:00.000Z', verdict: 'returned', note: 'again please' }],
    })
    asAna()
    await assertSucceeds(assignments.submitAssignment('a1', { note: 'revised' } as never))
  })
})

describe("the teacher's writes", () => {
  it('createAssignment / updateAssignmentStatus / deleteAssignment', async () => {
    asTeacher()
    const id = await assertSucceeds(
      assignments.createAssignment(TEACHER, ANA, { title: 'Scales', dueDate: '2026-03-08' } as never)
    )
    await assertSucceeds(assignments.updateAssignmentStatus(id, 'completed'))
    await assertSucceeds(assignments.deleteAssignment(id))
  })

  it('reviewAssignment — approving and returning', async () => {
    await seed('assignments', 'a1', {
      teacherId: TEACHER, studentId: ANA, status: 'submitted',
      submissions: [{ at: '2026-03-01T10:00:00.000Z' }],
    })
    asTeacher()
    await assertSucceeds(assignments.reviewAssignment('a1', 'returned', 'tempo is uneven'))
    await assertSucceeds(assignments.reviewAssignment('a1', 'approved', 'much better'))
  })

  it('addTeacherNote / updateTeacherNote / deleteTeacherNote', async () => {
    asTeacher()
    const id = await assertSucceeds(teacher.addTeacherNote(TEACHER, ANA, 'Good bow control'))
    await assertSucceeds(teacher.updateTeacherNote(id, 'Bow control much improved'))
    await assertSucceeds(teacher.deleteTeacherNote(id))
  })

  it('createLessonSlot / updateLessonSlot / deleteLessonSlot', async () => {
    asTeacher()
    const id = await assertSucceeds(
      schedule.createLessonSlot(TEACHER, { studentId: ANA, start: '2026-03-01T10:00', durationMin: 45 } as never)
    )
    await assertSucceeds(schedule.updateLessonSlot(id, { durationMin: 60 } as never))
    await assertSucceeds(schedule.deleteLessonSlot(id))
  })

  it('removeStudentFromStudio — the Remove button on the students page', async () => {
    asTeacher()
    await assertSucceeds(teacher.removeStudentFromStudio(ANA))
  })
})

/* ══════════════════════════════════════════════════════════════════════
 * The same real functions, called by the wrong person
 * ════════════════════════════════════════════════════════════════════ */

describe('the app functions, driven by someone with no business calling them', () => {
  it("a teacher from another studio cannot read a student's data", async () => {
    await seed('practiceSessions', 's1', { ...SESSION, userId: ANA })
    await seed('recordings', 'r1', { userId: ANA, date: '2026-03-01', audioUrl: 'y', sharedWithTeacher: true })
    asOtherTeacher()
    await expectNothing((cb) => practice.subscribePracticeSessions(ANA, cb))
    await expectNothing((cb) => recordings.subscribeSharedRecordings(ANA, cb))
  })

  it('a student cannot run the teacher roster query for someone else', async () => {
    asAna()
    await expectNothing((cb) => teacher.subscribeStudents(TEACHER, cb))
  })

  it('a student cannot create an assignment for themselves', async () => {
    asAna()
    await assertFails(assignments.createAssignment(ANA, ANA, { title: 'Easy one' } as never))
  })

  it('a student cannot review their own work', async () => {
    await seed('assignments', 'a1', { teacherId: TEACHER, studentId: ANA, status: 'submitted' })
    asAna()
    await assertFails(assignments.reviewAssignment('a1', 'approved', 'looks great to me'))
  })

  it('a student cannot write a note about themselves', async () => {
    asAna()
    await assertFails(teacher.addTeacherNote(ANA, ANA, 'Teacher says I am excellent'))
  })

  it('a student cannot remove a classmate from the studio', async () => {
    asAna()
    await assertFails(teacher.removeStudentFromStudio(BEN))
  })

  it("a classmate cannot overwrite someone else's roll-ups", async () => {
    asBen()
    await assertFails(summary.writeSummaries(
      { uid: ANA, teacherId: TEACHER, days: {} } as never,
      { uid: ANA, days: {} } as never
    ))
  })
})

/* ══════════════════════════════════════════════════════════════════════
 * Account creation and joining a studio
 *
 * The only payloads in this file not produced by calling app code. Both
 * writes are inline in components rather than in a module — signUp builds
 * its profile object in src/lib/firebase/auth.ts:31 and writes it at :54,
 * and the join handler builds its patch in
 * src/pages/student/SettingsPage.tsx:107 and writes it at :113 — so these
 * mirror the payload instead of executing it. Mirrored payloads drift;
 * these two are worth the risk because they are the writes the last two
 * rounds of rule changes touched, and the only ones that must satisfy
 * studioCodeMatches.
 * ════════════════════════════════════════════════════════════════════ */

describe('signing up and joining a studio', () => {
  /** src/lib/firebase/auth.ts:31 — undefineds stripped, as at :52. */
  function signupProfile(role: 'student' | 'teacher', displayName: string, studioCode?: string) {
    const now = new Date().toISOString()
    const profile: Record<string, unknown> = {
      email: `${displayName.toLowerCase()}@example.com`,
      role,
      displayName,
      weeklyGoalMinutes: 300,
      dailyGoalMinutes: 43,
      monthlyGoalMinutes: 1200,
      studioCode,
      reminderEnabled: false,
      theme: 'dark',
      createdAt: now,
      updatedAt: now,
    }
    return Object.fromEntries(Object.entries(profile).filter(([, v]) => v !== undefined))
  }

  it("a new student's profile, exactly as signUp writes it", async () => {
    const db = env.authenticatedContext('newcomer').firestore()
    await assertSucceeds(setDoc(doc(db, 'users', 'newcomer'), signupProfile('student', 'Nia')))
  })

  it("a new teacher's profile — no studio code, signUp no longer mints one", async () => {
    const db = env.authenticatedContext('new-teacher').firestore()
    await assertSucceeds(setDoc(doc(db, 'users', 'new-teacher'), signupProfile('teacher', 'Eve')))
  })

  it('nobody can sign up as somebody else', async () => {
    const db = env.authenticatedContext('newcomer').firestore()
    await assertFails(setDoc(doc(db, 'users', ANA), signupProfile('student', 'Not Ana')))
  })

  /** src/pages/student/SettingsPage.tsx:107 */
  const joinPatch = (code: string, teacherId: string) => ({
    role: 'student', studioCode: code, teacherId, updatedAt: new Date().toISOString(),
  })

  it('a student can no longer write themselves into a studio, code or no code', async () => {
    await seed('users', 'loner', { role: 'student', displayName: 'Lo' })
    const db = env.authenticatedContext('loner').firestore()
    await assertFails(
      setDoc(doc(db, 'users', 'loner'), joinPatch(TOKEN, TEACHER), { merge: true })
    )
  })

  it('a student can no longer move themselves between studios either', async () => {
    const db = env.authenticatedContext(ANA).firestore()
    await assertFails(
      setDoc(doc(db, 'users', ANA), joinPatch('DIAZ77', OTHER_TEACHER), { merge: true })
    )
  })

  it("a code that isn't that teacher's is refused", async () => {
    await seed('users', 'loner', { role: 'student', displayName: 'Lo' })
    const db = env.authenticatedContext('loner').firestore()
    await assertFails(
      setDoc(doc(db, 'users', 'loner'), joinPatch('GUESSED', TEACHER), { merge: true })
    )
  })

  it('a student cannot attach themselves to another student', async () => {
    await seed('users', 'loner', { role: 'student', displayName: 'Lo' })
    const db = env.authenticatedContext('loner').firestore()
    await assertFails(
      setDoc(doc(db, 'users', 'loner'), joinPatch(CODE, BEN), { merge: true })
    )
  })

  it('a teacher who lets a student go cannot claim one instead', async () => {
    const db = env.authenticatedContext(OTHER_TEACHER).firestore()
    await assertFails(updateDoc(doc(db, 'users', ANA), { teacherId: OTHER_TEACHER }))
    await assertFails(updateDoc(doc(db, 'users', ANA), { teacherId: null }))
  })

  it('a teacher detaching a student cannot touch anything else', async () => {
    const db = env.authenticatedContext(TEACHER).firestore()
    await assertFails(updateDoc(doc(db, 'users', ANA), { teacherId: null, role: 'teacher' }))
    await assertFails(updateDoc(doc(db, 'users', ANA), { teacherId: null, displayName: 'Renamed' }))
  })

  it("and after being let go, the student's own data is still theirs", async () => {
    await seed('practiceSessions', 's1', { ...SESSION, userId: ANA })
    asTeacher()
    await assertSucceeds(teacher.removeStudentFromStudio(ANA))
    asAna()
    expect(await practice.getPracticeSessions(ANA)).toHaveLength(1)
    asTeacher()
    await expectNothing((cb) => recordings.subscribeSharedRecordings(ANA, cb))
  })
})

describe('the remaining two', () => {
  /**
   * Note the asymmetry: this one-shot read *throws* when refused, while
   * subscribePracticeSummary hands back null for the same refusal. The
   * only caller (src/hooks/useTeacherData.ts:27) does `.catch(() => null)`,
   * so it is handled — but the two paths to the same document report a
   * refusal in two different ways, which is worth knowing before a third
   * caller appears.
   */
  it('getPracticeSummary — the one-shot read behind the teacher charts', async () => {
    await seed('practiceSummary', ANA, { uid: ANA, days: { '2026-03-01': { technique: 30 } } })
    asTeacher()
    expect(await summary.getPracticeSummary(ANA)).not.toBeNull()
    asBen()
    await assertFails(summary.getPracticeSummary(ANA))
  })

  /**
   * uploadRecording is the one function this suite cannot execute: it needs
   * a real Storage bucket and a real signed-in user, and the storage half
   * is covered by rules.storage.test.ts. What is left is the row it writes
   * afterwards — src/lib/firebase/recordings.ts:58 — mirrored here, because
   * that write is what failed in production when `notes: undefined` reached
   * Firestore.
   */
  it('the recording row uploadRecording writes once the audio is up', async () => {
    const db = env.authenticatedContext(ANA).firestore()
    await assertSucceeds(addDoc(collection(db, 'recordings'), {
      userId: ANA,
      date: '2026-03-01',
      pieceId: 'p1',
      durationSec: 95,
      storagePath: 'recordings/student-ana/take-id/x.webm',
      sharedWithTeacher: false,
      createdAt: new Date().toISOString(),
    }))
  })

  it('and not with somebody else as the owner', async () => {
    const db = env.authenticatedContext(ANA).firestore()
    await assertFails(addDoc(collection(db, 'recordings'), {
      userId: BEN, date: '2026-03-01', audioUrl: 'x', createdAt: new Date().toISOString(),
    }))
  })
})

/* ══════════════════════════════════════════════════════════════════════
 * Drift
 *
 * Testing the real functions only helps while the suite keeps calling all
 * of them. Nothing stops someone adding a tenth query module and leaving
 * it unverified — which is how both shipped bugs got out. So the suite
 * checks itself: every function the Firestore modules export has to be
 * named somewhere above, or this fails and says which one is missing.
 * ════════════════════════════════════════════════════════════════════ */

describe('this suite itself', () => {
  it('calls every function the Firestore modules export', () => {
    const modules = [
      'assignments', 'practice', 'pieces', 'performances',
      'recordings', 'schedule', 'teacher', 'summary', 'invites', 'requests', 'messages',
    ]
    const self = readFileSync(__filename, 'utf8')
    const missing: string[] = []

    for (const m of modules) {
      const src = readFileSync(`src/lib/firebase/${m}.ts`, 'utf8')
      for (const match of src.matchAll(/^export (?:async )?function (\w+)/gm)) {
        const name = match[1]
        // uploadRecording needs a live bucket; its row write is mirrored above.
        // recordingAudio reads only Storage, which rules.storage.test.ts
        // covers — who may hear a take is decided there, not here.
        if (name === 'uploadRecording' || name === 'recordingAudio') continue
        if (!self.includes(`.${name}(`)) missing.push(`${m}.${name}`)
      }
    }

    expect(missing, 'these are not exercised against the rules').toEqual([])
  })
})
