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

  // 3. The sessions themselves. Days before Monday are read too, for a
  // streak carried in from last week.
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
  const credited = creditedSessions(uid, sessions)

  // What the timer can vouch for, written where only this server can
  // write. Everything else a teacher sees — the charts, the totals — the
  // student's own app works out and writes, so it is only as true as the
  // log; this is the figure that is checked. Kept whether or not they
  // play in the league.
  await writeVerified(uid, credited, from, nowMs)

  if (user.leagueOptOut) {
    if (room) await leaveRoom(uid, roomId)
    await dropCard(uid)
    return { optedOut: true, week: week.id, tier, xp: 0, days: [], streak: 0, roomId: null }
  }
  // Your lesson day, freezes and comebacks hold the league's streak too —
  // capped at what fair play could produce, since you write those fields.
  const holds = holdDays({
    rules: user.streakRules,
    frozen: user.streakFreezesUsed,
    repaired: user.streakRepaired,
    from,
    to: addDays(week.start, 6),
  })
  const { xp, days } = weekXp(credited, week.start, holds)
  const base = { optedOut: false, week: week.id, tier, xp, days, streak: streakOn(days, today) }

  if (room) {
    const out = { ...base, roomId, ...(await updateXp(roomId, uid, xp, nowMs)) }
    await writeCard(uid, user, out, nowMs)
    return out
  }
  if (xp <= 0) {
    await dropCard(uid)
    return { ...base, roomId: null, oldRank: null, newRank: null, oldXp: 0 }
  }

  const member = {
    name: publicName(user.displayName),
    colour: colourFor(uid),
    xp,
    xpAt: iso(nowMs),
    joinedAt: iso(nowMs),
  }
  const out = { ...base, ...(await placeInRoom(uid, week, bandFor(offset), tier, member, nowMs)) }
  await writeCard(uid, user, out, nowMs)
  return out
}

/**
 * Your public league card: what the players in your room see when they
 * tap your row. Written here and nowhere else, from your profile, so it
 * carries only these fields — and only while "Show my profile to my
 * league" is on. Readable by the players in the room it names (rules).
 *
 * Pictures are copied only when they are your own uploads in this
 * project's bucket. A profile field is yours to write, and a link to
 * anywhere else, shown to other students, would tell that site who opened
 * your card and when.
 */
// The same bucket the storage rules and share links are pinned to.
const BUCKET = process.env.VITE_FIREBASE_STORAGE_BUCKET || 'maestrotrack-3c2cf.firebasestorage.app'
function ownPicture(url, uid) {
  if (typeof url !== 'string' || url.length > 1000) return null
  const folder = `/o/avatars%2F${encodeURIComponent(uid)}%2F`
  if (url.startsWith(`https://firebasestorage.googleapis.com/v0/b/${BUCKET}${folder}`)) return url
  // Under the emulators (local only), whatever bucket the dev app names.
  const local = process.env.FIRESTORE_EMULATOR_HOST && /^http:\/\/(127\.0\.0\.1|localhost):9199\/v0\/b\/[a-z0-9.-]+\//.test(url)
  return local && url.includes(folder) ? url : null
}
const short = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null)

async function writeCard(uid, user, { roomId, days, streak, xp, tier }, nowMs) {
  if (!roomId || user.leagueProfile === false) return dropCard(uid)
  const card = {
    uid,
    roomId,
    name: publicName(user.displayName),
    colour: colourFor(uid),
    instrument: short(user.instrument, 40),
    level: short(user.experienceLevel, 40),
    photo: ownPicture(user.avatar, uid),
    bannerImage: ownPicture(user.bannerImage, uid),
    bannerColor: typeof user.bannerColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(user.bannerColor) ? user.bannerColor : null,
    // Timer minutes, Monday to Sunday: the line on the card's graph.
    days: (days ?? []).map((d) => d.minutes),
    streak: streak ?? 0,
    xp: xp ?? 0,
    tier: tier ?? 0,
    topFinishes: user.league?.topFinishes ?? 0,
    badges: (Array.isArray(user.pinnedBadges) ? user.pinnedBadges : [])
      .filter((b) => typeof b === 'string' && /^[a-z0-9_]{1,40}$/.test(b)).slice(0, 3),
  }
  const ref = db().doc(`leagueCards/${uid}`)
  const before = (await ref.get()).data()
  if (before) {
    const { updatedAt: _ignored, ...rest } = before
    if (JSON.stringify(Object.entries(rest).sort()) === JSON.stringify(Object.entries(card).sort())) return
  }
  await ref.set({ ...card, updatedAt: iso(nowMs) })
}

async function dropCard(uid) {
  const ref = db().doc(`leagueCards/${uid}`)
  if ((await ref.get()).exists) await ref.delete()
}

/** Timer-checked minutes per day, over the days just read. Unchanged → not rewritten. */
async function writeVerified(uid, credited, from, nowMs) {
  const days = {}
  for (const s of credited) days[s.date] = (days[s.date] ?? 0) + s.minutes
  const ref = db().doc(`verifiedPractice/${uid}`)
  const before = (await ref.get()).data()
  const same = before && before.from === from
    && JSON.stringify(Object.entries(before.days ?? {}).sort()) === JSON.stringify(Object.entries(days).sort())
  if (same) return
  await ref.set({ uid, from, days, updatedAt: iso(nowMs) })
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
        // Shown on the league card. A room of one is not a finish.
        ...(r.rank <= 3 && r.of > 1 ? { 'league.topFinishes': FieldValue.increment(1) } : {}),
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
