/**
 * An invitation token held across a sign-up.
 *
 * Somebody opening a teacher's link usually has no account yet, so the
 * token has to survive the detour through sign-up and come back. Session
 * storage rather than local: it belongs to this one visit, and a token
 * left behind for a later session would send the wrong person at the
 * wrong moment into somebody else's studio.
 *
 * Its own module so the auth screens can read it without importing the
 * join page and pulling that chunk along with them.
 */
const KEY = 'maestro_pending_invite'

export function holdPendingInvite(token: string): void {
  try { sessionStorage.setItem(KEY, token) } catch { /* private mode */ }
}

/** Reads it and clears it: an invitation is followed once. */
export function takePendingInvite(): string | null {
  try {
    const token = sessionStorage.getItem(KEY)
    if (token) sessionStorage.removeItem(KEY)
    return token
  } catch {
    return null
  }
}
