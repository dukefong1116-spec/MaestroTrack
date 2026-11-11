/**
 * Weekly leagues, server side: the only code that writes league data.
 *
 * One entry point, syncLeague, called after a timer session is saved or
 * deleted and whenever the League tab opens. It is safe to call any number
 * of times — every step either changes something real or does nothing:
 *
 *   1. If your room's week is over, the room is finished first: ranked,
 *      tiers moved, results written to every member (finalizeRoom).
 *   2. Your weekly XP is recounted from scratch from your sessions — never
 *      kept as a running total, so a deleted session simply drops out.
 *   3. In a room already: your XP is updated there, and anyone you just
 *      passed is told. Not in one yet and you have XP: you are placed.
 *
 * There is no scheduled job. A room ends the first time any member syncs
 * after its end — and since nobody can join a new week until their old
 * room has ended, every result is always written before it is needed.
 *
 * Every change to a room happens inside a transaction, so two players
 * arriving at the same moment can neither overfill a room nor apply a
 * week's end twice.
 */
import { FieldValue } from 'firebase-admin/firestore'
import { db, HttpError } from './admin.js'
import { creditedSessions } from './ticket.js'
import {
  weekOf, localDay, addDays, bandFor, weekEndsAt, weekXp, streakOn, rankMembers,
  finalResults, publicName, colourFor, ROOM_MAX, MAX_BAND_REACH, STREAK_LOOKBACK,
} from '../../src/lib/league/rules.js'
import { holdDays } from '../../src/lib/streak/engine.js'

const iso = (ms) => new Date(ms).toISOString()

/**
 * Transactions retried when they collide.
 *
 * Everyone joining a tier in the same band in the same moment writes the
 * same "which room is filling" record, so on a busy Monday morning
 * transactions abort and the SDK's own few retries can run out. Waiting a
 * random moment and trying again turns a collision into a short delay
 * instead of an error.
 */
async function retrying(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (e) {
      const aborted = e?.code === 10 || /ABORTED|contention|lock timeout/i.test(String(e?.message))
      if (!aborted || attempt >= 8) throw e
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 160 * (attempt + 1)))
    }
  }
}

function clampOffset(v) {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.max(-840, Math.min(840, n)) : 0
}

const membersOf = (room) => Object.entries(room.members ?? {}).map(([uid, m]) => ({ uid, ...m }))
const rankOf = (list, uid) => rankMembers(list).findIndex((m) => m.uid === uid) + 1

export async function syncLeague(uid, { tzOffset = 0, nowMs = Date.now() } = {}) {
  const store = db()
  const userRef = store.doc(`users/${uid}`)
  let user = (await userRef.get()).data()
  if (!user) throw new HttpError(404, 'No profile yet.')
  if (user.role !== 'student') throw new HttpError(403, 'Leagues are for students.')
  const offset = clampOffset(tzOffset)

  // 1. Finish a room whose week is over.
  let room = null
  const roomId = user.league?.roomId
  if (roomId) {
    const snap = await store.doc(`leagueRooms/${roomId}`).get()
    room = snap.exists ? snap.data() : null
    if (room?.status === 'open' && nowMs >= room.endsAt) {
      await finalizeRoom(roomId, nowMs)
      user = (await userRef.get()).data()
      room = null
    } else if (room?.status !== 'open') {
      room = null
    }
  }

  // 2. The week that counts: the open room's while it lasts — so a room
  // that mixes neighbouring time zones keeps everyone in the same week —
  // otherwise this one, in your own time zone.
  const week = room ? { id: room.week, start: room.weekStart } : weekOf(nowMs, offset)
  const today = localDay(nowMs, offset)
  const tier = user.league?.tier ?? 0

  if (user.leagueOptOut) {
    if (room) await leaveRoom(uid, roomId)
    return { optedOut: true, week: week.id, tier, xp: 0, days: [], streak: 0, roomId: null }
  }

  // 3. XP, from the sessions themselves. Days before Monday are read too,
  // for a streak carried in from last week.
  const from = addDays(week.start, -STREAK_LOOKBACK)
  const snaps = await store.collection('practiceSessions')
    .where('userId', '==', uid)
    .where('date', '>=', from)
    .where('date', '<=', addDays(week.start, 6))
    // Newest first, matching the (userId, date desc) index the app's own
    // session query already uses, so this needs no index of its own.
    .orderBy('date', 'desc')
    .get()
  const sessions = snaps.docs.map((d) => ({ ...d.data(), id: d.id, createdMs: d.createTime.toMillis() }))
  // Your lesson day, freezes and comebacks hold the league's streak too —
  // capped at what fair play could produce, since you write those fields.
  const holds = holdDays({
    rules: user.streakRules,
    frozen: user.streakFreezesUsed,
    repaired: user.streakRepaired,
    from,
    to: addDays(week.start, 6),
  })
  const { xp, days } = weekXp(creditedSessions(uid, sessions), week.start, holds)
  const base = { optedOut: false, week: week.id, tier, xp, days, streak: streakOn(days, today) }

  if (room) return { ...base, roomId, ...(await updateXp(roomId, uid, xp, nowMs)) }
  if (xp <= 0) return { ...base, roomId: null, oldRank: null, newRank: null, oldXp: 0 }

  const member = {
    name: publicName(user.displayName),
    colour: colourFor(uid),
    xp,
    xpAt: iso(nowMs),
    joinedAt: iso(nowMs),
  }
  return { ...base, ...(await placeInRoom(uid, week, bandFor(offset), tier, member, nowMs)) }
}

/** Your new XP in your room; whoever you passed hears about it. */
async function updateXp(roomId, uid, xp, nowMs) {
  const store = db()
  return retrying(() => store.runTransaction(async (tx) => {
    const ref = store.doc(`leagueRooms/${roomId}`)
    const room = (await tx.get(ref)).data()
    const me = room?.members?.[uid]
    if (!room || room.status !== 'open' || !me) return { oldRank: null, newRank: null, oldXp: xp, size: 0 }
    const list = membersOf(room)
    const before = rankMembers(list)
    const oldRank = before.findIndex((m) => m.uid === uid) + 1
    if (me.xp === xp) return { oldRank, newRank: oldRank, oldXp: xp, size: list.length }

    const at = iso(nowMs)
    const xpAt = xp > me.xp ? at : me.xpAt
    const newRank = rankOf(list.map((m) => (m.uid === uid ? { ...m, xp, xpAt } : m)), uid)
    const updates = { [`members.${uid}.xp`]: xp, [`members.${uid}.xpAt`]: xpAt }
    // Everyone between your new place and your old one was just passed.
    for (const m of before.slice(newRank - 1, oldRank - 1)) {
      updates[`members.${m.uid}.passedBy`] = { name: me.name, at }
    }
    tx.update(ref, updates)
    return { oldRank, newRank, oldXp: me.xp, size: list.length }
  }))
}

/**
 * Into a room for this week: the one filling in your tier and time-zone
 * band, or — only if your band has none at all yet — one filling in a
 * neighbouring band, rather than sit alone. Otherwise a new room.
 */
async function placeInRoom(uid, week, band, tier, member, nowMs) {
  const store = db()
  return retrying(() => store.runTransaction(async (tx) => {
    const userRef = store.doc(`users/${uid}`)
    const user = (await tx.get(userRef)).data()
    if (user?.league?.week === week.id && user.league.roomId) {
      return { roomId: user.league.roomId, oldRank: null, newRank: null, oldXp: 0, size: 0 }
    }

    const reach = [0]
    for (let r = 1; r <= MAX_BAND_REACH; r++) reach.push(-r, r)
    const idxRefs = reach.map((r) => store.doc(`leagueIndex/${week.id}_${tier}_${band + r}`))
    const idx = await tx.getAll(...idxRefs)
    const roomRefs = idx.map((s) => (s.exists && s.data().roomId ? store.doc(`leagueRooms/${s.data().roomId}`) : null))
    const present = roomRefs.filter(Boolean)
    const fetched = present.length ? await tx.getAll(...present) : []
    const rooms = roomRefs.map((r) => (r ? fetched[present.indexOf(r)] : null))
    const open = (i) => {
      const r = rooms[i]?.exists ? rooms[i].data() : null
      return !!r && r.status === 'open' && nowMs < r.endsAt && Object.keys(r.members ?? {}).length < ROOM_MAX
    }

    let pick = open(0) ? 0 : -1
    if (pick < 0 && !idx[0].exists) {
      for (let i = 1; i < reach.length && pick < 0; i++) if (open(i)) pick = i
    }

    let roomRef
    let list
    if (pick >= 0) {
      roomRef = roomRefs[pick]
      list = [...membersOf(rooms[pick].data()), { uid, ...member }]
      tx.update(roomRef, { [`members.${uid}`]: member })
      tx.set(idxRefs[pick], { roomId: roomRef.id, count: list.length }, { merge: true })
    } else {
      roomRef = store.collection('leagueRooms').doc()
      list = [{ uid, ...member }]
      tx.set(roomRef, {
        week: week.id, weekStart: week.start, tier, band,
        endsAt: weekEndsAt(week.start, band),
        status: 'open', createdAt: iso(nowMs),
        members: { [uid]: member },
      })
      tx.set(idxRefs[0], { roomId: roomRef.id, count: 1 })
    }
    tx.update(userRef, { 'league.tier': tier, 'league.roomId': roomRef.id, 'league.week': week.id })
    return { roomId: roomRef.id, oldRank: null, newRank: rankOf(list, uid), oldXp: 0, size: list.length, joined: true }
  }))
}

/** The end of a room's week. Does nothing if it is not over, or already done. */
export async function finalizeRoom(roomId, nowMs = Date.now()) {
  const store = db()
  return retrying(() => store.runTransaction(async (tx) => {
    const ref = store.doc(`leagueRooms/${roomId}`)
    const room = (await tx.get(ref)).data()
    if (!room || room.status !== 'open' || nowMs < room.endsAt) return false
    const results = finalResults(membersOf(room).map((m) => ({ uid: m.uid, xp: m.xp ?? 0, xpAt: m.xpAt })), room.tier)
    const userRefs = results.map((r) => store.doc(`users/${r.uid}`))
    const users = userRefs.length ? await tx.getAll(...userRefs) : []

    tx.update(ref, {
      status: 'final',
      finalizedAt: iso(nowMs),
      results: Object.fromEntries(results.map((r) => [r.uid, { rank: r.rank, toTier: r.toTier, maestro: r.maestro }])),
    })
    results.forEach((r, i) => {
      const u = users[i]
      // Only someone still pointing at this room: a deleted account, or
      // one that left, is skipped rather than recreated.
      if (!u.exists || u.data().league?.roomId !== roomId) return
      tx.update(userRefs[i], {
        'league.tier': r.toTier,
        // Done with this room: the result keeps its id, the profile stops
        // pointing at it, and the next session places you afresh.
        'league.roomId': null,
        'league.week': null,
        'league.lastResult': {
          week: room.week, roomId,
          fromTier: r.fromTier, toTier: r.toTier,
          rank: r.rank, of: r.of, xp: r.xp, maestro: r.maestro,
          at: iso(nowMs),
        },
      })
    })
    return true
  }))
}

/** Out of a room at once — the Settings switch. Your tier is kept. */
async function leaveRoom(uid, roomId) {
  const store = db()
  await retrying(() => store.runTransaction(async (tx) => {
    const ref = store.doc(`leagueRooms/${roomId}`)
    const room = (await tx.get(ref)).data()
    const idxRef = room ? store.doc(`leagueIndex/${room.week}_${room.tier}_${room.band}`) : null
    const idx = idxRef ? (await tx.get(idxRef)).data() : null
    if (room?.members?.[uid] && room.status === 'open') {
      tx.update(ref, { [`members.${uid}`]: FieldValue.delete() })
      if (idx?.roomId === roomId) tx.set(idxRef, { count: Math.max(0, (idx.count ?? 1) - 1) }, { merge: true })
    }
    tx.update(store.doc(`users/${uid}`), { 'league.roomId': null, 'league.week': null })
  }))
}
