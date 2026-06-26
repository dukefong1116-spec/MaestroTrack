import { useEffect } from 'react'
import { onAuthChange, getUserProfile } from '@/lib/firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useAuthStore } from '@/stores/authStore'
import type { UserProfile } from '@/types'

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

// Repair a profile that is missing required fields.
// Returns the repaired profile (or the original if nothing was missing).
function repairProfile(profile: UserProfile, uid: string): { profile: UserProfile; repaired: boolean } {
  const fixes: Partial<UserProfile> = {}

  // If role is missing, recover from the dedicated role key set at signup
  if (!profile.role) {
    const cachedRole = localStorage.getItem(`maestro_role_${uid}`)
    if (cachedRole === 'student' || cachedRole === 'teacher') {
      console.log('[Auth] Repairing missing role →', cachedRole)
      fixes.role = cachedRole
    }
  }

  if (Object.keys(fixes).length === 0) return { profile, repaired: false }
  return { profile: { ...profile, ...fixes }, repaired: true }
}

export function useAuthInit() {
  const { setUser, setProfile, setLoading } = useAuthStore()

  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      setUser(user)
      if (user) {
        console.log('[Auth] User logged in:', user.uid)

        // 1. Try Firestore (3-second timeout so the app loads fast)
        let profile: UserProfile | null = null
        try {
          profile = await withTimeout(getUserProfile(user.uid), 3000)
          if (profile) {
            console.log('[Auth] Profile loaded from Firestore:', profile)
            localStorage.setItem(`maestro_profile_${user.uid}`, JSON.stringify(profile))
          }
        } catch (e) {
          console.warn('[Auth] Firestore fetch error:', e)
        }

        // 2. Fall back to localStorage
        if (!profile) {
          const cached = localStorage.getItem(`maestro_profile_${user.uid}`)
          if (cached) {
            try {
              profile = JSON.parse(cached) as UserProfile
              console.log('[Auth] Profile loaded from localStorage:', profile)
            } catch { /* ignore */ }
          }
        }

        // 3. Repair missing fields (role especially)
        if (profile) {
          const { profile: repaired, repaired: didRepair } = repairProfile(profile, user.uid)
          if (didRepair) {
            profile = repaired
            console.log('[Auth] Profile repaired:', profile)
            localStorage.setItem(`maestro_profile_${user.uid}`, JSON.stringify(profile))
          }
        }

        setProfile(profile)
        setLoading(false)

        // 4. Sync repaired profile to Firestore in background
        if (profile) {
          const { uid: _uid, ...profileData } = profile as Record<string, unknown>
          void _uid
          setDoc(doc(db, 'users', user.uid), profileData, { merge: true })
            .then(() => console.log('[Auth] Profile synced to Firestore ✓'))
            .catch((e) => console.warn('[Auth] Profile sync failed:', e))
        } else {
          console.warn('[Auth] No profile found for uid:', user.uid)
        }
      } else {
        console.log('[Auth] User logged out')
        setProfile(null)
        setLoading(false)
      }
    })
    return unsub
  }, [setUser, setProfile, setLoading])
}

export function useAuth() {
  return useAuthStore()
}
