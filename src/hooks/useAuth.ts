import { useEffect } from 'react'
import { onAuthChange, getUserProfile } from '@/lib/firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useAuthStore } from '@/stores/authStore'

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

async function syncProfileToFirestore(uid: string, profile: Record<string, unknown>) {
  const { uid: _uid, ...profileData } = profile
  void _uid
  try {
    await setDoc(doc(db, 'users', uid), profileData, { merge: true })
    console.log('[Auth] Profile synced to Firestore ✓', uid)
  } catch (e) {
    console.warn('[Auth] Profile sync failed:', e)
  }
}

export function useAuthInit() {
  const { setUser, setProfile, setLoading } = useAuthStore()

  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      setUser(user)
      if (user) {
        console.log('[Auth] User logged in:', user.uid)

        // 1. Try Firestore first (with timeout)
        let profile = null
        try {
          profile = await withTimeout(getUserProfile(user.uid), 5000)
          if (profile) {
            console.log('[Auth] Profile loaded from Firestore')
            // Keep localStorage fresh
            localStorage.setItem(`maestro_profile_${user.uid}`, JSON.stringify(profile))
          }
        } catch (e) {
          console.warn('[Auth] Firestore profile fetch error:', e)
        }

        // 2. Fall back to localStorage, then sync that to Firestore
        if (!profile) {
          const cached = localStorage.getItem(`maestro_profile_${user.uid}`)
          if (cached) {
            try {
              profile = JSON.parse(cached)
              console.log('[Auth] Profile loaded from localStorage, syncing to Firestore...')
              // Await this so Firestore has the doc before the user does anything
              await syncProfileToFirestore(user.uid, profile as Record<string, unknown>)
            } catch (e) {
              console.warn('[Auth] localStorage parse error:', e)
            }
          } else {
            console.warn('[Auth] No profile found anywhere for uid:', user.uid)
          }
        }

        setProfile(profile)
      } else {
        console.log('[Auth] User logged out')
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [setUser, setProfile, setLoading])
}

export function useAuth() {
  return useAuthStore()
}
