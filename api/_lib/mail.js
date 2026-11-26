/**
 * Email from help@femataus.com, through Resend (RESEND_API_KEY, set in
 * Vercel). Used for sign-up codes and for feedback sent to us.
 */
import { HttpError } from './admin.js'

export const HELP_EMAIL = 'help@femataus.com'

export async function sendMail({ to, subject, text, html, replyTo }) {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new HttpError(500, 'Email is not configured on the server yet.')
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: `Femata <${HELP_EMAIL}>`, to: [to], subject, text, ...(html ? { html } : {}), ...(replyTo ? { reply_to: replyTo } : {}) }),
  })
  if (!r.ok) {
    console.error('[mail] Resend', r.status, await r.text().catch(() => ''))
    throw new HttpError(502, 'The email could not be sent. Try again.')
  }
}
