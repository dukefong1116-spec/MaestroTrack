import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest'
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore'

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

  // Was "CAN still join a studio with the real code — the flow must not
  // break". That flow is gone: holding a code no longer attaches anybody,
  // because joining is a request the teacher accepts. See
  // rules.join.test.ts for what replaced it.
  it('cannot join even with a code that genuinely is that teacher’s', async () => {
    await assertFails(setDoc(doc(as(CLARE), 'users', CLARE), {
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

/* ── 8. writing about students who are not yours ──────────────────── */

describe('a teacher acting outside their own studio', () => {
  it('must not write a note about someone else\u2019s student', async () => {
    await assertFails(setDoc(doc(as(OTHER_TEACHER), 'teacherNotes', 'intrusive'), {
      teacherId: OTHER_TEACHER, studentId: ANA,
      content: 'I have opinions about a child I do not teach',
      createdAt: '', updatedAt: '',
    }))
  })

  it('must not schedule a lesson for someone else\u2019s student', async () => {
    await assertFails(setDoc(doc(as(OTHER_TEACHER), 'lessonSlots', 'intrusive'), {
      teacherId: OTHER_TEACHER, studentId: ANA, studentName: 'Ana', dayOfWeek: 1,
      startTime: '08:00', durationMinutes: 30, createdAt: '', updatedAt: '',
    }))
  })

  it('may do both for their own student', async () => {
    await assertSucceeds(setDoc(doc(as(OTHER_TEACHER), 'teacherNotes', 'ok'), {
      teacherId: OTHER_TEACHER, studentId: CLARE, content: 'Good lesson',
      createdAt: '', updatedAt: '',
    }))
  })
})

/* ── 9. erasing the record ────────────────────────────────────────── */

describe('a student rewriting their own submission history', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'assignments', 'hist'), {
        teacherId: TEACHER, studentId: ANA, title: 'Scales', status: 'returned',
        createdAt: '', updatedAt: '',
        submissions: [
          { at: '2026-10-01T10:00:00.000Z', note: 'first attempt, went badly' },
        ],
        feedback: [
          { at: '2026-10-02T10:00:00.000Z', verdict: 'returned', note: 'try again' },
        ],
      })
    })
  })

  it('must not erase an earlier attempt while resubmitting', async () => {
    // A teacher reviewing a second go wants to see the first. Replacing the
    // array rather than appending to it hides what changed.
    await assertFails(updateDoc(doc(as(ANA), 'assignments', 'hist'), {
      status: 'submitted',
      submissions: [{ at: '2026-10-05T10:00:00.000Z', note: 'nailed it first time' }],
      updatedAt: '2026-10-05T10:00:00.000Z',
    }))
  })

  it('must not delete the feedback it was returned with', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'assignments', 'hist'), {
      status: 'submitted', feedback: [], updatedAt: 'now',
    }))
  })

  it('must not rewrite an earlier attempt while appending a new one', async () => {
    // Appending used to check only that the *last* earlier entry survived,
    // so with two attempts on file the first could be quietly reworded.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'assignments', 'hist'), {
        submissions: [
          { at: '2026-10-01T10:00:00.000Z', note: 'first attempt, went badly' },
          { at: '2026-10-03T10:00:00.000Z', note: 'second go' },
        ],
      })
    })
    await assertFails(updateDoc(doc(as(ANA), 'assignments', 'hist'), {
      status: 'submitted',
      submissions: [
        { at: '2026-10-01T10:00:00.000Z', note: 'first attempt, went perfectly' },
        { at: '2026-10-03T10:00:00.000Z', note: 'second go' },
        { at: '2026-10-05T10:00:00.000Z', note: 'third go' },
      ],
      updatedAt: '2026-10-05T10:00:00.000Z',
    }))
  })

  it('may append a new attempt', async () => {
    await assertSucceeds(updateDoc(doc(as(ANA), 'assignments', 'hist'), {
      status: 'submitted',
      submissions: [
        { at: '2026-10-01T10:00:00.000Z', note: 'first attempt, went badly' },
        { at: '2026-10-05T10:00:00.000Z', note: 'second go' },
      ],
      updatedAt: '2026-10-05T10:00:00.000Z',
    }))
  })
})

/* ── 10. values nobody checks ─────────────────────────────────────── */

describe('data that is the right shape but nonsense', () => {
  it('a session claiming a thousand hours is accepted \u2014 nothing validates it', async () => {
    // Recorded, not asserted as safe. XP, streaks and assignment progress
    // are all derived from these numbers, so a client that lies inflates
    // every one of them. Rules can constrain values; none here do. Fixing
    // it properly belongs with a server that computes rather than accepts.
    await assertSucceeds(setDoc(doc(as(ANA), 'practiceSessions', 'absurd'), {
      userId: ANA, date: '2026-10-06', durationMinutes: 60000, category: 'Scales',
      difficultyRating: 3, confidenceRating: 7, createdAt: '',
    }))
  })

  it('a session dated far in the future is accepted', async () => {
    await assertSucceeds(setDoc(doc(as(ANA), 'practiceSessions', 'future'), {
      userId: ANA, date: '2099-01-01', durationMinutes: 30, category: 'Scales',
      difficultyRating: 3, confidenceRating: 7, createdAt: '',
    }))
  })

  // Every reader takes the day from `date` as a string. One session saved
  // with a Timestamp there took the whole app down, so it is refused.
  it('a session or take must be dated with the day as a string', async () => {
    const stamped = Timestamp.fromDate(new Date('2026-10-06T00:00:00.000Z'))
    await assertFails(setDoc(doc(as(ANA), 'practiceSessions', 'stamped'), {
      userId: ANA, date: stamped, durationMinutes: 30, category: 'Scales',
      difficultyRating: 3, confidenceRating: 7, createdAt: '',
    }))
    await assertFails(setDoc(doc(as(ANA), 'practiceSessions', 'undated'), {
      userId: ANA, durationMinutes: 30, category: 'Scales',
      difficultyRating: 3, confidenceRating: 7, createdAt: '',
    }))
    await assertFails(setDoc(doc(as(ANA), 'recordings', 'stamped-take'), {
      userId: ANA, date: stamped, pieceName: 'x', storagePath: 'x', createdAt: '',
    }))
    await assertFails(updateDoc(doc(as(ANA), 'practiceSessions', 'ana-1'), { date: stamped }))
    // The ordinary case is untouched.
    await assertSucceeds(updateDoc(doc(as(ANA), 'practiceSessions', 'ana-1'), { date: '2026-10-05' }))
  })

  it('but one already saved the old way can still be edited, or fixed', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'practiceSessions', 'old-stamped'), {
        userId: ANA, date: Timestamp.fromDate(new Date('2026-10-06T00:00:00.000Z')),
        durationMinutes: 30, category: 'Scales', difficultyRating: 3, confidenceRating: 7, createdAt: '',
      })
    })
    await assertSucceeds(updateDoc(doc(as(ANA), 'practiceSessions', 'old-stamped'), { notes: 'still mine' }))
    await assertSucceeds(updateDoc(doc(as(ANA), 'practiceSessions', 'old-stamped'), { date: '2026-10-06' }))
  })

  it('but a session still cannot be planted on someone else', async () => {
    await assertFails(setDoc(doc(as(BEN), 'practiceSessions', 'planted'), {
      userId: ANA, date: '2026-10-06', durationMinutes: 30, category: 'Scales',
      difficultyRating: 3, confidenceRating: 7, createdAt: '',
    }))
  })
})

/* ── 11. moving a record to someone else ──────────────────────────── */

describe('changing who owns a record', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'recordings', 'ana-take'), {
        userId: ANA, pieceName: 'Ballade', date: '2026-10-06', audioUrl: 'x', createdAt: '',
      })
    })
  })

  it('a student must not reassign their own recording to someone else', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'recordings', 'ana-take'), { userId: BEN }))
  })

  it('a student must not reassign their own session to someone else', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'practiceSessions', 'mine'), {
        userId: ANA, date: '2026-10-06', durationMinutes: 30, category: 'Scales',
        difficultyRating: 3, confidenceRating: 7, createdAt: '',
      })
    })
    await assertFails(updateDoc(doc(as(ANA), 'practiceSessions', 'mine'), { userId: BEN }))
  })

  // A teacher may edit what they set, but not whose it is. Moving a note or
  // an assignment to another student plants it in a stranger's list —
  // CLARE is not even in this studio — and moving it to another teacher
  // hands it to someone who never wrote it.
  it('a teacher must not move an assignment to another student or teacher', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'assignments', 'set'), {
        teacherId: TEACHER, studentId: ANA, title: 'Scales', status: 'assigned', createdAt: '', updatedAt: '',
      })
    })
    await assertFails(updateDoc(doc(as(TEACHER), 'assignments', 'set'), { studentId: CLARE }))
    await assertFails(updateDoc(doc(as(TEACHER), 'assignments', 'set'), { teacherId: OTHER_TEACHER }))
    // Editing it in place still works.
    await assertSucceeds(updateDoc(doc(as(TEACHER), 'assignments', 'set'), { title: 'Scales, slower' }))
  })

  it('a teacher must not move a note to another student or teacher', async () => {
    await assertFails(updateDoc(doc(as(TEACHER), 'teacherNotes', 'n1'), { studentId: CLARE }))
    await assertFails(updateDoc(doc(as(TEACHER), 'teacherNotes', 'n1'), { teacherId: OTHER_TEACHER }))
    await assertSucceeds(updateDoc(doc(as(TEACHER), 'teacherNotes', 'n1'), { content: 'Rhythm is better' }))
    await assertSucceeds(deleteDoc(doc(as(TEACHER), 'teacherNotes', 'n1')))
  })

  it('a teacher must not move a lesson to another student or teacher', async () => {
    await assertFails(updateDoc(doc(as(TEACHER), 'lessonSlots', 'l1'), { studentId: CLARE }))
    await assertFails(updateDoc(doc(as(TEACHER), 'lessonSlots', 'l1'), { teacherId: OTHER_TEACHER }))
    await assertSucceeds(updateDoc(doc(as(TEACHER), 'lessonSlots', 'l1'), { startTime: '17:00' }))
    await assertSucceeds(deleteDoc(doc(as(TEACHER), 'lessonSlots', 'l1')))
  })
})

/* ── 13. the invitation system, under attack ──────────────────────── */
//
// The attacker is CLARE: a real, signed-in student with an account of her
// own, in another teacher's studio. Everything below is something she —
// or a passer-by with no account — might try against TEACHER's studio.

describe('the invitation system', () => {
  const TOKEN = 'chen_invite_token_aaa'
  const CODE = 'K7PQ2M'
  const week = () => Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const rid = (student: string, teacher: string) => `${student}_${teacher}`

  const liveInvite = (teacherId: string) => ({
    teacherId, teacherName: 'Dr Chen', studioName: 'Chen Music',
    createdAt: new Date().toISOString(), expiresAt: week(), status: 'open',
  })

  const body = (studentId: string, teacherId: string, token = TOKEN) => ({
    studentId, teacherId, studentName: 'Clare', inviteToken: token,
    createdAt: new Date().toISOString(), status: 'pending',
  })

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'studioInvites', TOKEN), liveInvite(TEACHER))
      await setDoc(doc(db, 'inviteCodes', CODE), { token: TOKEN, teacherId: TEACHER, expiresAt: week() })
    })
  })

  /* finding invitations you were never sent */

  it('invitations cannot be enumerated, with or without an account', async () => {
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'studioInvites')))
    await assertFails(getDocs(collection(as(CLARE), 'studioInvites')))
    await assertFails(getDocs(query(collection(as(CLARE), 'studioInvites'), where('status', '==', 'open'))))
  })

  it('codes cannot be enumerated either, which is what keeps six characters viable', async () => {
    await assertFails(getDocs(collection(as(CLARE), 'inviteCodes')))
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'inviteCodes', CODE)))
  })

  it('requests cannot be swept up across studios', async () => {
    await assertFails(getDocs(collection(as(CLARE), 'studioRequests')))
    await assertFails(getDocs(query(collection(as(CLARE), 'studioRequests'), where('teacherId', '==', TEACHER))))
  })

  it('somebody else’s request cannot be read by id', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'studioRequests', rid(ANA, TEACHER)), body(ANA, TEACHER))
    })
    await assertFails(getDoc(doc(as(CLARE), 'studioRequests', rid(ANA, TEACHER))))
  })

  /* minting invitations you have no right to */

  it('a student cannot mint an invitation, for anyone', async () => {
    await assertFails(setDoc(doc(as(CLARE), 'studioInvites', 'forged_1'), liveInvite(CLARE)))
    await assertFails(setDoc(doc(as(CLARE), 'studioInvites', 'forged_2'), liveInvite(TEACHER)))
  })

  it('a teacher cannot mint one in another teacher’s name', async () => {
    await assertFails(setDoc(doc(as(OTHER_TEACHER), 'studioInvites', 'forged_3'), liveInvite(TEACHER)))
  })

  it('an invitation cannot be minted without a real expiry', async () => {
    const base = liveInvite(TEACHER)
    await assertFails(setDoc(doc(as(TEACHER), 'studioInvites', 'string_expiry'),
      { ...base, expiresAt: new Date().toISOString() }))
    await assertFails(setDoc(doc(as(TEACHER), 'studioInvites', 'past_expiry'),
      { ...base, expiresAt: Timestamp.fromMillis(Date.now() - 1000) }))
  })

  /* spending one twice */

  it('a spent invitation cannot be put back', async () => {
    await assertSucceeds(updateDoc(doc(as(CLARE), 'studioInvites', TOKEN), { status: 'claimed' }))
    await assertFails(updateDoc(doc(as(CLARE), 'studioInvites', TOKEN), { status: 'open' }))
    await assertFails(updateDoc(doc(as(TEACHER), 'studioInvites', TOKEN), { status: 'open' }))
  })

  it('an invitation cannot be deleted to cover tracks', async () => {
    await assertFails(deleteDoc(doc(as(TEACHER), 'studioInvites', TOKEN)))
    await assertFails(deleteDoc(doc(as(CLARE), 'studioInvites', TOKEN)))
  })

  it('somebody else’s invitation cannot be revoked out of spite', async () => {
    await assertFails(updateDoc(doc(as(OTHER_TEACHER), 'studioInvites', TOKEN), { status: 'revoked' }))
    await assertFails(updateDoc(doc(as(CLARE), 'studioInvites', TOKEN), { status: 'revoked' }))
  })

  it('an invitation cannot be re-pointed at a different studio', async () => {
    await assertFails(updateDoc(doc(as(TEACHER), 'studioInvites', TOKEN), { teacherId: OTHER_TEACHER }))
    await assertFails(updateDoc(doc(as(OTHER_TEACHER), 'studioInvites', TOKEN), { teacherId: OTHER_TEACHER }))
  })

  it('a code document is write-once — nobody re-points it at their own token', async () => {
    await assertFails(setDoc(doc(as(OTHER_TEACHER), 'inviteCodes', CODE), {
      token: 'attacker_token_xxxxx', teacherId: OTHER_TEACHER, expiresAt: week(),
    }))
    await assertFails(updateDoc(doc(as(TEACHER), 'inviteCodes', CODE), { token: 'elsewhere' }))
    await assertFails(deleteDoc(doc(as(TEACHER), 'inviteCodes', CODE)))
  })


  /*
   * A known gap, written down rather than left to be rediscovered.
   *
   * The create rule on inviteCodes pins `teacherId` to the caller but says
   * nothing about `token`, so a teacher can mint a code pointing at
   * somebody else's invitation. It is not worth closing: doing it needs
   * the victim's 22-character token already, and it yields the attacker
   * nothing — the request that follows names the *invitation's* teacher,
   * so the student lands in the victim's studio, which is where that
   * invitation was always going to send them.
   *
   * Closing it would mean checking the invitation exists when the code is
   * written, and the two are written in one batch — where rules see the
   * state from before the batch, so the invitation is not there yet. The
   * fix would cost atomicity to buy nothing.
   */
  it('a teacher can point a code at another teacher’s invitation — and gains nothing by it', async () => {
    await assertSucceeds(setDoc(doc(as(OTHER_TEACHER), 'inviteCodes', 'SNE4KY'), {
      token: TOKEN, teacherId: OTHER_TEACHER, expiresAt: week(),
    }))
    // The payoff would be a student in OTHER_TEACHER's studio. There is none:
    // the invitation still belongs to TEACHER, so a request naming
    // OTHER_TEACHER is refused outright.
    await assertFails(setDoc(doc(as(CLARE), 'studioRequests', rid(CLARE, OTHER_TEACHER)),
      body(CLARE, OTHER_TEACHER, TOKEN)))
  })

  /* forging the request itself */

  it('a request cannot be raised in another student’s name', async () => {
    await assertFails(setDoc(doc(as(CLARE), 'studioRequests', rid(ANA, TEACHER)), body(ANA, TEACHER)))
    await assertFails(setDoc(doc(as(CLARE), 'studioRequests', rid(CLARE, TEACHER)), body(ANA, TEACHER)))
  })

  it('a request id cannot be bent out of shape to dodge the check', async () => {
    for (const id of [CLARE, `${CLARE}_`, `_${TEACHER}`, `${CLARE}__${TEACHER}`, `${CLARE}_${TEACHER}_x`]) {
      await assertFails(setDoc(doc(as(CLARE), 'studioRequests', id), body(CLARE, TEACHER)))
    }
  })

  it('a request needs a real invitation, not just a teacher’s name', async () => {
    await assertFails(setDoc(doc(as(CLARE), 'studioRequests', rid(CLARE, TEACHER)),
      body(CLARE, TEACHER, 'invented_token_xxxxx')))
    await assertFails(setDoc(doc(as(CLARE), 'studioRequests', rid(CLARE, TEACHER)),
      { ...body(CLARE, TEACHER), inviteToken: '' }))
  })

  it('an invitation for one studio cannot buy a place in another', async () => {
    // CLARE holds TEACHER's token but names OTHER_TEACHER, hoping the rule
    // checks only that *some* invitation exists.
    await assertFails(setDoc(doc(as(CLARE), 'studioRequests', rid(CLARE, OTHER_TEACHER)),
      body(CLARE, OTHER_TEACHER, TOKEN)))
  })

  it('a student cannot answer their own request', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'studioRequests', rid(CLARE, TEACHER)), body(CLARE, TEACHER))
    })
    await assertFails(updateDoc(doc(as(CLARE), 'studioRequests', rid(CLARE, TEACHER)), {
      status: 'accepted', decidedAt: new Date().toISOString(),
    }))
  })

  it('an unrelated teacher cannot answer a request addressed elsewhere', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'studioRequests', rid(CLARE, TEACHER)), body(CLARE, TEACHER))
    })
    await assertFails(updateDoc(doc(as(OTHER_TEACHER), 'studioRequests', rid(CLARE, TEACHER)), {
      status: 'accepted', decidedAt: new Date().toISOString(),
    }))
  })

  /* the acceptance write — the only cross-account write in the whole app */

  it('a teacher cannot take on a student who never asked', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'loner'), { role: 'student', displayName: 'Lo' })
    })
    await assertFails(updateDoc(doc(as(TEACHER), 'users', 'loner'), {
      teacherId: TEACHER, studioName: 'Chen Music', updatedAt: '',
    }))
  })

  it('a teacher cannot poach a student out of another studio', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'studioRequests', rid(CLARE, TEACHER)), body(CLARE, TEACHER))
    })
    await assertFails(updateDoc(doc(as(TEACHER), 'users', CLARE), {
      teacherId: TEACHER, studioName: 'Chen Music', updatedAt: '',
    }))
  })

  it('accepting cannot smuggle any other field through', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'users', 'loner'), { role: 'student', displayName: 'Lo' })
      await setDoc(doc(db, 'studioRequests', rid('loner', TEACHER)), body('loner', TEACHER))
    })
    for (const extra of [
      { role: 'teacher' }, { displayName: 'Renamed' }, { email: 'x@y.z' },
      { weeklyGoalMinutes: 9999 }, { notificationsReadAt: '2030-01-01' },
    ]) {
      await assertFails(updateDoc(doc(as(TEACHER), 'users', 'loner'), {
        teacherId: TEACHER, updatedAt: '', ...extra,
      }))
    }
    await assertSucceeds(updateDoc(doc(as(TEACHER), 'users', 'loner'), {
      teacherId: TEACHER, studioName: 'Chen Music', updatedAt: '',
    }))
  })

  /* what asking actually buys you, which must be nothing */

  it('a pending request is not a key to the studio’s data', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'studioRequests', rid(CLARE, TEACHER)), body(CLARE, TEACHER))
    })
    await assertFails(getDoc(doc(as(CLARE), 'users', ANA)))
    await assertFails(getDoc(doc(as(CLARE), 'studioStats', ANA)))
    await assertFails(getDoc(doc(as(CLARE), 'practiceSummary', ANA)))
    await assertFails(getDoc(doc(as(CLARE), 'practiceSessions', 'ana-1')))
  })

  it('a declined request is not one either', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'studioRequests', rid(CLARE, TEACHER)),
        { ...body(CLARE, TEACHER), status: 'declined' })
    })
    await assertFails(getDoc(doc(as(CLARE), 'users', ANA)))
    await assertFails(getDoc(doc(as(CLARE), 'studioStats', ANA)))
  })
})

/* ── 12. the personal data a profile has grown ────────────────────── */
//
// The profile doc started as a name and an instrument. It now also holds
// an avatar URL, notification preferences, display preferences and a
// badge history. Every one of those is written by the owner through the
// same `allow update` clause, so each needs the same proof: mine to
// change, nobody else's — including the teacher who may read it.

describe('badges, pins and preferences', () => {
  it('a student may set their own pins and preferences', async () => {
    await assertSucceeds(updateDoc(doc(as(ANA), 'users', ANA), {
      pinnedBadges: ['first_session', 'week_warrior'],
      badgePinsTouched: true,
      badgeEarnedAt: { first_session: '2026-10-06T00:00:00.000Z' },
      theme: 'dark', accent: 'teal', fontScale: 1.1, reduceMotion: true,
      notify: { assignment: false },
    }))
  })

  it('another student must not pin badges on someone else’s profile', async () => {
    await assertFails(updateDoc(doc(as(BEN), 'users', ANA), { pinnedBadges: ['marathon'] }))
  })

  it('another student must not forge when a badge was earned', async () => {
    await assertFails(updateDoc(doc(as(BEN), 'users', ANA), {
      badgeEarnedAt: { marathon: '2020-01-01T00:00:00.000Z' },
    }))
  })

  it('a teacher must not rewrite their own student’s preferences', async () => {
    // The teacher may read this document. Reading is not writing: the only
    // update a teacher is ever allowed on a student is the detach.
    await assertFails(updateDoc(doc(as(TEACHER), 'users', ANA), { theme: 'dark' }))
    await assertFails(updateDoc(doc(as(TEACHER), 'users', ANA), { notify: { assignment: false } }))
  })

  it('a teacher must not point a student’s avatar at something else', async () => {
    // An avatar is a URL the app renders. Writing it is writing what every
    // viewer of that profile loads.
    await assertFails(updateDoc(doc(as(TEACHER), 'users', ANA), { avatar: 'https://evil.test/x.png' }))
  })

  it('a stranger must not point a student’s avatar at something else', async () => {
    await assertFails(updateDoc(doc(as(CLARE), 'users', ANA), { avatar: 'https://evil.test/x.png' }))
  })

  it('the teacher’s detach clause must not smuggle other fields through', async () => {
    // `hasOnly([teacherId, studioCode, updatedAt])` is what holds this shut.
    await assertFails(updateDoc(doc(as(TEACHER), 'users', ANA), {
      teacherId: null, theme: 'dark',
    }))
    await assertFails(updateDoc(doc(as(TEACHER), 'users', ANA), {
      teacherId: null, pinnedBadges: ['marathon'],
    }))
    await assertFails(updateDoc(doc(as(TEACHER), 'users', ANA), {
      teacherId: null, avatar: 'https://evil.test/x.png',
    }))
    // …while the detach it exists for still works.
    await assertSucceeds(updateDoc(doc(as(TEACHER), 'users', ANA), {
      teacherId: null, updatedAt: 'now',
    }))
  })

  it('a stranger must not read a student’s profile at all', async () => {
    await assertFails(getDoc(doc(as(CLARE), 'users', ANA)))
  })
})
