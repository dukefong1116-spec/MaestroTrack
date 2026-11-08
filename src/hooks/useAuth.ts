import { useEffect } from 'react'
import { onAuthChange, getUserProfile, saveRebuiltProfile } from '@/lib/firebase/auth'
import { useAuthStore } from '@/stores/authStore'

export function useAuthInit() {
  const { setUser, setProfile, setLoading } = useAuthStore()

  useEffect(() => {
    let generation = 0
    const unsub = onAuthChange(async (user) => {
      const currentGeneration = ++generation
      setLoading(true)
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
              // Firestore rejects the entire document for a single
              // undefined field, and most of these are optional: a profile
              // with no instrument set failed to save at all, silently.
              await saveRebuiltProfile(rebuilt)
              console.log('[Auth] Rebuilt Firestore doc with role:', role)
            } catch (writeErr) {
              console.error('[Auth] Failed to write rebuilt profile:', writeErr)
            }
            profile = rebuilt
          }
          if (currentGeneration !== generation) return
          localStorage.setItem(`maestro_profile_${user.uid}`, JSON.stringify(profile))
          localStorage.setItem(`maestro_role_${user.uid}`, profile.role)
          if (currentGeneration === generation) setProfile(profile)
        } catch (e) {
          console.error('[Auth] Failed to load Firestore profile:', e)
          if (currentGeneration === generation) setProfile(null)
        } finally {
          if (currentGeneration === generation) setLoading(false)
        }
      } else {
        if (currentGeneration === generation) {
          setProfile(null)
          setLoading(false)
        }
      }
    })
    return unsub
  }, [setUser, setProfile, setLoading])
}

export function useAuth() {
  return useAuthStore()
}
