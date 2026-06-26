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

export function useAuthInit() {
  const { setUser, setProfile, setLoading } = useAuthStore()

  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      setUser(user)
      if (user) {
        console.log('[Auth] User logged in:', user.uid)

        // 1. Try to load profile from Firestore
        let profile = null
        try {
          profile = await withTimeout(getUserProfile(user.uid), 5000)
          if (profile) console.log('[Auth] Profile loaded from Firestore:', profile)
        } catch { /* ignore */ }

        // 2. Fall back to localStorage cache
        if (!profile) {
          const cached = localStorage.getItem(`maestro_profile_${user.uid}`)
          if (cached) {
            try { profile = JSON.parse(cached) } catch { /* ignore */ }
            if (profile) console.log('[Auth] Profile loaded from localStorage cache:', profile)
          }
        }

        // 3. Sync profile to Firestore (covers both: profile from cache, and new logins)
        if (profile) {
          const { uid: _uid, ...profileData } = profile as Record<string, unknown>
          void _uid
          console.log('[Auth] Syncing profile to Firestore users/', user.uid)
          setDoc(doc(db, 'users', user.uid), profileData, { merge: true })
            .then(() => console.log('[Auth] Profile synced to Firestore ✓'))
            .catch((e) => console.warn('[Auth] Profile sync failed:', e))

          // Keep localStorage fresh
          localStorage.setItem(`maestro_profile_${user.uid}`, JSON.stringify(profile))
        } else {
          console.warn('[Auth] No profile found for user', user.uid)
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
