import { clearSnapshots } from '@/lib/cache/snapshot'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  type User,
  type UserCredential,
} from 'firebase/auth'
import { registerPlugin } from '@capacitor/core'
import { isNativeApp } from '@/lib/native'
import { doc, setDoc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './config'
import { cleanForFirestore } from './clean'
import type { UserProfile, UserRole, InstrumentType, ExperienceLevel } from '@/types'
import { unregisterDevice } from '@/lib/notify/push'

type NewAccountOptions = {
    instrument?: InstrumentType
    experienceLevel?: ExperienceLevel
    weeklyGoalMinutes?: number
    /** From the first-run setup's "how long": the day's goal itself, rather
     *  than a seventh of the week's. */
    dailyGoalMinutes?: number
    studioName?: string
    /** More of the first-run setup's answers (instrumentName, instruments,
     *  practiceDaysPerWeek). */
    extra?: Pick<UserProfile, 'instrumentName' | 'instruments' | 'practiceDaysPerWeek'>
    /** Required confirmation from every account-creation path. */
    legalAccepted?: boolean
}

const LEGAL_REQUIRED = 'Please agree to the Terms and acknowledge the Privacy Notice before creating an account.'

/**
 * An account being made right now. The auth listener (useAuth) sees the new
 * sign-in before its profile is written; while this is set it waits for
 * the profile instead of rebuilding a default one over it.
 */
let creating: Promise<unknown> | null = null
export const accountInFlight = () => creating
function inFlight<T>(run: () => Promise<T>): Promise<T> {
  const p = run()
  creating = p
  p.catch(() => {}).finally(() => { if (creating === p) creating = null })
  return p
}

export async function signUp(
  email: string,
  password: string,
  displayName: string,
  role: UserRole,
  options: NewAccountOptions = {}
): Promise<User> {
  if (options.legalAccepted !== true) throw new Error(LEGAL_REQUIRED)
  return inFlight(async () => {
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(credential.user, { displayName })
    await writeNewProfile(credential.user, email, displayName, role, options)
    // The address is confirmed with a 6-digit code (EmailCodeScreen), sent
    // when the app first opens behind this sign-up.
    return credential.user
  })
}

/** The profile of a brand-new account, from the setup's answers. */
async function writeNewProfile(user: User, email: string, displayName: string, role: UserRole, options: NewAccountOptions): Promise<void> {
  const profile: Omit<UserProfile, 'uid'> = {
    email,
    role,
    displayName,
    legalAcceptance: {
      termsVersion: 'prelaunch-2026-11-24',
      privacyVersion: 'prelaunch-2026-11-24',
      acceptedAt: new Date().toISOString(),
    },
    instrument: options.instrument,
    experienceLevel: options.experienceLevel,
    weeklyGoalMinutes: options.weeklyGoalMinutes ?? 300,
    dailyGoalMinutes: options.dailyGoalMinutes ?? Math.round((options.weeklyGoalMinutes ?? 300) / 7),
    monthlyGoalMinutes: (options.weeklyGoalMinutes ?? 300) * 4,
    studioName: options.studioName,
    reminderEnabled: false,
    theme: 'light',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // The first-run tour starts here, and only here: an account made
    // before it existed never has this, so it is never marched through it.
    ...(role === 'student' ? { onboarding: { tour: 'welcome' as const } } : {}),
    ...options.extra,
  }

  // Cache profile locally so the app works even if Firestore is offline
  localStorage.setItem(`maestro_profile_${user.uid}`, JSON.stringify({ uid: user.uid, ...profile }))

  const cleanProfile = Object.fromEntries(Object.entries(profile).filter(([, v]) => v !== undefined))
  try {
    await setDoc(doc(db, 'users', user.uid), cleanProfile)
  } catch (e) {
    console.error('[Signup] Firestore profile write failed:', e)
    throw new Error('Account created but profile could not be saved to the database. Please try signing in — if that fails, contact support.')
  }
}

export type SocialProvider = 'google' | 'apple'
const env = import.meta.env

/**
 * Which of Google and Apple are switched on. Each needs setting up outside
 * the code first (Firebase's sign-in methods; for Apple, the paid Apple
 * Developer Program), so each stays hidden until its variable is set.
 * The iPhone app also needs Google's iOS client ID. Both show under the
 * emulator, whose sign-in accepts any provider.
 */
export const socialProviders: Record<SocialProvider, boolean> = {
  google: env.VITE_USE_EMULATOR === '1' || (env.VITE_GOOGLE_SIGN_IN === '1' && (!isNativeApp || !!env.VITE_GOOGLE_IOS_CLIENT_ID)),
  apple: env.VITE_USE_EMULATOR === '1' || env.VITE_APPLE_SIGN_IN === '1',
}

/** Google and Apple's own sign-in sheets in the iPhone app (FemataSignInPlugin). */
const NativeSignIn = registerPlugin<{
  google(o: { clientId: string }): Promise<{ idToken: string }>
  apple(o: { nonce: string }): Promise<{ idToken: string }>
}>('FemataSignIn')

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** A web pop-up on the website; the system's own sheet in the app, where pop-ups cannot open. */
async function socialCredential(p: SocialProvider): Promise<UserCredential> {
  if (isNativeApp) {
    if (p === 'google') {
      const { idToken } = await NativeSignIn.google({ clientId: String(env.VITE_GOOGLE_IOS_CLIENT_ID ?? '') })
      return signInWithCredential(auth, GoogleAuthProvider.credential(idToken))
    }
    const rawNonce = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('')
    const { idToken } = await NativeSignIn.apple({ nonce: await sha256Hex(rawNonce) })
    return signInWithCredential(auth, new OAuthProvider('apple.com').credential({ idToken, rawNonce }))
  }
  if (p === 'google') {
    const google = new GoogleAuthProvider()
    google.setCustomParameters({ prompt: 'select_account' })
    return signInWithPopup(auth, google)
  }
  const apple = new OAuthProvider('apple.com')
  apple.addScope('email')
  apple.addScope('name')
  return signInWithPopup(auth, apple)
}

/**
 * Make the account with Google or Apple, at the end of the setup. If that
 * Google or Apple account already has a Femata account, it is simply
 * signed in (existing), and nothing of it is changed.
 */
export async function socialSignUp(p: SocialProvider, displayName: string, role: UserRole, options: NewAccountOptions = {}): Promise<{ user: User; existing: boolean }> {
  if (options.legalAccepted !== true) throw new Error(LEGAL_REQUIRED)
  return inFlight(async () => {
    const { user } = await socialCredential(p)
    if (await getUserProfile(user.uid)) return { user, existing: true }
    const name = displayName.trim() || user.displayName || 'Musician'
    if (!user.displayName) await updateProfile(user, { displayName: name }).catch(() => {})
    await writeNewProfile(user, user.email ?? '', name, role, options)
    return { user, existing: false }
  })
}

/**
 * Log in with Google or Apple — only to an account that exists. Anyone
 * else is sent to Get started (age check, Terms, setup), and the empty
 * sign-in that Firebase just made for them is removed again.
 */
export async function socialSignIn(p: SocialProvider): Promise<User> {
  return inFlight(async () => {
    const { user } = await socialCredential(p)
    if (await getUserProfile(user.uid)) return user
    await user.delete().catch(() => signOut(auth))
    throw new Error(`There's no Femata account for this ${p === 'google' ? 'Google' : 'Apple'} account yet. Tap Get started to make one.`)
  })
}

/** What to tell the person when Google or Apple sign-in fails ('' when they just closed it). */
export function socialError(e: unknown): string {
  const code = String((e as { code?: string })?.code ?? '')
  const msg = String((e as { message?: string })?.message ?? '')
  if (/popup-closed|cancelled-popup|cancel/i.test(code + msg)) return ''
  if (code === 'auth/popup-blocked') return 'Your browser blocked the sign-in window. Allow pop-ups and try again.'
  if (code === 'auth/account-exists-with-different-credential') return 'This email already uses another sign-in method. Log in with that instead.'
  if (code === 'auth/operation-not-allowed') return 'This sign-in method is not switched on yet.'
  return code ? 'Sign-in did not work. Try again.' : msg || 'Sign-in did not work. Try again.'
}

/** Sends the signed-in person a link confirming their email address. */
export async function sendVerificationEmail(): Promise<void> {
  await auth.authStateReady()
  if (!auth.currentUser) throw new Error('You are not signed in.')
  await sendEmailVerification(auth.currentUser)
}

/** Rebuilds a missing profile through the same service boundary as other writes. */
export async function saveRebuiltProfile(profile: UserProfile): Promise<void> {
  await setDoc(doc(db, 'users', profile.uid), cleanForFirestore(profile))
}

/**
 * Sign in. `remember` (the login page's Remember me) keeps you signed in
 * on this device until you log out; without it the sign-in lasts until
 * the browser is closed, and next time the start page asks "Is this you?".
 */
export async function signIn(email: string, password: string, remember = true): Promise<User> {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence).catch(() => {})
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function logOut(): Promise<void> {
  // While still signed in: this device stops getting this account's pushes.
  await unregisterDevice().catch(() => {})
  await signOut(auth)
  // The saved copy of your data goes with you (see lib/cache/snapshot),
  // and the next open starts at the login page.
  try { localStorage.removeItem('maestro_last_uid') } catch { /* unavailable */ }
  await clearSnapshots()
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email)
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return { uid, ...snap.data() } as UserProfile
}

/**
 * Watch your own profile, rather than reading it once at sign-in.
 *
 * It used to be a single read, which was fine while nothing but you could
 * change it. Accepting a student broke that: the teacher writes teacherId
 * onto the student's document, and the student's app had no way of
 * hearing about it — they sat on "waiting on your teacher" until they
 * signed out and back in.
 *
 * Latency compensation means the optimistic setProfile calls elsewhere
 * still show instantly; the snapshot simply confirms them.
 */
export function subscribeUserProfile(
  uid: string,
  onChange: (profile: UserProfile) => void
): () => void {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => { if (snap.exists()) onChange({ uid, ...snap.data() } as UserProfile) },
    (e) => console.error('[Auth] profile subscription failed', e)
  )
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}

export { serverTimestamp }
