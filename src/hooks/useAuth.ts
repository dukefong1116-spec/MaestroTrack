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
          let profile = await getUserProfile(user.uid)
          console.log('[Auth] Firestore profile:', profile)
          if (!profile) {
            // No Firestore doc — reconstruct from localStorage cache and write it
            console.warn('[Auth] No Firestore doc for uid:', user.uid, '— creating from cache')
            let cached: Partial<import('@/types').UserProfile> = {}
            try {
              const raw = localStorage.getItem(`maestro_profile_${user.uid}`)
              if (raw) cached = JSON.parse(raw)
            } catch { /* ignore */ }
            const role = cached.role ?? (localStorage.getItem(`maestro_role_${user.uid}`) as import('@/types').UserRole | null) ?? 'student'
            const now = new Date().toISOString()
            const rebuilt: import('@/types').UserProfile = {
              uid: user.uid,
              email: user.email ?? '',
              displayName: cached.displayName ?? user.displayName ?? '',
              role,
              instrument: cached.instrument,
              experienceLevel: cached.experienceLevel,
              weeklyGoalMinutes: cached.weeklyGoalMinutes ?? 300,
              dailyGoalMinutes: cached.dailyGoalMinutes ?? 43,
              monthlyGoalMinutes: cached.monthlyGoalMinutes ?? 1200,
              studioCode: cached.studioCode,
              studioName: cached.studioName,
              teacherId: cached.teacherId,
              reminderEnabled: cached.reminderEnabled ?? false,
              theme: cached.theme ?? 'dark',
              createdAt: cached.createdAt ?? now,
              updatedAt: now,
            }
            try {
              const { doc, setDoc } = await import('firebase/firestore')
              const { db } = await import('@/lib/firebase/config')
              await setDoc(doc(db, 'users', user.uid), rebuilt)
              console.log('[Auth] Rebuilt Firestore doc with role:', role)
            } catch (writeErr) {
              console.error('[Auth] Failed to write rebuilt profile:', writeErr)
            }
            profile = rebuilt
          }
          localStorage.setItem(`maestro_profile_${user.uid}`, JSON.stringify(profile))
          localStorage.setItem(`maestro_role_${user.uid}`, profile.role)
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
