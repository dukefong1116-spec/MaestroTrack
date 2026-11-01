import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  verifyBeforeUpdateEmail,
} from 'firebase/auth'
import { auth } from './config'

/**
 * Changing the things you sign in with.
 *
 * Both of these are "recent login required" operations: Firebase refuses
 * them on a session that has been sitting around, however valid the token
 * is. So both re-authenticate first with the current password, which is
 * also the check that the person at the keyboard is the account's owner
 * rather than someone who found it unlocked.
 */

async function reauthenticate(currentPassword: string) {
  const user = auth.currentUser
  if (!user?.email) throw new Error('You are not signed in.')
  const credential = EmailAuthProvider.credential(user.email, currentPassword)
  await reauthenticateWithCredential(user, credential)
  return user
}

export async function changePassword(currentPassword: string, nextPassword: string): Promise<void> {
  const user = await reauthenticate(currentPassword)
  await updatePassword(user, nextPassword)
}

/**
 * Sends a confirmation link to the NEW address; the change lands only when
 * it is opened.
 *
 * Not `updateEmail`, which Firebase disables for any project with email
 * enumeration protection on — it fails with `auth/operation-not-allowed`
 * and no hint that the alternative exists. This way also means a typo in
 * the new address cannot lock someone out of their own account: the old
 * one keeps working until the new one is proven.
 */
export async function changeEmail(currentPassword: string, nextEmail: string): Promise<void> {
  const user = await reauthenticate(currentPassword)
  if (user.email?.toLowerCase() === nextEmail.trim().toLowerCase()) {
    throw new Error('That is already your email address.')
  }
  await verifyBeforeUpdateEmail(user, nextEmail.trim())
}

/**
 * Firebase's codes, in words. Anything unrecognised falls through to the
 * raw message rather than a shrug — an unmapped failure that says
 * "something went wrong" is worse than one that says too much.
 */
export function authErrorMessage(e: unknown): string {
  const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : ''
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'That current password is not right.'
    case 'auth/weak-password':
      return 'That password is too weak — use at least 8 characters.'
    case 'auth/email-already-in-use':
      return 'Another account already uses that email address.'
    case 'auth/invalid-email':
      return 'That does not look like an email address.'
    case 'auth/requires-recent-login':
      return 'For security, sign out and back in, then try again.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.'
    case 'auth/network-request-failed':
      return 'No connection. Check your network and try again.'
    default:
      return e instanceof Error ? e.message : 'Something went wrong.'
  }
}
