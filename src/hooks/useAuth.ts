import { useEffect } from 'react'
import { onAuthChange, getUserProfile } from '@/lib/firebase/auth'
import { useAuthStore } from '@/stores/authStore'

export function useAuthInit() {
  const { setUser, setProfile, setLoading } = useAuthStore()

  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      setUser(user)
      if (user) {
        try {
          const profile = await getUserProfile(user.uid)
          console.log('[Auth] Firestore profile:', profile)
          if (profile) {
            // Cache for faster subsequent loads (read-only cache, not source of truth)
            localStorage.setItem(`maestro_profile_${user.uid}`, JSON.stringify(profile))
          } else {
            console.error('[Auth] No Firestore profile for uid:', user.uid)
          }
          setProfile(profile)
        } catch (e) {
          console.error('[Auth] Failed to load Firestore profile:', e)
          setProfile(null)
        } finally {
          setLoading(false)
        }
      } else {
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
