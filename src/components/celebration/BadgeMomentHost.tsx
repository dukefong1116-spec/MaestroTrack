import { useEffect, useState } from 'react'
import BadgeMoment from './BadgeMoment'
import { useGamification } from '@/hooks/useGamification'
import { useMomentStore } from '@/stores/momentStore'

/**
 * The badge unlock, from any page, the moment a badge is won — marking a
 * piece mastered in the Library, saving a first recording, finishing a
 * session. It used to live on Today, so a badge waited there until you
 * next opened it.
 *
 * Waits only while another celebration has the screen (the session's own
 * moments), then shows; once showing it stays until dismissed.
 */
export default function BadgeMomentHost() {
  const game = useGamification()
  const busy = useMomentStore((s) => s.open)
  const [showing, setShowing] = useState(false)
  const badge = game.pendingBadge

  useEffect(() => {
    if (badge && !showing && busy === 0) setShowing(true)
    if (!badge && showing) setShowing(false)
  }, [badge, showing, busy])

  return (
    <BadgeMoment
      badge={badge ? { id: badge.id, label: badge.label, description: badge.description } : null}
      open={showing && !!badge}
      onDismiss={() => { setShowing(false); game.dismissBadge() }}
    />
  )
}
