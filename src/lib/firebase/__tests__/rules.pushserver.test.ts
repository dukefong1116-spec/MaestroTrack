// @ts-nocheck — exercises the plain-JavaScript server code in api/, which
// carries no type declarations; the assertions are what matter here.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

/**
 * The push server (api/push/*, api/_lib/push.js), run for real against the
 * emulators. No Apple or Web Push keys exist here, so nothing leaves the
 * machine: what is checked is every decision before sending — who may
 * trigger what, the cap, repeats, switches, and the device registry.
 *
 * Its own emulator project, so clearing it never touches the app's demo data.
 */

const PROJECT = 'demo-push-test'
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085'
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
process.env.GCLOUD_PROJECT = PROJECT

let admin, push, register, unregister, event, league, ticket, rules
let store

beforeAll(async () => {
  admin = await import('../../../../api/_lib/admin.js')
  push = await import('../../../../api/_lib/push.js')
  register = (await import('../../../../api/push/register.js')).default
  unregister = (await import('../../../../api/push/unregister.js')).default
  event = (await import('../../../../api/push/event.js')).default
  league = await import('../../../../api/_lib/league.js')
  ticket = await import('../../../../api/_lib/ticket.js')
  rules = await import('../../league/rules')
  store = admin.db()
})

beforeEach(async () => {
  await fetch(`http://127.0.0.1:8085/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' })
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' })
  // The accounts every test acts as (sign-in checks they exist).
  for (const uid of ['teacher', 'ana', 'ben', 'stranger']) {
    await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
      body: JSON.stringify({ localId: uid, email: `${uid}@push.test` }),
    })
  }
})

/** An emulator sign-in token for `uid` (the Admin SDK takes these unsigned under the emulator). */
function idToken(uid: string) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  return `${b({ alg: 'none', typ: 'JWT' })}.${b({ iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, sub: uid, user_id: uid, iat: now, exp: now + 3600, auth_time: now })}.`
}

/** Call an endpoint as `uid`; resolves to { status, body }. */
async function call(fn, uid, body) {
  let out
  const res = { headers: {}, statusCode: 0, setHeader(k, v) { this.headers[k] = v }, end(s) { out = { status: this.statusCode, body: JSON.parse(s) } } }
  await fn({ method: 'POST', headers: { authorization: `Bearer ${idToken(uid)}` }, body }, res)
  return out
}

const TOKEN = 'a'.repeat(64)
const now = () => new Date().toISOString()

async function people() {
  await store.doc('users/teacher').set({ uid: 'teacher', role: 'teacher', displayName: 'Dr Chen', studioName: 'Chen Music' })
  await store.doc('users/ana').set({ uid: 'ana', role: 'student', displayName: 'Ana Ruiz', teacherId: 'teacher' })
  await store.doc('users/ben').set({ uid: 'ben', role: 'student', displayName: 'Ben', teacherId: 'teacher' })
}
async function device(uid: string, deviceId = `dev-${uid}-0001`, token = TOKEN) {
  return call(register, uid, { deviceId, platform: 'ios', token, env: 'sandbox', tzOffset: 0 })
}
async function assignment(id: string, extra = {}) {
  await store.doc(`assignments/${id}`).set({ teacherId: 'teacher', studentId: 'ana', title: 'Scales', status: 'active', createdAt: now(), ...extra })
}
const state = async (uid: string) => (await store.doc(`pushState/${uid}`).get()).data()

describe('the device registry', () => {
  it('registers a device, and checks what it is given', async () => {
    await people()
    expect((await device('ana')).status).toBe(200)
    expect((await store.doc('pushDevices/dev-ana-0001').get()).data()).toMatchObject({ uid: 'ana', platform: 'ios', token: TOKEN })
    expect((await call(register, 'ana', { deviceId: 'x', platform: 'ios', token: TOKEN })).status).toBe(400)
    expect((await call(register, 'ana', { deviceId: 'dev-ana-0002', platform: 'android', token: TOKEN })).status).toBe(400)
    expect((await call(register, 'ana', { deviceId: 'dev-ana-0002', platform: 'ios', token: 'not hex' })).status).toBe(400)
    expect((await call(register, 'ana', { deviceId: 'dev-ana-0002', platform: 'web', token: '{"endpoint":"http://evil"}' })).status).toBe(400)
    expect((await call(register, 'ana', { deviceId: 'dev-ana-0002', platform: 'web', token: JSON.stringify({ endpoint: 'https://attacker.example/collect', keys: { p256dh: 'x', auth: 'y' } }) })).status).toBe(400)
    expect((await call(register, 'ana', { deviceId: 'dev-ana-0002', platform: 'web', token: JSON.stringify({ endpoint: 'https://fcm.googleapis.com/fcm/send/test', keys: { p256dh: 'x', auth: 'y' } }) })).status).toBe(200)
  })

  it('a phone that changes hands stops getting the last person’s pushes', async () => {
    await people()
    await device('ana', 'dev-ana-0001')
    await device('ben', 'dev-ben-0001') // same token: the same phone, now Ben's
    expect((await store.doc('pushDevices/dev-ana-0001').get()).exists).toBe(false)
    expect((await store.doc('pushDevices/dev-ben-0001').get()).data().uid).toBe('ben')
  })

  it('a different account cannot claim a device ID with a different push token', async () => {
    await people()
    await device('ana', 'device-known-to-attacker', TOKEN)
    const hijack = await device('ben', 'device-known-to-attacker', 'b'.repeat(64))
    expect(hijack.status).toBe(409)
    expect((await store.doc('pushDevices/device-known-to-attacker').get()).data()).toMatchObject({ uid: 'ana', token: TOKEN })
  })

  it('only the owner can unregister a device', async () => {
    await people()
    await device('ana')
    await call(unregister, 'ben', { deviceId: 'dev-ana-0001' })
    expect((await store.doc('pushDevices/dev-ana-0001').get()).exists).toBe(true)
    await call(unregister, 'ana', { deviceId: 'dev-ana-0001' })
    expect((await store.doc('pushDevices/dev-ana-0001').get()).exists).toBe(false)
  })
})

describe('events: only the person who did it, about something real and new', () => {
  it('a teacher’s new assignment reaches the student, once', async () => {
    await people()
    await device('ana')
    await assignment('a1')
    expect((await call(event, 'teacher', { type: 'assignment-new', id: 'a1' })).body.sent).toBe(true)
    expect((await call(event, 'teacher', { type: 'assignment-new', id: 'a1' })).body.sent).toBe(false)
    expect((await state('ana')).count).toBe(1)
  })

  it('no one else can trigger it, and an old one is not news', async () => {
    await people()
    await device('ana')
    await assignment('a1')
    expect((await call(event, 'ben', { type: 'assignment-new', id: 'a1' })).body.sent).toBe(false)
    await assignment('old', { createdAt: new Date(Date.now() - 3_600_000).toISOString() })
    expect((await call(event, 'teacher', { type: 'assignment-new', id: 'old' })).body.sent).toBe(false)
  })

  it('unknown events and malformed ids are refused', async () => {
    await people()
    expect((await call(event, 'teacher', { type: 'anything', id: 'a1' })).status).toBe(400)
    expect((await call(event, 'teacher', { type: 'assignment-new', id: '../users/ana' })).status).toBe(400)
    expect((await call(event, 'teacher', { type: 'constructor', id: 'a1' })).status).toBe(400)
  })

  it('a message goes to the other side of the conversation only', async () => {
    await people()
    await device('teacher', 'dev-teacher-01', 'b'.repeat(64))
    await device('ana')
    await store.doc('messages/m1').set({ teacherId: 'teacher', studentId: 'ana', from: 'student', text: 'Hi!', createdAt: now() })
    expect((await call(event, 'ben', { type: 'message', id: 'm1' })).body.sent).toBe(false)
    expect((await call(event, 'ana', { type: 'message', id: 'm1' })).body.sent).toBe(true)
    expect(await state('teacher')).toBeTruthy()
  })

  it('a piece from the teacher: only their own student’s, only a teacher-added one', async () => {
    await people()
    await device('ana')
    await store.doc('users/stranger').set({ uid: 'stranger', role: 'teacher', displayName: 'Mr X' })
    await store.doc('pieces/p1').set({ userId: 'ana', title: 'Minuet', addedBy: 'teacher', startedAt: now() })
    expect((await call(event, 'stranger', { type: 'piece-from-teacher', id: 'p1' })).body.sent).toBe(false)
    expect((await call(event, 'teacher', { type: 'piece-from-teacher', id: 'p1' })).body.sent).toBe(true)
  })
})

describe('the person’s own limits', () => {
  it('at most three a day, but messages still get through', async () => {
    await people()
    await device('ana')
    for (const id of ['a1', 'a2', 'a3', 'a4']) await assignment(id)
    const sent = []
    for (const id of ['a1', 'a2', 'a3', 'a4']) sent.push((await call(event, 'teacher', { type: 'assignment-new', id })).body.sent)
    expect(sent).toEqual([true, true, true, false])
    await store.doc('messages/m1').set({ teacherId: 'teacher', studentId: 'ana', from: 'teacher', text: 'Well done', createdAt: now() })
    expect((await call(event, 'teacher', { type: 'message', id: 'm1' })).body.sent).toBe(true)
  })

  it('a switched-off kind is not sent', async () => {
    await people()
    await store.doc('users/ana').set({ notify: { assignments: false } }, { merge: true })
    await device('ana')
    await assignment('a1')
    expect((await call(event, 'teacher', { type: 'assignment-new', id: 'a1' })).body.sent).toBe(false)
  })

  it('no device, nothing to do', async () => {
    await people()
    await assignment('a1')
    expect((await call(event, 'teacher', { type: 'assignment-new', id: 'a1' })).body.sent).toBe(false)
  })

  it('the wording varies: the same kind does not repeat its last ones', async () => {
    await people()
    await device('ana')
    for (const id of ['a1', 'a2', 'a3']) { await assignment(id); await call(event, 'teacher', { type: 'assignment-new', id }) }
    const used = (await state('ana')).recent['assignment-new']
    expect(new Set(used).size).toBe(used.length)
  })
})

describe('the league', () => {
  it('overtaking someone tells them, once an hour at most', async () => {
    const day = rules.localDay(Date.now(), 0)
    const session = async (uid, minutes) => {
      await store.collection('practiceSessions').doc().set({
        userId: uid, date: day, durationMinutes: minutes, timedMinutes: minutes, source: 'timer',
        ticket: ticket.issueTicket(uid, Date.now() - (minutes + 1) * 60_000), category: 'Scales',
        difficultyRating: 3, confidenceRating: 3, createdAt: now(),
      })
    }
    await store.doc('users/ana').set({ uid: 'ana', role: 'student', displayName: 'Ana Ruiz' })
    await store.doc('users/ben').set({ uid: 'ben', role: 'student', displayName: 'Ben Lee' })
    await device('ben', 'dev-ben-0001', 'c'.repeat(64))
    await session('ben', 20)
    await league.syncLeague('ben', { tzOffset: 0 })
    await session('ana', 10)
    await league.syncLeague('ana', { tzOffset: 0 })
    await session('ana', 30)
    const r = await league.syncLeague('ana', { tzOffset: 0 })
    expect(r.newRank).toBe(1)
    expect(r.passed).toBeUndefined() // never sent back to the app
    const s = await state('ben')
    expect(s?.events?.some((e) => e.startsWith('league:'))).toBe(true)
  })
})
