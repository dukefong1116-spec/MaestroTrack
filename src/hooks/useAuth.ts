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
        // Try Firestore, fall back to localStorage cache
        let profile = null
        try {
          profile = await withTimeout(getUserProfile(user.uid), 4000)
        } catch { /* ignore */ }
        if (!profile) {
          const cached = localStorage.getItem(`maestro_profile_${user.uid}`)
          if (cached) {
            try {
              profile = JSON.parse(cached)
              // Profile was only in localStorage — sync it to Firestore now that we're connected
              const { uid, ...profileData } = profile as Record<string, unknown>
              void uid
              setDoc(doc(db, 'users', user.uid), profileData, { merge: true }).catch(() => {})
            } catch { /* ignore */ }
          }
        }
        if (profile) localStorage.setItem(`maestro_profile_${user.uid}`, JSON.stringify(profile))
        setProfile(profile)
      } else {
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
