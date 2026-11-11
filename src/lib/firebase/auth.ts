import { clearSnapshots } from '@/lib/cache/snapshot'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { doc, setDoc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './config'
import { cleanForFirestore } from './clean'
import type { UserProfile, UserRole, InstrumentType, ExperienceLevel } from '@/types'

export async function signUp(
  email: string,
  password: string,
  displayName: string,
  role: UserRole,
  options: {
    instrument?: InstrumentType
    experienceLevel?: ExperienceLevel
    weeklyGoalMinutes?: number
    studioName?: string
  } = {}
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(credential.user, { displayName })

  const profile: Omit<UserProfile, 'uid'> = {
    email,
    role,
    displayName,
    instrument: options.instrument,
    experienceLevel: options.experienceLevel,
    weeklyGoalMinutes: options.weeklyGoalMinutes ?? 300,
    dailyGoalMinutes: Math.round((options.weeklyGoalMinutes ?? 300) / 7),
    monthlyGoalMinutes: (options.weeklyGoalMinutes ?? 300) * 4,
    studioName: options.studioName,
    reminderEnabled: false,
    theme: 'light',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // The first-run tour starts here, and only here: an account made
    // before it existed never has this, so it is never marched through it.
    ...(role === 'student' ? { onboarding: { tour: 'welcome' as const } } : {}),
  }

  // Cache profile locally so the app works even if Firestore is offline
  localStorage.setItem(`maestro_profile_${credential.user.uid}`, JSON.stringify({ uid: credential.user.uid, ...profile }))

  const cleanProfile = Object.fromEntries(Object.entries(profile).filter(([, v]) => v !== undefined))
  try {
    await setDoc(doc(db, 'users', credential.user.uid), cleanProfile)
  } catch (e) {
    console.error('[Signup] Firestore profile write failed:', e)
    throw new Error('Account created but profile could not be saved to the database. Please try signing in — if that fails, contact support.')
  }
  return credential.user
}

/** Rebuilds a missing profile through the same service boundary as other writes. */
export async function saveRebuiltProfile(profile: UserProfile): Promise<void> {
  await setDoc(doc(db, 'users', profile.uid), cleanForFirestore(profile))
}

export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function logOut(): Promise<void> {
  await signOut(auth)
  // The saved copy of Today goes with you (see lib/cache/snapshot).
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
