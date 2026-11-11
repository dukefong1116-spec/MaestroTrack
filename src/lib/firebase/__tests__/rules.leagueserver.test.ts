// @ts-nocheck — exercises the plain-JavaScript server code in api/, which
// carries no type declarations; the assertions are what matter here.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

/**
 * The league server (api/_lib/*), run for real against the Firestore
 * emulator.
 *
 * Its own emulator project, so clearing it between tests never touches the
 * demo accounts the app uses. Times are real: Firestore stamps a session's
 * creation time itself, and tickets are judged against that — which is
 * the whole point of them — so tests issue tickets "some minutes ago"
 * rather than pretending the clock is elsewhere.
 */

const PROJECT = 'demo-league-test'
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085'
process.env.GCLOUD_PROJECT = PROJECT

type Lib = {
  admin: typeof import('../../../../api/_lib/admin.js')
  ticket: typeof import('../../../../api/_lib/ticket.js')
  league: typeof import('../../../../api/_lib/league.js')
  rules: typeof import('../../league/rules')
}
let L: Lib
let store: ReturnType<Lib['admin']['db']>

beforeAll(async () => {
  L = {
    admin: await import('../../../../api/_lib/admin.js'),
    ticket: await import('../../../../api/_lib/ticket.js'),
    league: await import('../../../../api/_lib/league.js'),
    rules: await import('../../league/rules'),
  }
  store = L.admin.db()
})

beforeEach(async () => {
  await fetch(`http://127.0.0.1:8085/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' })
})

const MIN = 60_000
const today = () => L.rules.localDay(Date.now(), 0)

async function student(uid: string, extra: Record<string, unknown> = {}) {
  await store.doc(`users/${uid}`).set({ uid, role: 'student', displayName: `${uid} Tester`, ...extra })
}

/** A timer session whose ticket was issued `ago` minutes before now. */
async function timerSession(uid: string, minutes: number, ago = minutes + 1, over: Record<string, unknown> = {}) {
  const ticket = L.ticket.issueTicket(uid, Date.now() - ago * MIN)
  const ref = store.collection('practiceSessions').doc()
  await ref.set({
    userId: uid, date: today(), durationMinutes: minutes, timedMinutes: minutes,
    source: 'timer', ticket, category: 'Scales', difficultyRating: 3, confidenceRating: 3,
    createdAt: new Date().toISOString(), ...over,
  })
  return ref
}

const sync = (uid: string, nowMs?: number) => L.league.syncLeague(uid, { tzOffset: 0, nowMs })

describe('what counts', () => {
  it('a timer session with a real ticket earns its minutes plus the day bonus', async () => {
    await student('ana')
    await timerSession('ana', 30)
    const r = await sync('ana')
    expect(r.xp).toBe(40)
    expect(r.roomId).toBeTruthy()
    expect(r.newRank).toBe(1)
  })
  it('streak fields a profile holds, however malformed, cannot break a sync', async () => {
    await student('ana', { streakRules: 'junk', streakFreezesUsed: [1, null, 'x'], streakRepaired: null })
    await timerSession('ana', 30)
    expect((await sync('ana')).xp).toBe(40)
  })
  it('a typed-in session earns nothing', async () => {
    await student('ana')
    await store.collection('practiceSessions').add({ userId: 'ana', date: today(), durationMinutes: 60, createdAt: new Date().toISOString() })
    const r = await sync('ana')
    expect(r.xp).toBe(0)
    expect(r.roomId).toBe(null)
  })
  it('a forged ticket earns nothing', async () => {
    await student('ana')
    await timerSession('ana', 30, 31, { ticket: `${Date.now() - 40 * MIN}.forged` })
    expect((await sync('ana')).xp).toBe(0)
  })
  it("someone else's ticket earns nothing", async () => {
    await student('ana')
    await timerSession('ana', 30, 31, { ticket: L.ticket.issueTicket('ben', Date.now() - 40 * MIN) })
    expect((await sync('ana')).xp).toBe(0)
  })
  it('a session cannot claim more minutes than really passed since its ticket', async () => {
    await student('ana')
    await timerSession('ana', 60, 5)
    // Five real minutes, rounded up, plus one minute's grace for rounding.
    expect((await sync('ana')).xp).toBeLessThanOrEqual(7)
  })
  it('one ticket cannot be spent twice', async () => {
    await student('ana')
    const ticket = L.ticket.issueTicket('ana', Date.now() - 31 * MIN)
    await timerSession('ana', 30, 31, { ticket })
    await timerSession('ana', 30, 31, { ticket })
    // 31 real minutes (+ rounding grace) between them, not 60.
    expect((await sync('ana')).xp).toBeLessThanOrEqual(33 + 10)
  })
  it('the smaller of what the session says and what the timer measured', async () => {
    await student('ana')
    await timerSession('ana', 90, 100, { timedMinutes: 20 })
    expect((await sync('ana')).xp).toBe(30)
  })
  it('deleting a session takes its XP away', async () => {
    await student('ana')
    const a = await timerSession('ana', 20)
    await timerSession('ana', 15)
    expect((await sync('ana')).xp).toBe(45)
    await a.delete()
    expect((await sync('ana')).xp).toBe(25)
  })
  it('teachers have no league', async () => {
    await store.doc('users/t').set({ role: 'teacher', displayName: 'T' })
    await expect(sync('t')).rejects.toMatchObject({ status: 403 })
  })
})

describe('rooms', () => {
  it('the second player joins the first one\'s room, and passing someone is recorded', async () => {
    await student('ana'); await student('ben')
    await timerSession('ana', 20); await timerSession('ben', 15)
    const a = await sync('ana')
    const b = await sync('ben')
    expect(b.roomId).toBe(a.roomId)
    expect(b.newRank).toBe(2)
    await timerSession('ben', 30)
    const b2 = await sync('ben')
    expect(b2).toMatchObject({ oldRank: 2, newRank: 1 })
    const room = (await store.doc(`leagueRooms/${a.roomId}`).get()).data()!
    expect(room.members.ana.passedBy.name).toBe('ben T.')
    expect(room.members.ben.name).toBe('ben T.')
  })
  it('a different tier gets a different room', async () => {
    await student('ana'); await student('ben', { league: { tier: 3 } })
    await timerSession('ana', 20); await timerSession('ben', 20)
    expect((await sync('ana')).roomId).not.toBe((await sync('ben')).roomId)
  })
  it('35 players joining at once fill one room to 30 and start another', async () => {
    const ids = Array.from({ length: 35 }, (_, i) => `p${i}`)
    await Promise.all(ids.map((id) => student(id)))
    await Promise.all(ids.map((id) => timerSession(id, 12)))
    const res = await Promise.all(ids.map((id) => sync(id)))
    const sizes = new Map<string, number>()
    for (const r of res) sizes.set(r.roomId!, (sizes.get(r.roomId!) ?? 0) + 1)
    expect([...sizes.values()].sort((x, y) => y - x)).toEqual([30, 5])
    for (const [id, n] of sizes) {
      const room = (await store.doc(`leagueRooms/${id}`).get()).data()!
      expect(Object.keys(room.members)).toHaveLength(n)
    }
  }, 60_000)
  it('syncing again changes nothing', async () => {
    await student('ana')
    await timerSession('ana', 20)
    const a = await sync('ana')
    const again = await sync('ana')
    expect(again).toMatchObject({ roomId: a.roomId, xp: a.xp, oldRank: 1, newRank: 1 })
  })
})

describe('the end of the week', () => {
  async function weekOf(players: [string, number][], tier = 2) {
    for (const [id, m] of players) { await student(id, { league: { tier } }); await timerSession(id, m) }
    let roomId = ''
    for (const [id] of players) roomId = (await sync(id)).roomId!
    const endsAt = (await store.doc(`leagueRooms/${roomId}`).get()).data()!.endsAt as number
    return { roomId, after: endsAt + MIN }
  }

  it('moves the top up and the bottom down, once, when anyone opens the app', async () => {
    const { roomId, after } = await weekOf([['a', 50], ['b', 40], ['c', 30], ['d', 20], ['e', 15]])
    await sync('c', after)
    const tiers = Object.fromEntries(await Promise.all(['a', 'b', 'c', 'd', 'e'].map(async (id) =>
      [id, (await store.doc(`users/${id}`).get()).data()!.league])))
    expect(tiers.a).toMatchObject({ tier: 3, lastResult: { rank: 1, of: 5, fromTier: 2, toTier: 3 } })
    expect(tiers.b.tier).toBe(3)
    expect(tiers.c.tier).toBe(2)
    expect(tiers.e).toMatchObject({ tier: 1, lastResult: { rank: 5, toTier: 1 } })
    expect((await store.doc(`leagueRooms/${roomId}`).get()).data()!.status).toBe('final')
    // A second finish does nothing at all.
    expect(await L.league.finalizeRoom(roomId, after)).toBe(false)
    expect((await store.doc('users/a').get()).data()!.league.tier).toBe(3)
  })
  it('a finished week puts you in a new room, and keeps your result', async () => {
    const { roomId, after } = await weekOf([['a', 30]])
    const next = await sync('a', after + 8 * 86_400_000)
    expect(next.roomId).not.toBe(roomId)
    const league = (await store.doc('users/a').get()).data()!.league
    expect(league.lastResult).toMatchObject({ rank: 1, toTier: 3 })
  })
  it('does not finish a room early', async () => {
    const { roomId } = await weekOf([['a', 30], ['b', 20]])
    expect(await L.league.finalizeRoom(roomId, Date.now())).toBe(false)
  })
})

describe('opting out', () => {
  it('takes you out of your room at once and keeps your tier', async () => {
    await student('ana', { league: { tier: 2 } }); await student('ben', { league: { tier: 2 } })
    await timerSession('ana', 20); await timerSession('ben', 20)
    const { roomId } = await sync('ana'); await sync('ben')
    await store.doc('users/ana').update({ leagueOptOut: true })
    const r = await sync('ana')
    expect(r.optedOut).toBe(true)
    const room = (await store.doc(`leagueRooms/${roomId}`).get()).data()!
    expect(Object.keys(room.members)).toEqual(['ben'])
    expect((await store.doc('users/ana').get()).data()!.league.tier).toBe(2)
  })
})

describe('the endpoints', () => {
  function call(handler: (req: unknown, res: unknown) => Promise<void>, req: Record<string, unknown>) {
    return new Promise<{ status: number; body: { error?: string; ticket?: string } }>((resolve) => {
      const res = {
        statusCode: 0, headers: {} as Record<string, string>,
        setHeader(k: string, v: string) { this.headers[k] = v },
        end(s: string) { resolve({ status: this.statusCode, body: JSON.parse(s) }) },
      }
      void handler({ method: 'POST', headers: {}, body: {}, ...req }, res)
    })
  }
  it('refuse anyone not signed in', async () => {
    const sync = (await import('../../../../api/league/sync.js')).default
    const ticket = (await import('../../../../api/league/ticket.js')).default
    expect((await call(sync, {})).status).toBe(401)
    expect((await call(ticket, { headers: { authorization: 'Bearer nonsense' } })).status).toBe(401)
  })
  it('refuse anything but POST', async () => {
    const sync = (await import('../../../../api/league/sync.js')).default
    expect((await call(sync, { method: 'GET' })).status).toBe(405)
  })
})
