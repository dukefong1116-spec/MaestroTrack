/**
 * Reading an invitation token out of whatever a QR scan produced.
 *
 * The inverse of `inviteUrl` in lib/firebase/invites. It lives here, away
 * from the page and away from Firebase, because it is the one piece of
 * the camera path that can be tested without a camera — and the camera
 * path cannot be exercised in development at all on a phone, where the
 * LAN address is plain http and getUserMedia is therefore unavailable.
 *
 * Forgiving on purpose. A scan can come back as the full link, as a link
 * with a query string the share sheet added, or — from some scanners —
 * as a bare token. What it must never do is accept something that merely
 * looks token-shaped and send it to Firestore as a lookup.
 */

/** base64url, as `generateInviteToken` emits: 22 characters for 16 bytes. */
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/

export function tokenFromScan(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    const match = url.pathname.match(/\/join\/([^/?#]+)$/)
    const token = match ? decodeURIComponent(match[1]) : null
    return token && TOKEN.test(token) ? token : null
  } catch {
    // Not a URL at all. A bare token is still worth a try; anything else
    // is somebody's wifi QR code and should be refused plainly.
    return TOKEN.test(trimmed) ? trimmed : null
  }
}
