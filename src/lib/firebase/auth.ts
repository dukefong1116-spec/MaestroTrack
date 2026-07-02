import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './config'
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

  const studioCode =
    role === 'teacher' ? Math.random().toString(36).substring(2, 8).toUpperCase() : undefined

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
    studioCode,
    reminderEnabled: false,
    theme: 'dark',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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

export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function logOut(): Promise<void> {
  await signOut(auth)
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email)
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return { uid, ...snap.data() } as UserProfile
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}

export { serverTimestamp }
