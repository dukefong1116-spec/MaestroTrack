/**
 * POST /api/feedback — what someone wrote in Settings → Send feedback,
 * emailed to help@femataus.com with a reply going straight back to them.
 * Body: { message }. Signed-in people only, a few an hour.
 */
import { handler, callerUid, jsonBody, HttpError, db, adminAuth, usingEmulator } from './_lib/admin.js'
import { sendMail, HELP_EMAIL } from './_lib/mail.js'

const PER_HOUR = 5
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export default handler(async (req) => {
  const uid = await callerUid(req)
  const { message, platform } = await jsonBody(req)
  const text = typeof message === 'string' ? message.trim() : ''
  if (text.length < 3) throw new HttpError(400, 'Write a little more first.')
  if (text.length > 4000) throw new HttpError(400, 'That is too long. Keep it under 4,000 characters.')

  const now = Date.now()
  const ref = db().doc(`feedbackLimits/${uid}`)
  const sends = ((await ref.get()).get('sends') ?? []).filter((t) => now - t < 3_600_000)
  if (sends.length >= PER_HOUR) throw new HttpError(429, 'Thanks — you have sent a lot just now. Try again later.')
  await ref.set({ sends: [...sends, now] })

  const [user, profile] = await Promise.all([adminAuth().getUser(uid), db().doc(`users/${uid}`).get()])
  const name = profile.get('displayName') || user.displayName || 'Someone'
  const role = profile.get('role') || 'unknown'
  const where = typeof platform === 'string' ? platform.slice(0, 40) : 'unknown'
  if (usingEmulator) return { sent: true }
  await sendMail({
    to: HELP_EMAIL,
    replyTo: user.email || undefined,
    subject: `Feedback from ${name} (${role})`,
    text: `${text}\n\n—\n${name} · ${user.email ?? 'no email'} · ${role} · ${where}\nuid ${uid}`,
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#0E1626;white-space:pre-wrap">${esc(text)}</div>
<p style="font-family:-apple-system,sans-serif;font-size:12px;color:#8a93a8;margin-top:24px">${esc(name)} · ${esc(user.email ?? 'no email')} · ${esc(role)} · ${esc(where)}<br>uid ${esc(uid)}</p>`,
  })
  return { sent: true }
})
