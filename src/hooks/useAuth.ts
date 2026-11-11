import { useEffect } from 'react'
import { onAuthChange, getUserProfile, saveRebuiltProfile, subscribeUserProfile } from '@/lib/firebase/auth'
import { useAuthStore } from '@/stores/authStore'
import { markOpen } from '@/lib/utils/openTimes'
import { clearSnapshots } from '@/lib/cache/snapshot'

/** Who was last signed in on this device. Removed on signing out. */
export const LAST_UID = 'maestro_last_uid'

export function useAuthInit() {
  const { setUser, setProfile, setLoading, setProfileLive, setProvisional } = useAuthStore()

  useEffect(() => {
    let generation = 0
    // Torn down and replaced whenever the signed-in account changes, so a
    // sign-out never leaves somebody's profile still being watched.
    let unsubProfile: (() => void) | null = null
    const dropProfileWatch = () => { unsubProfile?.(); unsubProfile = null }

    // Whoever was last signed in here, drawn before Firebase has said a
    // word: on a phone, finding out means reading Safari's slow local
    // storage, and everything used to wait for it. Nothing writes on its
    // own until the server's copy of the profile is in (profileLive), and
    // if Firebase says nobody is signed in, this ends at the login page.
    const early = readLastUid()
    const earlyProfile = early ? savedProfile(early) : null
    if (earlyProfile) {
      setProfile(earlyProfile)
      setProvisional(true)
      setLoading(false)
    }

    const unsub = onAuthChange(async (user) => {
      const currentGeneration = ++generation
      markOpen('auth')
      dropProfileWatch()
      setProfileLive(false)
      setProvisional(false)
      const saved = user ? savedProfile(user.uid) : null
      // Only when there is nothing to show: the app stays up otherwise.
      if (!saved) setLoading(true)
      setUser(user)
      try {
        if (user) localStorage.setItem(LAST_UID, user.uid)
        else localStorage.removeItem(LAST_UID)
      } catch { /* storage unavailable: the next open just waits */ }
      // Drawn from the last account, and Firebase says nobody is signed in
      // (the session ended): what was saved goes too.
      if (!user && earlyProfile) void clearSnapshots()
      if (user) {
        // The copy saved on this device last visit, shown at once so the
        // app opens without waiting on the network. The server's copy
        // replaces it below; until then profileLive stays false and
        // nothing writes on its own.
        if (saved) {
          if (useAuthStore.getState().profile?.uid !== user.uid) setProfile(saved)
          setLoading(false)
        }
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
          if (currentGeneration === generation) {
            setProfile(profile)
            setProfileLive(true)
            markOpen('profile')
          }

          // From here it stays live. The read above is what handles a
          // missing document; this is what notices somebody else changing
          // it — which, since accepting a student is a write to *their*
          // profile, is the only way the student learns they are in.
          if (currentGeneration === generation) {
            unsubProfile = subscribeUserProfile(user.uid, (fresh) => {
              if (currentGeneration !== generation) return
              localStorage.setItem(`maestro_profile_${user.uid}`, JSON.stringify(fresh))
              localStorage.setItem(`maestro_role_${user.uid}`, fresh.role)
              setProfile(fresh)
              setProfileLive(true)
            })
          }
        } catch (e) {
          console.error('[Auth] Failed to load Firestore profile:', e)
          // Offline with a saved copy: keep showing it (still not live).
          if (currentGeneration === generation && !saved) setProfile(null)
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
    return () => {
      dropProfileWatch()
      unsub()
    }
  }, [setUser, setProfile, setLoading, setProfileLive, setProvisional])
}

function readLastUid(): string | null {
  try {
    return localStorage.getItem(LAST_UID)
  } catch {
    return null
  }
}

/** The profile saved on this device, if it is whole enough to show. */
function savedProfile(uid: string): import('@/types').UserProfile | null {
  try {
    const raw = localStorage.getItem(`maestro_profile_${uid}`)
    if (!raw) return null
    const p = JSON.parse(raw) as import('@/types').UserProfile
    return p && p.uid === uid && (p.role === 'student' || p.role === 'teacher') ? p : null
  } catch {
    return null
  }
}

export function useAuth() {
  return useAuthStore()
}
