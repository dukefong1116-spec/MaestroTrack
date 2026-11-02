import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { updateUserProfile } from '@/lib/firebase/teacher'
import { applyPrefs, cachePrefs, prefsFromProfile, PREFS_VERSION, type Prefs } from '@/lib/utils/prefs'

/**
 * Read and change the display and alert preferences.
 *
 * Writes go to the profile, so they follow you to another device, and are
 * mirrored into localStorage purely so the next load can apply the theme
 * before React mounts. The local store is updated first: a preference that
 * waits on a round trip feels broken.
 */
export function usePrefs() {
  const { profile, user } = useAuth()
  const { setProfile } = useAuthStore()

  const prefs = useMemo(() => prefsFromProfile(profile), [profile])

  /**
   * On 'system', the theme can change without anything in React changing.
   * CSS follows on its own, but the instrument tints are picked in JS, so
   * this forces one re-render when the operating system flips.
   */
  const [, bump] = useState(0)
  useEffect(() => {
    if (prefs.theme !== 'system' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => { applyPrefs(prefs); bump((n) => n + 1) }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [prefs])

  // Keep the document in step with whatever the profile says — including
  // the first load after signing in, when the cached guess may have been
  // wrong, and after signing in as somebody else.
  useEffect(() => {
    applyPrefs(prefs)
    cachePrefs(prefs)
  }, [prefs])

  type PrefPatch = Partial<Omit<Prefs, 'notify'>> & { notify?: Partial<Prefs['notify']> }

  const set = useCallback(async (patch: PrefPatch) => {
    const uid = profile?.uid ?? user?.uid
    const next = { ...prefs, ...patch, notify: { ...prefs.notify, ...(patch.notify ?? {}) } }

    // Apply and cache before the write: the effect above will run again
    // when the profile lands, but the control should not wait for it.
    applyPrefs(next)
    cachePrefs(next)

    if (profile) {
      setProfile({ ...profile, ...patch, notify: next.notify, prefsVersion: PREFS_VERSION, updatedAt: new Date().toISOString() })
    }
    if (!uid) return
    try {
      // The marker goes with every write: from here on the stored theme is
      // a choice, not the default signup happened to leave behind.
      await updateUserProfile(uid, { ...patch, prefsVersion: PREFS_VERSION } as Record<string, unknown>)
    } catch (e) {
      console.error('[prefs] could not save', e)
    }
  }, [prefs, profile, user?.uid, setProfile])

  return { prefs, set }
}
