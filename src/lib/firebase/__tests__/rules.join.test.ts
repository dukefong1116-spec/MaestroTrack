import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest'
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  Timestamp, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  collection, query, where, writeBatch,
} from 'firebase/firestore'

/**
 * Joining a studio: invitation, request, acceptance.
 *
 * The flow has three documents and the interesting failures are all at
 * the seams between them — a request raised without an invitation, an
 * acceptance without a request, a teacher answering somebody else's
 * post. Each is its own case below.
 *
 * Requires the emulators: `npm run emulate`, then `npm run test:rules`.
 */

const PROJECT = 'demo-maestrotrack'
const TEACHER = 'teacher-1'
const OTHER_TEACHER = 'teacher-2'
const ANA = 'student-ana'
const BEN = 'student-ben'

const TOKEN = 'tok_ana_from_chen______'
const CODE = 'K7PQ2M'

let env: RulesTestEnvironment

const as = (uid: string) => env.authenticatedContext(uid).firestore()
const anon = () => env.unauthenticatedContext().firestore()
const reqId = (s: string, t: string) => `${s}_${t}`
const inDays = (n: number) => Timestamp.fromMillis(Date.now() + n * 24 * 60 * 60 * 1000)

/** The request body a student legitimately sends. */
function requestBody(studentId: string, teacherId: string, token = TOKEN) {
  return {
    studentId, teacherId,
    studentName: 'Ana Rivera',
    inviteToken: token,
    createdAt: new Date().toISOString(),
    status: 'pending',
  }
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
    await setDoc(doc(db, 'users', TEACHER), { role: 'teacher', displayName: 'Dr Chen', studioName: 'Chen Music' })
    await setDoc(doc(db, 'users', OTHER_TEACHER), { role: 'teacher', displayName: 'Mr Diaz', studioName: 'Diaz Strings' })
    await setDoc(doc(db, 'users', ANA), { role: 'student', displayName: 'Ana' })
    await setDoc(doc(db, 'users', BEN), { role: 'student', displayName: 'Ben', teacherId: OTHER_TEACHER })
    await setDoc(doc(db, 'studioInvites', TOKEN), {
      teacherId: TEACHER, teacherName: 'Dr Chen', studioName: 'Chen Music',
      createdAt: new Date().toISOString(), expiresAt: inDays(7), status: 'open',
    })
    await setDoc(doc(db, 'inviteCodes', CODE), { token: TOKEN, teacherId: TEACHER, expiresAt: inDays(7) })
  })
})

/* ── the invitation ──────────────────────────────────────────────── */

describe('studioInvites', () => {
  it('is readable by id without signing in — the invited person has no account yet', async () => {
    const snap = await assertSucceeds(getDoc(doc(anon(), 'studioInvites', TOKEN)))
    expect(snap.data()?.studioName).toBe('Chen Music')
  })

  it('cannot be enumerated, signed in or not', async () => {
    await assertFails(getDocs(collection(anon(), 'studioInvites')))
    await assertFails(getDocs(collection(as(ANA), 'studioInvites')))
  })

  it('is created by a teacher for themselves', async () => {
    await assertSucceeds(setDoc(doc(as(TEACHER), 'studioInvites', 'tok_new'), {
      teacherId: TEACHER, teacherName: 'Dr Chen', studioName: 'Chen Music',
      createdAt: new Date().toISOString(), expiresAt: inDays(7), status: 'open',
    }))
  })

  it('cannot be created by a student, nor in another teacher’s name', async () => {
    const body = {
      teacherName: 'x', studioName: 'x', createdAt: new Date().toISOString(),
      expiresAt: inDays(7), status: 'open',
    }
    await assertFails(setDoc(doc(as(ANA), 'studioInvites', 'tok_a'), { ...body, teacherId: ANA }))
    await assertFails(setDoc(doc(as(TEACHER), 'studioInvites', 'tok_b'), { ...body, teacherId: OTHER_TEACHER }))
  })

  it('cannot be minted to outlive a fortnight', async () => {
    await assertFails(setDoc(doc(as(TEACHER), 'studioInvites', 'tok_forever'), {
      teacherId: TEACHER, teacherName: 'Dr Chen', studioName: 'Chen Music',
      createdAt: new Date().toISOString(), expiresAt: inDays(365), status: 'open',
    }))
  })

  it('is revoked by its own teacher and nobody else', async () => {
    await assertFails(updateDoc(doc(as(OTHER_TEACHER), 'studioInvites', TOKEN), { status: 'revoked' }))
    await assertSucceeds(updateDoc(doc(as(TEACHER), 'studioInvites', TOKEN), { status: 'revoked' }))
  })

  it('cannot be reopened once spent', async () => {
    await assertSucceeds(updateDoc(doc(as(ANA), 'studioInvites', TOKEN), { status: 'claimed' }))
    await assertFails(updateDoc(doc(as(TEACHER), 'studioInvites', TOKEN), { status: 'open' }))
  })
})

describe('inviteCodes', () => {
  it('resolves for a signed-in reader, but not anonymously', async () => {
    await assertFails(getDoc(doc(anon(), 'inviteCodes', CODE)))
    const snap = await assertSucceeds(getDoc(doc(as(ANA), 'inviteCodes', CODE)))
    expect(snap.data()?.token).toBe(TOKEN)
  })

  it('cannot be listed', async () => {
    await assertFails(getDocs(collection(as(ANA), 'inviteCodes')))
  })

  it('is immutable once written', async () => {
    await assertFails(updateDoc(doc(as(TEACHER), 'inviteCodes', CODE), { token: 'elsewhere' }))
    await assertFails(deleteDoc(doc(as(TEACHER), 'inviteCodes', CODE)))
  })
})

/* ── the request ─────────────────────────────────────────────────── */

describe('studioRequests — raising one', () => {
  it('succeeds when a live invitation is spent, both writes in one batch', async () => {
    const db = as(ANA)
    const batch = writeBatch(db)
    batch.set(doc(db, 'studioRequests', reqId(ANA, TEACHER)), requestBody(ANA, TEACHER))
    batch.update(doc(db, 'studioInvites', TOKEN), { status: 'claimed' })
    await assertSucceeds(batch.commit())
  })

  it('fails without an invitation at all', async () => {
    await assertFails(setDoc(
      doc(as(ANA), 'studioRequests', reqId(ANA, TEACHER)),
      requestBody(ANA, TEACHER, 'tok_does_not_exist')
    ))
  })

  it('fails on an invitation that is claimed, revoked or expired', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      const base = {
        teacherId: TEACHER, teacherName: 'Dr Chen', studioName: 'Chen Music',
        createdAt: new Date().toISOString(),
      }
      await setDoc(doc(db, 'studioInvites', 'tok_claimed'), { ...base, expiresAt: inDays(7), status: 'claimed' })
      await setDoc(doc(db, 'studioInvites', 'tok_revoked'), { ...base, expiresAt: inDays(7), status: 'revoked' })
      await setDoc(doc(db, 'studioInvites', 'tok_expired'), { ...base, expiresAt: inDays(-1), status: 'open' })
    })
    for (const token of ['tok_claimed', 'tok_revoked', 'tok_expired']) {
      await assertFails(setDoc(
        doc(as(ANA), 'studioRequests', reqId(ANA, TEACHER)),
        requestBody(ANA, TEACHER, token)
      ))
    }
  })

  it('fails when the invitation belongs to a different teacher than the one named', async () => {
    await assertFails(setDoc(
      doc(as(ANA), 'studioRequests', reqId(ANA, OTHER_TEACHER)),
      requestBody(ANA, OTHER_TEACHER)
    ))
  })

  it('cannot be raised on another student’s behalf, however the id is spelt', async () => {
    // Ana signing, Ben's name on it.
    await assertFails(setDoc(
      doc(as(ANA), 'studioRequests', reqId(BEN, TEACHER)),
      requestBody(BEN, TEACHER)
    ))
    // Ana's id, Ben's studentId field.
    await assertFails(setDoc(
      doc(as(ANA), 'studioRequests', reqId(ANA, TEACHER)),
      { ...requestBody(ANA, TEACHER), studentId: BEN }
    ))
  })

  it('cannot arrive pre-accepted', async () => {
    await assertFails(setDoc(
      doc(as(ANA), 'studioRequests', reqId(ANA, TEACHER)),
      { ...requestBody(ANA, TEACHER), status: 'accepted' }
    ))
  })
})

describe('asking again', () => {
  /**
   * The request id is `${studentId}_${teacherId}`, so there is only ever
   * one document per pair. That is what lets the accept rule find it
   * without a query — and it means a second ask has to be able to write
   * over a settled first one, or a student gets exactly one attempt at a
   * given teacher for the lifetime of the account.
   *
   * Found by using the app: join, teacher removes you, new link, and the
   * second ask was refused.
   */
  async function settled(status: string) {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'studioRequests', reqId(ANA, TEACHER)), {
        ...requestBody(ANA, TEACHER), status, decidedAt: new Date().toISOString(),
      })
      // A second invitation, as a teacher would send after removing someone.
      await setDoc(doc(db, 'studioInvites', 'tok_second_invite__'), {
        teacherId: TEACHER, teacherName: 'Dr Chen', studioName: 'Chen Music',
        createdAt: new Date().toISOString(), expiresAt: inDays(7), status: 'open',
      })
    })
  }

  it('a student removed from a studio can ask again with a new invitation', async () => {
    await settled('accepted')
    await env.withSecurityRulesDisabled(async (ctx) => {
      // The teacher let them go, so they are in no studio.
      await setDoc(doc(ctx.firestore(), 'users', ANA), { role: 'student', displayName: 'Ana' })
    })
    const db = as(ANA)
    const batch = writeBatch(db)
    batch.set(doc(db, 'studioRequests', reqId(ANA, TEACHER)),
      requestBody(ANA, TEACHER, 'tok_second_invite__'))
    batch.update(doc(db, 'studioInvites', 'tok_second_invite__'), { status: 'claimed' })
    await assertSucceeds(batch.commit())
  })

  it('a student who was declined can ask again with a new invitation', async () => {
    await settled('declined')
    const db = as(ANA)
    const batch = writeBatch(db)
    batch.set(doc(db, 'studioRequests', reqId(ANA, TEACHER)),
      requestBody(ANA, TEACHER, 'tok_second_invite__'))
    batch.update(doc(db, 'studioInvites', 'tok_second_invite__'), { status: 'claimed' })
    await assertSucceeds(batch.commit())
  })

  it('but cannot overwrite a request the teacher has not answered yet', async () => {
    // Nothing is gained by it and it would let a student swap the invitation
    // under a teacher who is looking at the row.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'studioInvites', 'tok_second_invite__'), {
        teacherId: TEACHER, teacherName: 'Dr Chen', studioName: 'Chen Music',
        createdAt: new Date().toISOString(), expiresAt: inDays(7), status: 'open',
      })
      await setDoc(doc(ctx.firestore(), 'studioRequests', reqId(ANA, TEACHER)),
        requestBody(ANA, TEACHER))
    })
    await assertFails(setDoc(doc(as(ANA), 'studioRequests', reqId(ANA, TEACHER)),
      requestBody(ANA, TEACHER, 'tok_second_invite__')))
  })

  it('cannot be re-raised by somebody still in a studio', async () => {
    await settled('accepted')
    // ANA is left attached to TEACHER — the accept clause would refuse the
    // new row anyway, so it should never reach the teacher's list.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ANA), {
        role: 'student', displayName: 'Ana', teacherId: TEACHER,
      })
    })
    await assertFails(setDoc(doc(as(ANA), 'studioRequests', reqId(ANA, TEACHER)),
      requestBody(ANA, TEACHER, 'tok_second_invite__')))
  })

  it('still cannot be rewritten by anybody else', async () => {
    await settled('declined')
    await assertFails(setDoc(doc(as(BEN), 'studioRequests', reqId(ANA, TEACHER)),
      requestBody(ANA, TEACHER, 'tok_second_invite__')))
  })
})

describe('studioRequests — reading and withdrawing', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'studioRequests', reqId(ANA, TEACHER)), requestBody(ANA, TEACHER))
    })
  })

  it('is listed by the teacher it is addressed to', async () => {
    const q = query(collection(as(TEACHER), 'studioRequests'), where('teacherId', '==', TEACHER))
    const snap = await assertSucceeds(getDocs(q))
    expect(snap.size).toBe(1)
  })

  it('is not listed by an unrelated teacher', async () => {
    const q = query(collection(as(OTHER_TEACHER), 'studioRequests'), where('teacherId', '==', TEACHER))
    await assertFails(getDocs(q))
  })

  it('is withdrawn by its author and nobody else', async () => {
    await assertFails(deleteDoc(doc(as(BEN), 'studioRequests', reqId(ANA, TEACHER))))
    await assertFails(deleteDoc(doc(as(TEACHER), 'studioRequests', reqId(ANA, TEACHER))))
    await assertSucceeds(deleteDoc(doc(as(ANA), 'studioRequests', reqId(ANA, TEACHER))))
  })
})

/* ── the acceptance ──────────────────────────────────────────────── */

describe('accepting', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'studioRequests', reqId(ANA, TEACHER)), requestBody(ANA, TEACHER))
    })
  })

  it('lets the teacher take the student on — profile and request in one batch', async () => {
    const db = as(TEACHER)
    const batch = writeBatch(db)
    batch.update(doc(db, 'users', ANA), {
      teacherId: TEACHER, studioName: 'Chen Music', updatedAt: new Date().toISOString(),
    })
    batch.update(doc(db, 'studioRequests', reqId(ANA, TEACHER)), {
      status: 'accepted', decidedAt: new Date().toISOString(),
    })
    await assertSucceeds(batch.commit())
  })

  it('refuses a teacher with no request from that student', async () => {
    await assertFails(updateDoc(doc(as(OTHER_TEACHER), 'users', ANA), {
      teacherId: OTHER_TEACHER, studioName: 'Diaz Strings', updatedAt: new Date().toISOString(),
    }))
  })

  it('refuses to poach a student who is already in a studio', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'studioRequests', reqId(BEN, TEACHER)), requestBody(BEN, TEACHER))
    })
    // Ben belongs to OTHER_TEACHER, and a pending request does not override that.
    await assertFails(updateDoc(doc(as(TEACHER), 'users', BEN), {
      teacherId: TEACHER, studioName: 'Chen Music', updatedAt: new Date().toISOString(),
    }))
  })

  it('refuses to hand the student to somebody else', async () => {
    await assertFails(updateDoc(doc(as(TEACHER), 'users', ANA), {
      teacherId: OTHER_TEACHER, studioName: 'Chen Music', updatedAt: new Date().toISOString(),
    }))
  })

  it('refuses to carry any other field along with it', async () => {
    await assertFails(updateDoc(doc(as(TEACHER), 'users', ANA), {
      teacherId: TEACHER, displayName: 'Renamed', updatedAt: new Date().toISOString(),
    }))
    await assertFails(updateDoc(doc(as(TEACHER), 'users', ANA), {
      teacherId: TEACHER, role: 'teacher', updatedAt: new Date().toISOString(),
    }))
  })

  it('is not answerable by the student themselves', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'studioRequests', reqId(ANA, TEACHER)), {
      status: 'accepted', decidedAt: new Date().toISOString(),
    }))
  })

  it('is not answerable twice', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'studioRequests', reqId(ANA, TEACHER)), { status: 'declined' })
    })
    await assertFails(updateDoc(doc(as(TEACHER), 'studioRequests', reqId(ANA, TEACHER)), {
      status: 'accepted', decidedAt: new Date().toISOString(),
    }))
  })
})

/* ── what the student may no longer do ───────────────────────────── */

describe('a student can no longer walk in', () => {
  it('cannot set teacherId on their own profile, invitation or not', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'users', ANA), { teacherId: TEACHER }))
    await assertFails(updateDoc(doc(as(ANA), 'users', ANA), {
      teacherId: TEACHER, studioCode: TOKEN,
    }))
  })

  it('cannot set teacherId even holding a live invitation and a pending request', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'studioRequests', reqId(ANA, TEACHER)), requestBody(ANA, TEACHER))
    })
    await assertFails(updateDoc(doc(as(ANA), 'users', ANA), { teacherId: TEACHER }))
  })

  it('cannot sign up already attached to a studio', async () => {
    const fresh = 'student-new'
    await assertFails(setDoc(doc(as(fresh), 'users', fresh), {
      role: 'student', displayName: 'New', teacherId: TEACHER,
    }))
    await assertSucceeds(setDoc(doc(as(fresh), 'users', fresh), {
      role: 'student', displayName: 'New',
    }))
  })

  it('can still edit the parts of their profile that are theirs', async () => {
    await assertSucceeds(updateDoc(doc(as(ANA), 'users', ANA), { displayName: 'Ana Rivera' }))
    await assertSucceeds(updateDoc(doc(as(BEN), 'users', BEN), { weeklyGoalMinutes: 240 }))
  })
})

/* ── leaving ─────────────────────────────────────────────────────── */

describe('leaving a studio', () => {
  it('is the teacher’s to do, still', async () => {
    await assertSucceeds(updateDoc(doc(as(OTHER_TEACHER), 'users', BEN), { teacherId: null }))
  })

  it('is not the student’s, still', async () => {
    await assertFails(updateDoc(doc(as(BEN), 'users', BEN), { teacherId: null }))
  })
})
