import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest'
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, addDoc, collection } from 'firebase/firestore'

/**
 * Weekly leagues: the rules that keep every league write in the server's
 * hands. A failure here is a way for a student to promote themselves or
 * read a room they are not in — a hole, not a broken test.
 */

const PROJECT = 'demo-maestrotrack'
const ANA = 'student-ana'
const BEN = 'student-ben'
const EVE = 'student-eve'
const ROOM = 'room-1'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
  })
})
afterAll(async () => { await env?.cleanup() })

const member = (name: string, xp: number) => ({ name, colour: 1, xp, xpAt: '2026-11-10T10:00:00.000Z', joinedAt: '2026-11-10T10:00:00.000Z' })

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', ANA), { uid: ANA, role: 'student', displayName: 'Ana', league: { tier: 2, roomId: ROOM, week: '2026-W46' } })
    await setDoc(doc(db, 'users', EVE), { uid: EVE, role: 'student', displayName: 'Eve' })
    await setDoc(doc(db, 'leagueRooms', ROOM), {
      week: '2026-W46', weekStart: '2026-11-09', tier: 2, band: 0, endsAt: 0, status: 'open',
      members: { [ANA]: member('Ana', 40), [BEN]: member('Ben', 30) },
    })
    await setDoc(doc(db, 'leagueIndex', '2026-W46_2_0'), { roomId: ROOM, count: 2 })
    await setDoc(doc(db, 'practiceSessions', 'timed'), {
      userId: ANA, date: '2026-11-10', durationMinutes: 30, source: 'timer', timedMinutes: 30, ticket: '1.sig',
    })
    await setDoc(doc(db, 'practiceSessions', 'typed'), { userId: ANA, date: '2026-11-10', durationMinutes: 30 })
  })
})

const as = (uid: string) => env.authenticatedContext(uid).firestore()

describe('league rooms', () => {
  it('a player CAN read their own room', async () => {
    await assertSucceeds(getDoc(doc(as(ANA), 'leagueRooms', ROOM)))
  })
  it('someone not in the room CANNOT read it', async () => {
    await assertFails(getDoc(doc(as(EVE), 'leagueRooms', ROOM)))
  })
  it('nobody signed out can read it', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'leagueRooms', ROOM)))
  })
  it('a player CANNOT change their own XP', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'leagueRooms', ROOM), { [`members.${ANA}.xp`]: 9999 }))
  })
  it('nobody can add themselves to a room', async () => {
    await assertFails(updateDoc(doc(as(EVE), 'leagueRooms', ROOM), { [`members.${EVE}`]: member('Eve', 1) }))
  })
  it('nobody can create a room', async () => {
    await assertFails(setDoc(doc(as(EVE), 'leagueRooms', 'mine'), { members: { [EVE]: member('Eve', 999) } }))
  })
  it("the server's room index is closed to everyone", async () => {
    await assertFails(getDoc(doc(as(ANA), 'leagueIndex', '2026-W46_2_0')))
    await assertFails(setDoc(doc(as(ANA), 'leagueIndex', 'x'), { roomId: 'x' }))
  })
})

describe('your league fields', () => {
  it('a player CANNOT promote themselves', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'users', ANA), { 'league.tier': 4 }))
  })
  it('a player CANNOT write themselves a result', async () => {
    await assertFails(updateDoc(doc(as(EVE), 'users', EVE), { league: { tier: 4 } }))
  })
  it('a new account CANNOT arrive with a tier', async () => {
    await assertFails(setDoc(doc(as(BEN), 'users', BEN), { uid: BEN, role: 'student', league: { tier: 4 } }))
  })
  it('a new account without one is fine', async () => {
    await assertSucceeds(setDoc(doc(as(BEN), 'users', BEN), { uid: BEN, role: 'student' }))
  })
  it('a player CAN mark a result seen and opt out', async () => {
    await assertSucceeds(updateDoc(doc(as(ANA), 'users', ANA), { leagueSeen: '2026-W46', leagueOptOut: true }))
  })
  it('other profile changes still work for someone in a league', async () => {
    await assertSucceeds(setDoc(doc(as(ANA), 'users', ANA), { displayName: 'Ana B.' }, { merge: true }))
  })
})

describe('timer fields on sessions', () => {
  const base = { userId: ANA, date: '2026-11-10', durationMinutes: 20 }
  it('a timer session CAN be saved', async () => {
    await assertSucceeds(addDoc(collection(as(ANA), 'practiceSessions'), { ...base, source: 'timer', timedMinutes: 20, ticket: '123.abc' }))
  })
  it('a typed-in session without them CAN be saved', async () => {
    await assertSucceeds(addDoc(collection(as(ANA), 'practiceSessions'), base))
  })
  it('a made-up source CANNOT be saved', async () => {
    await assertFails(addDoc(collection(as(ANA), 'practiceSessions'), { ...base, source: 'manual-but-counts' }))
  })
  it('timed minutes must be a number', async () => {
    await assertFails(addDoc(collection(as(ANA), 'practiceSessions'), { ...base, source: 'timer', timedMinutes: '999' }))
  })
  it('a typed-in session CANNOT be turned into a timed one', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'practiceSessions', 'typed'), { source: 'timer', timedMinutes: 30, ticket: '1.sig' }))
  })
  it("a timer session's measured minutes CANNOT be stretched", async () => {
    await assertFails(updateDoc(doc(as(ANA), 'practiceSessions', 'timed'), { timedMinutes: 120 }))
  })
  it('its ticket CANNOT be swapped', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'practiceSessions', 'timed'), { ticket: '2.other' }))
  })
  it('anything else on a timer session CAN still be edited', async () => {
    await assertSucceeds(updateDoc(doc(as(ANA), 'practiceSessions', 'timed'), { notes: 'Better today' }))
  })
})
