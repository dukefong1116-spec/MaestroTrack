/**
 * The server's own Firebase access, for the league endpoints.
 *
 * firebase-admin bypasses the security rules — that is the point: league
 * rooms and tiers are written here and nowhere else, so no student can
 * write themselves to first place. Which also means this file decides who
 * is asking: every request must carry the caller's Firebase ID token, and
 * the uid comes from verifying it, never from the request body.
 *
 * In production the credentials are a service-account key held only in
 * Vercel's environment (FIREBASE_SERVICE_ACCOUNT). Under the emulator
 * (local testing) there are no credentials at all and everything goes to
 * the emulator — see the dev hook in vite.config.ts.
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

export const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)

function app() {
  if (getApps().length) return getApps()[0]
  if (usingEmulator) return initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-maestrotrack' })
  const key = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!key) throw new HttpError(500, 'League is not configured on the server yet.')
  return initializeApp({ credential: cert(JSON.parse(key)) })
}

export const db = () => getFirestore(app())

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/** The verified caller. Never trust a uid sent in the body. */
export async function callerUid(req) {
  const header = req.headers?.authorization ?? req.headers?.Authorization ?? ''
  const token = String(header).startsWith('Bearer ') ? String(header).slice(7) : ''
  if (!token) throw new HttpError(401, 'Sign in first.')
  // Outside the try: a server that is not set up properly is the server's
  // fault (500), not the caller's, and must not look like a bad sign-in.
  const auth = getAuth(app())
  try {
    return (await auth.verifyIdToken(token)).uid
  } catch {
    throw new HttpError(401, 'Sign in again.')
  }
}

/** The JSON body — parsed already on Vercel, read by hand under Vite. */
export async function jsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return safeParse(req.body)
  const chunks = []
  for await (const c of req) chunks.push(c)
  return safeParse(Buffer.concat(chunks).toString('utf8'))
}

function safeParse(s) {
  try {
    const v = JSON.parse(s || '{}')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

/** Plain Node response calls only, so the same handler runs on Vercel and under Vite. */
export function send(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

/** POST-only, errors as JSON, nothing internal leaked. */
export function handler(fn) {
  return async (req, res) => {
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
    try {
      send(res, 200, await fn(req))
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500
      if (status === 500) console.error('[league]', e)
      send(res, status, { error: status === 500 ? 'Something went wrong.' : e.message })
    }
  }
}
