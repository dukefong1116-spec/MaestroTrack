/**
 * Pushes from the server: about something someone else did (a teacher's
 * assignment, a student's hand-in, a message, being overtaken). Reminders
 * the phone can work out for itself are scheduled there instead.
 *
 * Where each device can be reached is kept in `pushDevices/{deviceId}`,
 * and what has been sent to each person in `pushState/{uid}` — both
 * written only here (the security rules let no app read or write them).
 *
 * Every send goes through `sendToUser`, which holds the line for everyone:
 *  - the person's own switches (Settings › Notifications),
 *  - at most DAILY_CAP a day (messages and a few others aside),
 *  - never the same event twice (each carries an id),
 *  - quiet hours: it still arrives, but silently, in the list,
 *  - and devices that have gone are forgotten.
 */
import { db } from './admin.js'
import { sendApns } from './apns.js'
import { sendWebPush } from './webpush.js'
import { compose, DAILY_CAP, RECENT, isQuiet } from '../../src/lib/notify/copy.js'

const DEVICES = 'pushDevices'
const STATE = 'pushState'
/** Event ids remembered per person, to refuse a repeat. */
const REMEMBER = 60

/** The local day and hour for someone `tzOffset` minutes east of UTC. */
function localNow(tzOffset = 0, nowMs = Date.now()) {
  const d = new Date(nowMs + tzOffset * 60_000)
  return { day: d.toISOString().slice(0, 10), hour: d.getUTCHours() }
}

/** This device, for this person — and for no one else any more. */
export async function registerDevice(uid, { deviceId, platform, token, env, tzOffset }) {
  const store = db()
  // A device that changes hands (someone else signs in on it) must stop
  // getting the last person's pushes: the same address elsewhere goes.
  const same = await store.collection(DEVICES).where('token', '==', token).get()
  const batch = store.batch()
  for (const d of same.docs) if (d.id !== deviceId) batch.delete(d.ref)
  batch.set(store.doc(`${DEVICES}/${deviceId}`), {
    uid, platform, token, env: env === 'sandbox' ? 'sandbox' : 'production',
    tzOffset: Number.isFinite(tzOffset) ? Math.max(-840, Math.min(840, Math.round(tzOffset))) : 0,
    updatedAt: new Date().toISOString(),
  })
  await batch.commit()
}

/** Signing out: this device is no longer this person's. */
export async function unregisterDevice(uid, deviceId) {
  const ref = db().doc(`${DEVICES}/${deviceId}`)
  const snap = await ref.get()
  if (snap.exists && snap.data().uid === uid) await ref.delete()
}

/**
 * Tell `uid` about something, in the words for `kind` (src/lib/notify/copy).
 * `eventId` makes it happen once at most. Resolves to whether it went.
 */
export async function sendToUser(uid, kind, vars, eventId, nowMs = Date.now()) {
  const store = db()
  const [userSnap, deviceSnap] = await Promise.all([
    store.doc(`users/${uid}`).get(),
    store.collection(DEVICES).where('uid', '==', uid).get(),
  ])
  if (!userSnap.exists || deviceSnap.empty) return false
  const devices = deviceSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const { day, hour } = localNow(devices[0].tzOffset, nowMs)

  // The cap, the repeat guard and the choice of words, decided together.
  const note = await store.runTransaction(async (tx) => {
    const ref = store.doc(`${STATE}/${uid}`)
    const state = (await tx.get(ref)).data() ?? {}
    if ((state.events ?? []).includes(eventId)) return null
    const recent = state.recent?.[kind] ?? []
    const c = compose(kind, vars, recent)
    if (!c) return null
    if (userSnap.data().notify?.[c.cat] === false) return null
    const count = state.day === day ? state.count ?? 0 : 0
    if (!c.exempt && count >= DAILY_CAP) return null
    tx.set(ref, {
      day,
      count: c.exempt ? count : count + 1,
      events: [...(state.events ?? []), eventId].slice(-REMEMBER),
      recent: { ...(state.recent ?? {}), [kind]: [...recent, c.index].slice(-RECENT) },
      updatedAt: new Date(nowMs).toISOString(),
    })
    return c
  })
  if (!note) return false

  const out = {
    id: eventId,
    kind,
    title: note.title,
    body: note.body,
    passive: isQuiet(hour) && !note.exempt,
    path: note.to,
    url: `femata://go?to=${encodeURIComponent(note.to)}`,
  }
  const [deadIos, deadWeb] = await Promise.all([
    sendApns(devices.filter((d) => d.platform === 'ios'), out),
    sendWebPush(devices.filter((d) => d.platform === 'web'), out),
  ])
  const dead = new Set([...deadIos, ...deadWeb])
  if (dead.size) {
    const batch = store.batch()
    for (const d of devices) if (dead.has(d.token)) batch.delete(store.doc(`${DEVICES}/${d.id}`))
    await batch.commit()
  }
  return true
}

/** First name, for the words. */
export const firstName = (s) => String(s ?? '').trim().split(/\s+/)[0] || undefined

/** Shortened for a notification line. */
export const clip = (s, n = 100) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

