import { Suspense, lazy, useEffect, useState } from 'react'
import { useGamification } from '@/hooks/useGamification'
import { useMomentStore } from '@/stores/momentStore'
import { useAuth } from '@/hooks/useAuth'
import { openShare } from '@/stores/shareStore'
import { badgeShare } from '@/lib/share/moments'

/**
 * The badge unlock, from any page, the moment a badge is won — marking a
 * piece mastered in the Library, saving a first recording, finishing a
 * session. It used to live on Today, so a badge waited there until you
 * next opened it.
 *
 * Waits only while another celebration has the screen (the session's own
 * moments), then shows; once showing it stays until dismissed.
 */
/** The animation and its artwork arrive only when there is a badge to show. */
const BadgeMoment = lazy(() => import('./BadgeMoment'))

export default function BadgeMomentHost() {
  const game = useGamification()
  const { profile } = useAuth()
  const busy = useMomentStore((s) => s.open)
  const [showing, setShowing] = useState(false)
  const badge = game.pendingBadge

  useEffect(() => {
    if (badge && !showing && busy === 0) setShowing(true)
    if (!badge && showing) setShowing(false)
  }, [badge, showing, busy])

  // Once loaded it stays mounted, so dismissing still plays the exit.
  const [wanted, setWanted] = useState(false)
  useEffect(() => { if (badge) setWanted(true) }, [badge])
  if (!badge && !wanted) return null
  return (
    <Suspense fallback={null}>
    <BadgeMoment
      badge={badge ? { id: badge.id, label: badge.label, description: badge.description } : null}
      open={showing && !!badge}
      onDismiss={() => { setShowing(false); game.dismissBadge() }}
      onShare={badge ? () => {
        const b = { id: badge.id, label: badge.label, description: badge.description }
        setShowing(false)
        game.dismissBadge()
        openShare(badgeShare(b, new Date().toISOString(), profile?.displayName))
      } : undefined}
    />
    </Suspense>
  )
}
