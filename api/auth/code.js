/**
 * POST /api/auth/code — the 6-digit code that proves a new email account's
 * address is really theirs. Body: { action: 'send' } or { action: 'check', code }.
 *
 * The code is made and checked here, never in the app: only its hash is
 * kept, in emailCodes/{uid}, which the security rules close to everyone
 * (the catch-all deny) — only this server reads it. A right code marks the
 * account's email verified in Firebase Auth itself.
 *
 * Sent from help@femataus.com (see _lib/mail.js).
 * Under the emulator nothing is sent: the code is handed back for testing.
 */
import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { sendMail } from '../_lib/mail.js'
import { handler, callerUid, jsonBody, HttpError, db, adminAuth, usingEmulator } from '../_lib/admin.js'

const TTL = 10 * 60_000 // a code lasts 10 minutes
const GAP = 30_000 // at least 30 s between sends
const PER_HOUR = 5 // sends per hour
const TRIES = 5 // wrong guesses per code

const hash = (uid, code) => createHash('sha256').update(`${uid}:${code}`).digest()

export default handler(async (req) => {
  const uid = await callerUid(req)
  const { action, code } = await jsonBody(req)
  const user = await adminAuth().getUser(uid)
  if (user.emailVerified) return { verified: true }
  if (!user.email || !user.providerData.some((p) => p.providerId === 'password')) throw new HttpError(400, 'Nothing to confirm.')
  const ref = db().doc(`emailCodes/${uid}`)
  const now = Date.now()

  if (action === 'send') {
    const prev = (await ref.get()).data() ?? {}
    const recent = (Array.isArray(prev.sends) ? prev.sends : []).filter((t) => now - t < 3_600_000)
    if (recent.length && now - recent[recent.length - 1] < GAP) throw new HttpError(429, 'A code was just sent. Wait a few seconds.')
    if (recent.length >= PER_HOUR) throw new HttpError(429, 'Too many codes. Try again in an hour.')
    const fresh = String(randomInt(0, 1_000_000)).padStart(6, '0')
    await ref.set({ hash: hash(uid, fresh).toString('hex'), expires: now + TTL, tries: 0, sends: [...recent, now] })
    if (usingEmulator) return { sent: true, devCode: fresh }
    await email(user.email, fresh)
    return { sent: true }
  }

  if (action === 'check') {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter the 6-digit code.')
    const snap = await ref.get()
    const d = snap.data()
    if (!d || d.expires < now) throw new HttpError(400, 'That code has expired. Send a new one.')
    if (d.tries >= TRIES) throw new HttpError(429, 'Too many tries. Send a new code.')
    const ok = timingSafeEqual(Buffer.from(d.hash, 'hex'), hash(uid, code))
    if (!ok) {
      await ref.update({ tries: d.tries + 1 })
      throw new HttpError(400, "That code isn't right.")
    }
    await adminAuth().updateUser(uid, { emailVerified: true })
    await ref.delete()
    return { verified: true }
  }

  throw new HttpError(400, 'Unknown action.')
})

function email(to, code) {
  return sendMail({
    to,
    subject: `${code} is your Femata code`,
    text: `Your Femata code is ${code}\n\nEnter it in the app to confirm your email. It expires in 10 minutes.\n\nIf you didn't sign up for Femata, you can ignore this email.`,
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:420px;margin:0 auto;padding:32px 24px;color:#0E1626">
<img src="https://app.femataus.com/apple-touch-icon.png" width="56" height="56" alt="Femata" style="border-radius:14px">
<h1 style="font-size:22px;margin:20px 0 8px">Confirm your email</h1>
<p style="font-size:15px;color:#55607a;margin:0 0 20px">Enter this code in Femata. It expires in 10 minutes.</p>
<div style="font-size:34px;font-weight:800;letter-spacing:8px;background:#EEF6FD;border-radius:14px;padding:16px 0;text-align:center">${code}</div>
<p style="font-size:13px;color:#8a93a8;margin:24px 0 0">If you didn't sign up for Femata, you can ignore this email.</p>
</div>`,
  })
}
