import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest'
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore'

/**
 * Adversarial tests: what a determined user can do, rather than what the
 * app asks them to.
 *
 * The suite in rules.test.ts checks the paths the app itself takes. These
 * assume someone who has opened the console and is writing directly — the
 * only threat model that matters, since the rules are the sole thing
 * standing between a client and the database.
 *
 * Each assertion states what *should* be true for the app to be safe. A
 * failure here is a hole, not a broken test.
 */

const PROJECT = 'demo-maestrotrack'
const TEACHER = 'teacher-1'
const OTHER_TEACHER = 'teacher-2'
const ANA = 'student-ana'       // taught by TEACHER
const BEN = 'student-ben'       // taught by TEACHER
const CLARE = 'student-clare'   // taught by OTHER_TEACHER — an outsider to TEACHER's studio

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
    await setDoc(doc(db, 'users', TEACHER), { role: 'teacher', displayName: 'Dr Chen', studioCode: 'CHEN01' })
    await setDoc(doc(db, 'users', OTHER_TEACHER), { role: 'teacher', displayName: 'Mr Diaz', studioCode: 'DIAZ01' })
    await setDoc(doc(db, 'users', ANA), { role: 'student', displayName: 'Ana', teacherId: TEACHER })
    await setDoc(doc(db, 'users', BEN), { role: 'student', displayName: 'Ben', teacherId: TEACHER })
    await setDoc(doc(db, 'users', CLARE), { role: 'student', displayName: 'Clare', teacherId: OTHER_TEACHER })
    await setDoc(doc(db, 'studioStats', ANA), {
      uid: ANA, displayName: 'Ana', teacherId: TEACHER, currentStreak: 9,
      dailyMinutes: { '2026-10-06': 90 },
    })
    await setDoc(doc(db, 'practiceSessions', 'ana-1'), {
      userId: ANA, date: '2026-10-06', durationMinutes: 30, category: 'Scales',
      difficultyRating: 3, confidenceRating: 7, createdAt: '', notes: 'private thoughts',
    })
    await setDoc(doc(db, 'teacherNotes', 'n1'), {
      teacherId: TEACHER, studentId: ANA, content: 'Ana is struggling with rhythm',
      createdAt: '', updatedAt: '',
    })
    await setDoc(doc(db, 'lessonSlots', 'l1'), {
      teacherId: TEACHER, studentId: ANA, studentName: 'Ana', dayOfWeek: 2,
      startTime: '16:00', durationMinutes: 45, createdAt: '', updatedAt: '',
    })
  })
})

const as = (uid: string) => env.authenticatedContext(uid).firestore()

/* ── 1. privilege escalation through your own profile ─────────────── */

describe('a student editing their own profile', () => {
  it('must not be able to promote themselves to teacher', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'users', ANA), { role: 'teacher' }))
  })

  it('must not be able to assign themselves to a different teacher', async () => {
    // The studio-code flow exists to make joining deliberate on both sides.
    await assertFails(updateDoc(doc(as(CLARE), 'users', CLARE), { teacherId: TEACHER }))
  })

  it('must not be able to give themselves a studio code', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'users', ANA), { studioCode: 'FAKE01' }))
  })

  it('CAN still join a studio with the real code — the flow must not break', async () => {
    // Exactly what the join screen sends: the teacher's uid and their code.
    await assertSucceeds(setDoc(doc(as(CLARE), 'users', CLARE), {
      role: 'student', teacherId: TEACHER, studioCode: 'CHEN01', updatedAt: 'now',
    }, { merge: true }))
  })

  it('cannot join with the wrong code', async () => {
    await assertFails(setDoc(doc(as(CLARE), 'users', CLARE), {
      role: 'student', teacherId: TEACHER, studioCode: 'GUESSED', updatedAt: 'now',
    }, { merge: true }))
  })

  it('cannot join by naming a teacher with no code at all', async () => {
    await assertFails(setDoc(doc(as(CLARE), 'users', CLARE), {
      role: 'student', teacherId: TEACHER, updatedAt: 'now',
    }, { merge: true }))
  })

  it('may still change the things that are theirs to change', async () => {
    await assertSucceeds(updateDoc(doc(as(ANA), 'users', ANA), {
      displayName: 'Ana M.', weeklyGoalMinutes: 400,
    }))
  })
})

/* ── 2. the full exploit chain, not just the first step ───────────── */

describe('joining a studio uninvited', () => {
  it('must not let an outsider read a studio’s leaderboard by self-assigning', async () => {
    // Step one: Clare, taught by a different teacher, points herself at TEACHER.
    const attached = await updateDoc(doc(as(CLARE), 'users', CLARE), { teacherId: TEACHER })
      .then(() => true).catch(() => false)

    // Step two: if that worked, she is now a "classmate" and can read Ana's figures.
    if (attached) {
      await assertFails(getDoc(doc(as(CLARE), 'studioStats', ANA)))
    }
  })
})

/* ── 3. deletion ──────────────────────────────────────────────────── */

describe('deleting people', () => {
  it('a teacher must not delete their own student’s profile', async () => {
    await assertFails(deleteDoc(doc(as(TEACHER), 'users', ANA)))
  })

  it('an unrelated teacher must not delete someone else’s student', async () => {
    await assertFails(deleteDoc(doc(as(OTHER_TEACHER), 'users', ANA)))
  })

  it('a student must not delete another student', async () => {
    await assertFails(deleteDoc(doc(as(BEN), 'users', ANA)))
  })

  it('a student must not delete their own profile either', async () => {
    // Deleting the profile would orphan every session, piece and assignment
    // that refers to it.
    await assertFails(deleteDoc(doc(as(ANA), 'users', ANA)))
  })

  it('a teacher must not delete a student’s practice', async () => {
    await assertFails(deleteDoc(doc(as(TEACHER), 'practiceSessions', 'ana-1')))
  })

  it('a classmate must not delete someone’s practice', async () => {
    await assertFails(deleteDoc(doc(as(BEN), 'practiceSessions', 'ana-1')))
  })
})

/* ── 4. tampering with other people's records ─────────────────────── */

describe('writing where you should not', () => {
  it('a teacher must not edit a student’s practice session', async () => {
    await assertFails(updateDoc(doc(as(TEACHER), 'practiceSessions', 'ana-1'), { durationMinutes: 999 }))
  })

  it('a student must not forge a teacher’s note about themselves', async () => {
    await assertFails(setDoc(doc(as(ANA), 'teacherNotes', 'forged'), {
      teacherId: TEACHER, studentId: ANA, content: 'Ana is doing brilliantly',
      createdAt: '', updatedAt: '',
    }))
  })

  it('a student must not edit an existing note about themselves', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'teacherNotes', 'n1'), { content: 'Ana is excellent' }))
  })

  it('a student may read notes written about them', async () => {
    // Deliberate: anything a student may not see belongs elsewhere.
    await assertSucceeds(getDoc(doc(as(ANA), 'teacherNotes', 'n1')))
  })

  it('a classmate must not read notes about someone else', async () => {
    await assertFails(getDoc(doc(as(BEN), 'teacherNotes', 'n1')))
  })

  it('a student must not invent their own lesson slot', async () => {
    await assertFails(setDoc(doc(as(ANA), 'lessonSlots', 'mine'), {
      teacherId: TEACHER, studentId: ANA, studentName: 'Ana', dayOfWeek: 0,
      startTime: '09:00', durationMinutes: 60, createdAt: '', updatedAt: '',
    }))
  })

  it('a student must not move an existing lesson', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'lessonSlots', 'l1'), { startTime: '23:00' }))
  })
})

/* ── 5. the summary, which the client writes ──────────────────────── */

describe('rolled-up figures', () => {
  it('a student must not write another student’s summary', async () => {
    await assertFails(setDoc(doc(as(BEN), 'practiceSummary', ANA), {
      uid: ANA, dailyMinutes: { '2026-10-06': 0 }, dailyCategories: {}, totalSessions: 0,
    }))
  })

  it('a teacher must not write a student’s figures either', async () => {
    await assertFails(setDoc(doc(as(TEACHER), 'studioStats', ANA), {
      uid: ANA, displayName: 'Ana', teacherId: TEACHER, currentStreak: 0, dailyMinutes: {},
    }))
  })

  it('a student can inflate their OWN figures — known, and why a server would fix it', async () => {
    // Self-reported by design: there is no backend to compute them. Recorded
    // as a test so the limitation is visible rather than forgotten.
    await assertSucceeds(setDoc(doc(as(ANA), 'studioStats', ANA), {
      uid: ANA, displayName: 'Ana', teacherId: TEACHER, currentStreak: 9999,
      dailyMinutes: { '2026-10-06': 99999 },
    }))
  })

  it('a student must not claim another studio in their own figures', async () => {
    // Writing teacherId: TEACHER into her own stats would expose Clare to a
    // studio she does not belong to, and put her in their leaderboard.
    await assertFails(setDoc(doc(as(CLARE), 'studioStats', CLARE), {
      uid: CLARE, displayName: 'Clare', teacherId: TEACHER, currentStreak: 1, dailyMinutes: {},
    }))
  })
})

/* ── 6. recordings ────────────────────────────────────────────────── */

describe('recordings', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'recordings', 'ana-private'), {
        userId: ANA, pieceName: 'Ballade', date: '2026-10-06', audioUrl: 'x', createdAt: '',
      })
    })
  })

  it('a teacher must not mark a student’s take as shared on their behalf', async () => {
    await assertFails(updateDoc(doc(as(TEACHER), 'recordings', 'ana-private'), { sharedWithTeacher: true }))
  })

  it('a classmate must not read a take at all', async () => {
    await assertFails(getDoc(doc(as(BEN), 'recordings', 'ana-private')))
  })

  it('a classmate must not query another student’s takes', async () => {
    const q = query(collection(as(BEN), 'recordings'), where('userId', '==', ANA))
    await assertFails(getDocs(q))
  })
})

/* ── 7. assignments, from the other side ──────────────────────────── */

describe('assignments', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'assignments', 'a1'), {
        teacherId: TEACHER, studentId: ANA, title: 'Scales', status: 'submitted',
        createdAt: '', updatedAt: '',
      })
    })
  })

  it('an unrelated teacher must not approve work they did not set', async () => {
    await assertFails(updateDoc(doc(as(OTHER_TEACHER), 'assignments', 'a1'), { status: 'approved' }))
  })

  it('an unrelated teacher must not delete it', async () => {
    await assertFails(deleteDoc(doc(as(OTHER_TEACHER), 'assignments', 'a1')))
  })

  it('a student must not delete work set for them', async () => {
    await assertFails(deleteDoc(doc(as(ANA), 'assignments', 'a1')))
  })

  it('a student must not reassign their work to another student', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'assignments', 'a1'), { studentId: BEN }))
  })
})
