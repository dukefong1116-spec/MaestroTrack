/**
 * Web Push to browsers (Chrome, Firefox, Edge, Safari — and an iPhone's
 * home-screen web app), with nothing but Node's own crypto: the payload
 * encrypted as RFC 8291 says (aes128gcm), and the request signed as RFC
 * 8292 says (VAPID). Every browser's push service speaks exactly this.
 *
 * Configured in Vercel's environment:
 *   VAPID_PUBLIC_KEY   (also in the app's build as VITE_VAPID_PUBLIC_KEY)
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT      mailto: an address the push services can reach
 * Make a pair with `node scripts/vapid-keys.mjs`.
 */
import { createECDH, createCipheriv, createHmac, createPrivateKey, randomBytes, sign } from 'node:crypto'

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
const fromB64url = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64')

export function webPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT)
}

/** Keep caller-controlled URLs away from the server's network and VAPID key. */
export function validPushEndpoint(value) {
  if (typeof value !== 'string' || value.length > 4096) return false
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    const supported = host === 'fcm.googleapis.com'
      || host === 'push.services.mozilla.com'
      || host.endsWith('.push.services.mozilla.com')
      || host === 'push.apple.com'
      || host.endsWith('.push.apple.com')
      || host.endsWith('.notify.windows.com')
    return url.protocol === 'https:'
      && (url.port === '' || url.port === '443')
      && !url.username && !url.password
      && supported
  } catch {
    return false
  }
}

const hmac = (key, data) => createHmac('sha256', key).update(data).digest()

/** The message, encrypted for this one subscription (RFC 8291). */
export function encrypt(sub, plaintext) {
  const uaPublic = fromB64url(sub.keys.p256dh)
  const authSecret = fromB64url(sub.keys.auth)
  const ecdh = createECDH('prime256v1')
  const asPublic = ecdh.generateKeys()
  const shared = ecdh.computeSecret(uaPublic)
  const ikm = hmac(hmac(authSecret, shared), Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]))
  const salt = randomBytes(16)
  const prk = hmac(salt, ikm)
  const cek = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])])).subarray(0, 16)
  const nonce = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])])).subarray(0, 12)
  const cipher = createCipheriv('aes-128-gcm', cek, nonce)
  // One record: the message, then 0x02 to say it is the last.
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(plaintext), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()])
  const rs = Buffer.alloc(4)
  rs.writeUInt32BE(4096)
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body])
}

/** The VAPID signature for one push service (RFC 8292). */
function vapid(endpoint) {
  const pub = fromB64url(process.env.VAPID_PUBLIC_KEY)
  const key = createPrivateKey({
    format: 'jwk',
    key: { kty: 'EC', crv: 'P-256', d: process.env.VAPID_PRIVATE_KEY, x: b64url(pub.subarray(1, 33)), y: b64url(pub.subarray(33, 65)) },
  })
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  const claims = b64url(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: process.env.VAPID_SUBJECT }))
  const sig = sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' })
  return `vapid t=${header}.${claims}.${b64url(sig)}, k=${process.env.VAPID_PUBLIC_KEY}`
}

/**
 * Send to each browser subscription. Resolves to the subscriptions the
 * push service says are gone, for the caller to forget.
 * devices: [{ token: JSON subscription }]
 */
export async function sendWebPush(devices, note) {
  if (!devices.length || !webPushConfigured()) return []
  const payload = JSON.stringify({ title: note.title, body: note.body, url: note.path, tag: note.kind, silent: !!note.passive })
  const dead = []
  await Promise.all(devices.map(async (d) => {
    let sub
    try { sub = JSON.parse(d.token) } catch { dead.push(d.token); return }
    // Recheck at send time for rows that predate registration validation.
    if (!validPushEndpoint(sub?.endpoint)) { dead.push(d.token); return }
    try {
      const res = await fetch(sub.endpoint, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'content-encoding': 'aes128gcm',
          'content-type': 'application/octet-stream',
          ttl: '86400',
          urgency: note.passive ? 'low' : 'normal',
          topic: String(note.kind).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32),
          authorization: vapid(sub.endpoint),
        },
        body: encrypt(sub, payload),
        signal: AbortSignal.timeout(8000),
      })
      if (res.status === 404 || res.status === 410) dead.push(d.token)
      else if (!res.ok) console.error('[push] web', res.status, await res.text().catch(() => ''))
    } catch (e) {
      console.error('[push] web', e?.message)
    }
  }))
  return dead
}
