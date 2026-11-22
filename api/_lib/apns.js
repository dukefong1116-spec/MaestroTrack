/**
 * Apple's push service, spoken directly: one HTTP/2 request per device,
 * signed with the app's push key (a .p8 from the Apple Developer site).
 *
 * Configured in Vercel's environment, never in the code:
 *   APNS_KEY      the .p8 file's contents (the whole PEM, line breaks and all)
 *   APNS_KEY_ID   its Key ID
 *   APNS_TEAM_ID  the Apple Developer team
 *   APNS_TOPIC    the app's bundle id (default com.mutiftrack.app)
 */
import http2 from 'node:http2'
import { createPrivateKey, sign } from 'node:crypto'

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

export function apnsConfigured() {
  return Boolean(process.env.APNS_KEY && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID)
}

// Apple accepts a token for up to an hour and asks that it not be made
// more often than every 20 minutes; one is kept for 40.
let cached = null
function token() {
  const now = Math.floor(Date.now() / 1000)
  if (cached && now - cached.iat < 40 * 60) return cached.jwt
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: process.env.APNS_KEY_ID }))
  const claims = b64url(JSON.stringify({ iss: process.env.APNS_TEAM_ID, iat: now }))
  const key = createPrivateKey(process.env.APNS_KEY.replace(/\\n/g, '\n'))
  const sig = sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' })
  cached = { iat: now, jwt: `${header}.${claims}.${b64url(sig)}` }
  return cached.jwt
}

/**
 * Send one notification to each device. Resolves to the device tokens
 * Apple says are gone (uninstalled, signed out), for the caller to forget.
 * devices: [{ token, env: 'sandbox' | 'production' }]
 */
export async function sendApns(devices, note) {
  if (!devices.length || !apnsConfigured()) return []
  const payload = JSON.stringify({
    aps: {
      alert: { title: note.title, body: note.body },
      ...(note.passive ? { 'interruption-level': 'passive' } : { sound: 'default' }),
      'thread-id': note.kind,
    },
    url: note.url,
  })
  const dead = []
  const byHost = new Map()
  for (const d of devices) {
    const host = d.env === 'sandbox' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com'
    byHost.set(host, [...(byHost.get(host) ?? []), d])
  }
  for (const [host, list] of byHost) {
    const session = http2.connect(host)
    session.on('error', () => {})
    try {
      await Promise.all(list.map((d) => new Promise((resolve) => {
        const req = session.request({
          ':method': 'POST',
          ':path': `/3/device/${d.token}`,
          authorization: `bearer ${token()}`,
          'apns-topic': process.env.APNS_TOPIC || 'com.mutiftrack.app',
          'apns-push-type': 'alert',
          'apns-priority': note.passive ? '5' : '10',
          'apns-collapse-id': String(note.id).slice(0, 64),
          'content-type': 'application/json',
        })
        let status = 0
        let body = ''
        req.setTimeout(8000, () => { req.close(); resolve() })
        req.on('response', (h) => { status = Number(h[':status']) })
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          // 410: the token is no longer active. 400 BadDeviceToken: never was.
          if (status === 410 || (status === 400 && /BadDeviceToken|DeviceTokenNotForTopic/.test(body))) dead.push(d.token)
          else if (status !== 200) console.error('[push] apns', status, body)
          resolve()
        })
        req.on('error', () => resolve())
        req.end(payload)
      })))
    } finally {
      session.close()
    }
  }
  return dead
}
