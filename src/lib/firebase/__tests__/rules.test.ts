import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest'
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore'

/**
 * The security rules, actually executed.
 *
 * Every rule in this project was previously written by reasoning and
 * shipped unverified, because the emulators need a JVM this machine did
 * not have. That cost real debugging twice: a teacher's recording query
 * that would have been refused outright, and a bounded session query that
 * made a student's whole history disappear. Both were found by reading
 * them again, which is luck dressed up as diligence.
 *
 * Requires the emulators. Run `npm run emulate` first, then
 * `npm run test:rules`.
 */

const PROJECT = 'demo-maestrotrack'

/** The cast of this app: a teacher, two of their students, and an outsider. */
const TEACHER = 'teacher-1'
const OTHER_TEACHER = 'teacher-2'
const ANA = 'student-ana'        // taught by TEACHER
const BEN = 'student-ben'        // taught by TEACHER — Ana's classmate
const CLARE = 'student-clare'    // taught by OTHER_TEACHER — a different studio

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8085,
    },
  })
})

afterAll(async () => { await env?.cleanup() })

beforeEach(async () => {
  await env.clearFirestore()
  // Profiles are seeded with rules off: a rule that reads another document
  // needs that document to exist, and arranging the world is not the thing
  // under test.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', TEACHER), { role: 'teacher', displayName: 'Dr Chen' })
    await setDoc(doc(db, 'users', OTHER_TEACHER), { role: 'teacher', displayName: 'Mr Diaz' })
    await setDoc(doc(db, 'users', ANA), { role: 'student', displayName: 'Ana', teacherId: TEACHER })
    await setDoc(doc(db, 'users', BEN), { role: 'student', displayName: 'Ben', teacherId: TEACHER })
    await setDoc(doc(db, 'users', CLARE), { role: 'student', displayName: 'Clare', teacherId: OTHER_TEACHER })
  })
})

const as = (uid: string) => env.authenticatedContext(uid).firestore()
const anon = () => env.unauthenticatedContext().firestore()

const session = (userId: string) => ({
  userId, date: '2026-10-06', durationMinutes: 30, category: 'Scales',
  difficultyRating: 3, confidenceRating: 7, createdAt: '2026-10-06T10:00:00.000Z',
  notes: 'this is awful and I hate it',
})

/* ── practice sessions: the thoughts pad ──────────────────────────── */

describe('practice sessions stay with the student', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'practiceSessions', 's1'), session(ANA))
    })
  })

  it('a student reads their own', async () => {
    await assertSucceeds(getDoc(doc(as(ANA), 'practiceSessions', 's1')))
  })

  it('their TEACHER cannot — this is what keeps the thoughts pad private', async () => {
    await assertFails(getDoc(doc(as(TEACHER), 'practiceSessions', 's1')))
  })

  it('a classmate cannot', async () => {
    await assertFails(getDoc(doc(as(BEN), 'practiceSessions', 's1')))
  })

  it('a stranger cannot', async () => {
    await assertFails(getDoc(doc(anon(), 'practiceSessions', 's1')))
  })

  it('a student writes their own', async () => {
    await assertSucceeds(setDoc(doc(as(ANA), 'practiceSessions', 'mine'), session(ANA)))
  })

  it('a student cannot write one in someone else’s name', async () => {
    await assertFails(setDoc(doc(as(BEN), 'practiceSessions', 'forged'), session(ANA)))
  })

  it('the app’s own bounded query works for the owner', async () => {
    const q = query(collection(as(ANA), 'practiceSessions'), where('userId', '==', ANA))
    await assertSucceeds(getDocs(q))
  })
})

/* ── recordings: private until handed in ──────────────────────────── */

describe('recordings', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'recordings', 'private'), {
        userId: ANA, pieceName: 'Ballade', date: '2026-10-06', audioUrl: 'x', createdAt: '',
      })
      await setDoc(doc(db, 'recordings', 'handed-in'), {
        userId: ANA, pieceName: 'Ballade', date: '2026-10-06', audioUrl: 'x', createdAt: '',
        sharedWithTeacher: true,
      })
    })
  })

  it('a student hears their own, shared or not', async () => {
    await assertSucceeds(getDoc(doc(as(ANA), 'recordings', 'private')))
    await assertSucceeds(getDoc(doc(as(ANA), 'recordings', 'handed-in')))
  })

  it('their teacher hears a take that was handed in', async () => {
    await assertSucceeds(getDoc(doc(as(TEACHER), 'recordings', 'handed-in')))
  })

  it('their teacher CANNOT hear one that was not', async () => {
    await assertFails(getDoc(doc(as(TEACHER), 'recordings', 'private')))
  })

  it('another teacher hears nothing of theirs', async () => {
    await assertFails(getDoc(doc(as(OTHER_TEACHER), 'recordings', 'handed-in')))
  })

  it('the teacher’s filtered query is permitted', async () => {
    // Without the sharedWithTeacher filter this query is refused outright —
    // a rule only permits a query that proves every result is readable.
    const q = query(
      collection(as(TEACHER), 'recordings'),
      where('userId', '==', ANA),
      where('sharedWithTeacher', '==', true)
    )
    await assertSucceeds(getDocs(q))
  })

  it('and the unfiltered one is not', async () => {
    const q = query(collection(as(TEACHER), 'recordings'), where('userId', '==', ANA))
    await assertFails(getDocs(q))
  })
})

/* ── summaries: what each audience may see ────────────────────────── */

describe('rolled-up practice', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'practiceSummary', ANA), {
        uid: ANA, dailyMinutes: { '2026-10-06': 30 }, dailyCategories: {}, totalSessions: 1,
      })
      await setDoc(doc(db, 'studioStats', ANA), {
        uid: ANA, displayName: 'Ana', teacherId: TEACHER, currentStreak: 3,
        dailyMinutes: { '2026-10-06': 30 },
      })
    })
  })

  it('a teacher reads their student’s summary', async () => {
    await assertSucceeds(getDoc(doc(as(TEACHER), 'practiceSummary', ANA)))
  })

  it('another teacher does not', async () => {
    await assertFails(getDoc(doc(as(OTHER_TEACHER), 'practiceSummary', ANA)))
  })

  it('a classmate cannot read the detailed summary', async () => {
    await assertFails(getDoc(doc(as(BEN), 'practiceSummary', ANA)))
  })

  it('but a classmate CAN read the leaderboard figures', async () => {
    await assertSucceeds(getDoc(doc(as(BEN), 'studioStats', ANA)))
  })

  it('someone from another studio cannot', async () => {
    await assertFails(getDoc(doc(as(CLARE), 'studioStats', ANA)))
  })

  it('nobody writes someone else’s figures', async () => {
    await assertFails(setDoc(doc(as(BEN), 'studioStats', ANA), { displayName: 'Ben was here' }))
  })
})

/* ── assignments: the rule that matters most ──────────────────────── */

describe('assignments', () => {
  const brief = {
    teacherId: TEACHER, studentId: ANA, title: 'Scales, 30 min a day',
    status: 'assigned', createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z', dailyTargetMinutes: 30, dueDate: '2026-10-10',
  }

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'assignments', 'a1'), brief)
    })
  })

  it('a teacher sets work for their own student', async () => {
    await assertSucceeds(setDoc(doc(as(TEACHER), 'assignments', 'new'), brief))
  })

  it('a teacher cannot set work for someone else’s student', async () => {
    await assertFails(setDoc(doc(as(OTHER_TEACHER), 'assignments', 'nope'),
      { ...brief, teacherId: OTHER_TEACHER }))
  })

  it('a student cannot set work for themselves', async () => {
    await assertFails(setDoc(doc(as(ANA), 'assignments', 'self'), { ...brief, teacherId: ANA }))
  })

  it('the student hands it in', async () => {
    await assertSucceeds(updateDoc(doc(as(ANA), 'assignments', 'a1'), {
      status: 'submitted',
      submissions: [{ at: '2026-10-06T10:00:00.000Z', note: 'done' }],
      updatedAt: '2026-10-06T10:00:00.000Z',
    }))
  })

  it('THE STUDENT CANNOT APPROVE THEIR OWN WORK', async () => {
    // The single most important rule in the file.
    await assertFails(updateDoc(doc(as(ANA), 'assignments', 'a1'), {
      status: 'approved', updatedAt: '2026-10-06T10:00:00.000Z',
    }))
  })

  it('the student cannot rewrite the brief while handing it in', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'assignments', 'a1'), {
      status: 'submitted', title: 'something much easier',
      updatedAt: '2026-10-06T10:00:00.000Z',
    }))
  })

  it('the student cannot lower the target', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'assignments', 'a1'), {
      status: 'submitted', dailyTargetMinutes: 1,
      updatedAt: '2026-10-06T10:00:00.000Z',
    }))
  })

  it('the student cannot forge the teacher’s feedback', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'assignments', 'a1'), {
      status: 'submitted',
      feedback: [{ at: '2026-10-06T10:00:00.000Z', verdict: 'approved', note: 'great' }],
      updatedAt: '2026-10-06T10:00:00.000Z',
    }))
  })

  it('the teacher approves it', async () => {
    await assertSucceeds(updateDoc(doc(as(TEACHER), 'assignments', 'a1'), {
      status: 'approved', updatedAt: '2026-10-06T10:00:00.000Z',
    }))
  })

  it('a classmate cannot read it', async () => {
    await assertFails(getDoc(doc(as(BEN), 'assignments', 'a1')))
  })
})

/* ── profiles ─────────────────────────────────────────────────────── */

describe('profiles', () => {
  it('a teacher reads their own students', async () => {
    await assertSucceeds(getDoc(doc(as(TEACHER), 'users', ANA)))
  })

  it('a teacher cannot read another teacher’s student', async () => {
    await assertFails(getDoc(doc(as(OTHER_TEACHER), 'users', ANA)))
  })

  // Was "a student can find a teacher by studio code, which is how joining
  // works" — and it worked by letting any signed-in user list every teacher
  // profile, studio code included. That is the enumeration the invitation
  // flow exists to remove, so the query is now refused and nothing in the
  // app makes it.
  it('a student cannot enumerate teacher profiles any more', async () => {
    const q = query(collection(as(ANA), 'users'), where('role', '==', 'teacher'))
    await assertFails(getDocs(q))
  })

  it('nobody edits anyone else’s profile', async () => {
    await assertFails(setDoc(doc(as(TEACHER), 'users', ANA), { displayName: 'changed' }, { merge: true }))
    await assertFails(setDoc(doc(as(BEN), 'users', ANA), { displayName: 'changed' }, { merge: true }))
  })
})

/* ── anything not granted ─────────────────────────────────────────── */

describe('collections nobody granted', () => {
  it('are denied, rather than inheriting access', async () => {
    await assertFails(getDoc(doc(as(ANA), 'somethingNew', 'x')))
    await assertFails(setDoc(doc(as(ANA), 'somethingNew', 'x'), { a: 1 }))
  })
})

/* ── messages between a teacher and a student ───────────────────────── */

describe('messages', () => {
  const msg = (over: Record<string, unknown> = {}) => ({
    teacherId: TEACHER, studentId: ANA, from: 'student', text: 'Hi!', createdAt: '2026-11-09T10:00:00.000Z', ...over,
  })
  const seed = async (id: string, data: Record<string, unknown>) =>
    env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'messages', id), data) })

  it('a student writes to their own teacher, as themselves', async () => {
    await assertSucceeds(setDoc(doc(as(ANA), 'messages', 'm1'), msg()))
  })

  it('a student cannot write to another teacher, or pose as the teacher, or as another student', async () => {
    await assertFails(setDoc(doc(as(ANA), 'messages', 'm1'), msg({ teacherId: OTHER_TEACHER })))
    await assertFails(setDoc(doc(as(ANA), 'messages', 'm2'), msg({ from: 'teacher' })))
    await assertFails(setDoc(doc(as(BEN), 'messages', 'm3'), msg()))
  })

  it('a student who has left the studio cannot keep writing to that teacher', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users', ANA), { teacherId: null })
    })
    await assertFails(setDoc(doc(as(ANA), 'messages', 'm1'), msg()))
  })

  it('a teacher writes to their own student, as themselves', async () => {
    await assertSucceeds(setDoc(doc(as(TEACHER), 'messages', 'm1'), msg({ from: 'teacher' })))
  })

  it('a teacher cannot write to someone else\'s student, or pose as the student', async () => {
    await assertFails(setDoc(doc(as(TEACHER), 'messages', 'm1'), msg({ from: 'teacher', studentId: CLARE })))
    await assertFails(setDoc(doc(as(TEACHER), 'messages', 'm2'), msg({ from: 'student' })))
    await assertFails(setDoc(doc(as(OTHER_TEACHER), 'messages', 'm3'), msg({ from: 'teacher', teacherId: OTHER_TEACHER })))
  })

  it('a message is text, a shared item, or both — and nothing else', async () => {
    const share = { kind: 'recording', id: 'take-1' }
    await assertSucceeds(setDoc(doc(as(ANA), 'messages', 'a'), msg({ text: '', attachment: share })))
    await assertSucceeds(setDoc(doc(as(ANA), 'messages', 'b'), msg({ text: 'listen to bar 12', attachment: { kind: 'assignment', id: 'a1' } })))
    await assertFails(setDoc(doc(as(ANA), 'messages', 'c'), msg({ text: '' })))
    await assertFails(setDoc(doc(as(ANA), 'messages', 'd'), msg({ text: 'x'.repeat(2001) })))
    await assertFails(setDoc(doc(as(ANA), 'messages', 'e'), msg({ attachment: { kind: 'photo', id: 'p' } })))
    await assertFails(setDoc(doc(as(ANA), 'messages', 'f'), msg({ attachment: { kind: 'recording', id: 'r', url: 'x' } })))
    await assertFails(setDoc(doc(as(ANA), 'messages', 'g'), msg({ read: true })))
  })

  it('each side reads its own conversation, and nobody else does', async () => {
    await seed('m1', msg())
    await assertSucceeds(getDoc(doc(as(ANA), 'messages', 'm1')))
    await assertSucceeds(getDoc(doc(as(TEACHER), 'messages', 'm1')))
    await assertFails(getDoc(doc(as(BEN), 'messages', 'm1')))
    await assertFails(getDoc(doc(as(OTHER_TEACHER), 'messages', 'm1')))
    await assertFails(getDoc(doc(anon(), 'messages', 'm1')))
  })

  it('the app\'s own queries are allowed, and a sweep is not', async () => {
    await seed('m1', msg())
    await assertSucceeds(getDocs(query(collection(as(ANA), 'messages'), where('studentId', '==', ANA))))
    await assertSucceeds(getDocs(query(collection(as(TEACHER), 'messages'), where('teacherId', '==', TEACHER))))
    await assertFails(getDocs(query(collection(as(BEN), 'messages'), where('studentId', '==', ANA))))
    await assertFails(getDocs(collection(as(ANA), 'messages')))
  })

  it('messages are never edited; only the sender deletes', async () => {
    await seed('m1', msg())
    await seed('m2', msg({ from: 'teacher' }))
    await assertFails(updateDoc(doc(as(ANA), 'messages', 'm1'), { text: 'edited' }))
    await assertFails(deleteDoc(doc(as(TEACHER), 'messages', 'm1')))
    await assertFails(deleteDoc(doc(as(ANA), 'messages', 'm2')))
    await assertSucceeds(deleteDoc(doc(as(ANA), 'messages', 'm1')))
    await assertSucceeds(deleteDoc(doc(as(TEACHER), 'messages', 'm2')))
  })
})
