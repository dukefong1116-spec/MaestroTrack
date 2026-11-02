import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { logOut } from '@/lib/firebase/auth'

/**
 * Signing out, with a question first.
 *
 * There are two Log Out buttons — the sidebar's and the one at the foot of
 * Settings on a phone — and they look nothing alike, so a shared button
 * would not have fitted either. The behaviour is shared instead: this owns
 * the asking, the signing out and the redirect, and each caller supplies
 * only its own trigger and renders the sheet the matching hook returns.
 *
 * Signing out is cheap to undo — you log back in — but it is not cheap to
 * notice: on a phone the button sits a thumb's width from Settings rows
 * people do mean to press, and the only signal that it worked is the
 * screen you were reading disappearing.
 */
export function useLogOutConfirm() {
  const navigate = useNavigate()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)

  const ask = useCallback(() => setAsking(true), [])
  const cancel = useCallback(() => setAsking(false), [])

  const confirm = useCallback(async () => {
    setBusy(true)
    try {
      await logOut()
      navigate('/login')
    } finally {
      // Cleared either way: a sign-out that failed leaves you signed in,
      // and a sheet stuck on "Signing out…" would say otherwise.
      setBusy(false)
      setAsking(false)
    }
  }, [navigate])

  return { asking, busy, ask, cancel, confirm }
}
