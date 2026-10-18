import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest'
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc, deleteField } from 'firebase/firestore'

/**
 * The protected fields, one at a time.
 *
 * role, teacherId, studioCode and studioStats are the fields a student
 * must not be able to set for themselves: role decides which half of the
 * app they see, teacherId and studioCode decide whose data they can read
 * and who can read theirs, and studioStats is what the leaderboard draws.
 *
 * Grouped by field rather than by attack so a gap in one is obvious.
 * Requires the emulators: `npm run emulate`, then `npm run test:rules`.
 */

const PROJECT = 'demo-maestrotrack'
const TEACHER = 'teacher-1'
const OTHER_TEACHER = 'teacher-2'
const ANA = 'student-ana'
const BEN = 'student-ben'
const CODE = 'CHEN42'
const OTHER_CODE = 'DIAZ77'

let env: RulesTestEnvironment

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
    await setDoc(doc(db, 'users', OTHER_TEACHER), { role: 'teacher', displayName: 'Mr Diaz', studioCode: OTHER_CODE })
    await setDoc(doc(db, 'users', ANA), { role: 'student', displayName: 'Ana', teacherId: TEACHER, studioCode: CODE })
    await setDoc(doc(db, 'users', BEN), { role: 'student', displayName: 'Ben', teacherId: TEACHER, studioCode: CODE })
  })
})

const as = (uid: string) => env.authenticatedContext(uid).firestore()

/* ══════════════════════════════════════════════════════════════════════
 * role
 * ════════════════════════════════════════════════════════════════════ */

describe('role', () => {
  it('a student cannot promote themselves to teacher', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'users', ANA), { role: 'teacher' }))
  })

  it('a student cannot become a teacher by way of a merge write', async () => {
    await assertFails(
      setDoc(doc(as(ANA), 'users', ANA), { role: 'teacher', studioCode: 'MINE99' }, { merge: true })
    )
  })

  it('a student cannot drop the role field to become roleless', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'users', ANA), { role: deleteField() }))
  })

  it('a teacher cannot demote themselves either — role is fixed at signup', async () => {
    await assertFails(updateDoc(doc(as(TEACHER), 'users', TEACHER), { role: 'student' }))
  })

  it('a student may still edit everything role is not', async () => {
    await assertSucceeds(updateDoc(doc(as(ANA), 'users', ANA), {
      displayName: 'Ana M.', instrument: 'violin', weeklyGoalMinutes: 420, theme: 'light',
    }))
  })
})

/* ══════════════════════════════════════════════════════════════════════
 * teacherId
 * ════════════════════════════════════════════════════════════════════ */

describe('teacherId', () => {
  it('a student cannot attach themselves to a teacher without the code', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'users', ANA), { teacherId: OTHER_TEACHER }))
  })

  it('a student cannot attach themselves with a guessed code', async () => {
    await assertFails(
      setDoc(doc(as(ANA), 'users', ANA), { teacherId: OTHER_TEACHER, studioCode: 'GUESS1' }, { merge: true })
    )
  })

  it('a student cannot name another student as their teacher', async () => {
    await assertFails(
      setDoc(doc(as(ANA), 'users', ANA), { teacherId: BEN, studioCode: CODE }, { merge: true })
    )
  })

  it('a student cannot point teacherId at a user that does not exist', async () => {
    await assertFails(
      setDoc(doc(as(ANA), 'users', ANA), { teacherId: 'ghost', studioCode: CODE }, { merge: true })
    )
  })

  it('a student cannot set a classmate\'s teacherId', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'users', BEN), { teacherId: null }))
  })

  it('moving studios with the right code is allowed — this is the join screen', async () => {
    await assertSucceeds(
      setDoc(doc(as(ANA), 'users', ANA), { teacherId: OTHER_TEACHER, studioCode: OTHER_CODE }, { merge: true })
    )
  })

  it('the teacher may detach their own student, and only detach', async () => {
    await assertSucceeds(updateDoc(doc(as(TEACHER), 'users', ANA), { teacherId: null }))
  })

  it('a teacher cannot attach a student who never joined', async () => {
    await assertFails(updateDoc(doc(as(OTHER_TEACHER), 'users', ANA), { teacherId: OTHER_TEACHER }))
  })
})

/* ══════════════════════════════════════════════════════════════════════
 * studioCode
 * ════════════════════════════════════════════════════════════════════ */

describe('studioCode', () => {
  it("a student cannot change their studio code while keeping their teacher", async () => {
    await assertFails(updateDoc(doc(as(ANA), 'users', ANA), { studioCode: 'ANYTHING' }))
  })

  it('a student cannot invent a studio code to look like a teacher', async () => {
    await assertFails(
      setDoc(doc(as(ANA), 'users', ANA), { studioCode: 'ANAS01', studioName: "Ana's Studio" }, { merge: true })
    )
  })

  it("a teacher cannot change their own code out from under their students", async () => {
    await assertFails(updateDoc(doc(as(TEACHER), 'users', TEACHER), { studioCode: 'NEWONE' }))
  })
})

/* ══════════════════════════════════════════════════════════════════════
 * studioStats — the leaderboard document
 * ════════════════════════════════════════════════════════════════════ */

const stats = (over: Record<string, unknown> = {}) => ({
  uid: ANA, displayName: 'Ana', teacherId: TEACHER,
  currentStreak: 5, dailyMinutes: { '2026-03-01': 45 },
  updatedAt: new Date().toISOString(), ...over,
})

describe('studioStats', () => {
  it("a student cannot write a classmate's row", async () => {
    await assertFails(setDoc(doc(as(BEN), 'studioStats', ANA), stats()))
  })

  it('a student cannot put themselves in a studio they are not in', async () => {
    await assertFails(setDoc(doc(as(ANA), 'studioStats', ANA), stats({ teacherId: OTHER_TEACHER })))
  })

  it('a student cannot appear on the leaderboard under a classmate\'s name', async () => {
    await assertFails(setDoc(doc(as(ANA), 'studioStats', ANA), stats({ displayName: 'Ben' })))
  })

  it('a student cannot write a row whose uid points at somebody else', async () => {
    await assertFails(setDoc(doc(as(ANA), 'studioStats', ANA), stats({ uid: BEN })))
  })

  it('their own row, built the way the app builds it, is fine', async () => {
    await assertSucceeds(setDoc(doc(as(ANA), 'studioStats', ANA), stats()))
  })

  it('a student with no studio writes a row nobody else can see', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'loner'), { role: 'student', displayName: 'Lo' })
    })
    await assertSucceeds(setDoc(doc(as('loner'), 'studioStats', 'loner'), {
      uid: 'loner', displayName: 'Lo', currentStreak: 0, dailyMinutes: {},
      updatedAt: new Date().toISOString(),
    }))
  })
})

describe('practiceSummary', () => {
  const summary = (over: Record<string, unknown> = {}) => ({
    uid: ANA, dailyMinutes: {}, dailyCategories: {}, totalSessions: 3,
    updatedAt: new Date().toISOString(), ...over,
  })

  it("a student cannot write a classmate's summary", async () => {
    await assertFails(setDoc(doc(as(BEN), 'practiceSummary', ANA), summary()))
  })

  it('a student cannot write a summary whose uid points at somebody else', async () => {
    await assertFails(setDoc(doc(as(ANA), 'practiceSummary', ANA), summary({ uid: BEN })))
  })

  it('their own summary is fine', async () => {
    await assertSucceeds(setDoc(doc(as(ANA), 'practiceSummary', ANA), summary()))
  })
})
