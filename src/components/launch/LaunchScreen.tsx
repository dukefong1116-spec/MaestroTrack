import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { isBootReady, bootFinished } from '@/lib/boot'
import { auth } from '@/lib/firebase/config'
import { nativeLaunchDone } from '@/lib/nativeGlass'

/** Never less than this on screen (from the app opening), so the blink reads. */
const MIN_MS = 1100
/** Never more than this, whatever is still loading. */
const MAX_MS = 7000

/**
 * Plays out the launch screen painted by index.html (#boot): Femata blinks
 * there until the first page is drawn, then hops twice and the screen zooms
 * through into the app. Renders nothing itself.
 *
 * Ready means: signed out, and the sign-in check is done (the front door
 * draws at once); or signed in, and the page has drawn (AppLayout says so,
 * or any page outside it that has mounted).
 */
export default function LaunchScreen() {
  const loading = useAuthStore((s) => s.loading)
  const user = useAuthStore((s) => s.user)
  const { pathname } = useLocation()
  const started = useRef(false)
  // The app's own loading flag can clear before a saved sign-in has been
  // read back; Firebase's own "ready" is the one to trust here.
  const [authSettled, setAuthSettled] = useState(false)
  useEffect(() => {
    let live = true
    void auth.authStateReady().catch(() => {}).then(() => { if (live) setAuthSettled(true) })
    return () => { live = false }
  }, [])

  useEffect(() => {
    const boot = document.getElementById('boot')
    if (!boot || started.current) return
    // Pages inside AppLayout report their own first draw; anything else is
    // drawn as soon as the sign-in check is over.
    const inLayout = /^\/(student|teacher)(\/|$)/.test(pathname)
      && !/^\/student\/(session|studio\/messages|studio\/assignments)/.test(pathname)
    const go = () => {
      if (started.current) return
      started.current = true
      const wait = Math.max(0, MIN_MS - performance.now())
      setTimeout(() => {
        boot.classList.add('hop')
        setTimeout(() => {
          boot.classList.add('zoom')
          bootFinished()
          boot.style.pointerEvents = 'none'
          setTimeout(() => {
            boot.remove()
            bootFinished()
            nativeLaunchDone()
          }, 520)
        }, 880)
      }, wait)
    }
    const cap = setTimeout(go, Math.max(0, MAX_MS - performance.now()))
    const onReady = () => go()
    window.addEventListener('femata:ready', onReady)
    // Signed in and on the way home ('/' and /start forward there): wait for it.
    const headingHome = !!user && (inLayout || pathname === '/' || pathname === '/start')
    if (isBootReady() || (authSettled && !loading && !headingHome)) {
      requestAnimationFrame(() => requestAnimationFrame(go))
    }
    return () => { clearTimeout(cap); window.removeEventListener('femata:ready', onReady) }
  }, [loading, user, pathname, authSettled])

  return null
}
