import type { MouseEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * A back arrow's click: step back to the page you came from, rather than
 * open the parent again. Opening it again left this page behind it, so the
 * parent's own back arrow came straight back here, round and round. Only
 * an app opened on this page (no earlier page) goes to `fallback`,
 * replacing this entry.
 */
export function useStepBack(fallback: string) {
  const navigate = useNavigate()
  const location = useLocation()
  return (e: MouseEvent) => {
    e.preventDefault()
    // A page reached through a fallback has nothing earlier in the app
    // either, so it falls back too rather than step out of the app.
    const first = location.key === 'default' || (location.state as { stepBackFallback?: boolean } | null)?.stepBackFallback
    if (!first) navigate(-1)
    else navigate(fallback, { replace: true, state: { stepBackFallback: true } })
  }
}
