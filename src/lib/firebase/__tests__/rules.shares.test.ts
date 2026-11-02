import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest'
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where,
} from 'firebase/firestore'

/**
 * Share links are the one thing in this app a stranger is meant to read.
 *
 * That makes the rules around them the opposite shape to everything else:
 * `get` is open on purpose, and the work is in making sure that openness
 * does not become "and therefore everything is readable".
 *
 * Each assertion states what must be true for a published link to be safe.
 * A failure here is a hole, not a broken test.
 */

const PROJECT = 'demo-maestrotrack'
const ANA = 'student-ana'
const BEN = 'student-ben'
const TEACHER = 'teacher-1'

const SLUG = 'aaaaaaaaaaaaaaaaaaaaaa'
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbb'

const FIELDS = { minutes: 75, dateLabel: 'Sunday, 2 November', name: 'Ana', streakDays: 9 }
const SHARE = { ownerId: ANA, kind: 'session', fields: FIELDS, createdAt: '2026-11-02T10:00:00.000Z' }

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
    await setDoc(doc(db, 'users', ANA), { role: 'student', displayName: 'Ana' })
    await setDoc(doc(db, 'users', BEN), { role: 'student', displayName: 'Ben' })
    await setDoc(doc(db, 'shares', SLUG), SHARE)
    await setDoc(doc(db, 'shares', OTHER), { ...SHARE, ownerId: BEN })
  })
})

const as = (uid: string) => env.authenticatedContext(uid).firestore()
const anon = () => env.unauthenticatedContext().firestore()

/* ── 1. a link has to work for a stranger, or it is not a link ────── */

describe('reading a published share', () => {
  it('a signed-out stranger CAN fetch a slug they were given', async () => {
    // This is the whole feature: the crawler that draws the preview is
    // nobody, signed in as nobody.
    await assertSucceeds(getDoc(doc(anon(), 'shares', SLUG)))
  })

  it('so can a signed-in person who does not own it', async () => {
    await assertSucceeds(getDoc(doc(as(BEN), 'shares', SLUG)))
  })
})

/* ── 2. …without the collection becoming a directory of everyone ─── */

describe('enumerating shares', () => {
  it('a stranger must not list the collection', async () => {
    await assertFails(getDocs(collection(anon(), 'shares')))
  })

  it('a signed-in user must not list the collection', async () => {
    await assertFails(getDocs(collection(as(BEN), 'shares')))
  })

  it('…nor list someone else’s by filtering for them', async () => {
    await assertFails(getDocs(query(collection(as(BEN), 'shares'), where('ownerId', '==', ANA))))
  })

  it('but CAN list their own — the Shared links screen must work', async () => {
    await assertSucceeds(getDocs(query(collection(as(ANA), 'shares'), where('ownerId', '==', ANA))))
  })
})

/* ── 3. publishing ────────────────────────────────────────────────── */

describe('publishing a share', () => {
  it('a student may publish their own', async () => {
    await assertSucceeds(setDoc(doc(as(ANA), 'shares', 'cccccccccccccccccccccc'), SHARE))
  })

  it('must not publish one owned by someone else', async () => {
    await assertFails(setDoc(doc(as(BEN), 'shares', 'dddddddddddddddddddddd'), SHARE))
  })

  it('a signed-out stranger must not publish at all', async () => {
    await assertFails(setDoc(doc(anon(), 'shares', 'eeeeeeeeeeeeeeeeeeeeee'), SHARE))
  })

  it('must not carry a field the allowlist does not name', async () => {
    // The point of the whole ShareFields discipline: a session's notes are
    // where someone writes that a piece is awful and they hate it.
    await assertFails(setDoc(doc(as(ANA), 'shares', 'ffffffffffffffffffffff'), {
      ...SHARE,
      fields: { ...FIELDS, notes: 'this is awful and I hate it' },
    }))
  })

  it('must not carry a studio code', async () => {
    await assertFails(setDoc(doc(as(ANA), 'shares', 'gggggggggggggggggggggg'), {
      ...SHARE,
      fields: { ...FIELDS, studioCode: 'CHEN01' },
    }))
  })

  it('must not smuggle extra keys onto the document itself', async () => {
    await assertFails(setDoc(doc(as(ANA), 'shares', 'hhhhhhhhhhhhhhhhhhhhhh'), {
      ...SHARE,
      teacherId: TEACHER,
    }))
  })

  it('must name a kind the app knows', async () => {
    await assertFails(setDoc(doc(as(ANA), 'shares', 'iiiiiiiiiiiiiiiiiiiiii'), {
      ...SHARE, kind: 'everything',
    }))
  })

  it('must not publish a name long enough to be a paragraph', async () => {
    await assertFails(setDoc(doc(as(ANA), 'shares', 'jjjjjjjjjjjjjjjjjjjjjj'), {
      ...SHARE, fields: { ...FIELDS, name: 'x'.repeat(81) },
    }))
  })
})

/* ── 4. a published share never changes underneath its preview ────── */

describe('editing a published share', () => {
  it('not even the owner may edit one', async () => {
    // Otherwise someone sends an innocuous link, swaps its contents, and
    // every platform that cached the preview still shows the old one.
    await assertFails(updateDoc(doc(as(ANA), 'shares', SLUG), { kind: 'badge' }))
  })

  it('a stranger certainly may not', async () => {
    await assertFails(updateDoc(doc(as(BEN), 'shares', SLUG), { fields: FIELDS }))
  })

  it('a re-publish over an existing slug is an edit, and is refused', async () => {
    await assertFails(setDoc(doc(as(ANA), 'shares', SLUG), { ...SHARE, kind: 'week' }))
  })
})

/* ── 5. unpublishing ──────────────────────────────────────────────── */

describe('deleting a share', () => {
  it('the owner can unpublish their own', async () => {
    await assertSucceeds(deleteDoc(doc(as(ANA), 'shares', SLUG)))
  })

  it('nobody else can unpublish it', async () => {
    await assertFails(deleteDoc(doc(as(BEN), 'shares', SLUG)))
    await assertFails(deleteDoc(doc(anon(), 'shares', SLUG)))
  })

  it('a teacher cannot unpublish their student’s', async () => {
    await assertFails(deleteDoc(doc(as(TEACHER), 'shares', SLUG)))
  })
})
