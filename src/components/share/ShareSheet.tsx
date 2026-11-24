import { useMemo } from 'react'
import { buildShareFields } from '@/lib/share/fields'
import ShareStudio from './ShareStudio'
import type { ShareRequest } from '@/stores/shareStore'
import type { PracticeSession, UserProfile } from '@/types'

/**
 * Sharing a practice session (after Finish, or from the history): the
 * share window, with the session's own card. Only what buildShareFields
 * allows leaves the device — never the notes.
 */
export default function ShareSheet({
  session, profile, streakDays, pieceTitle, week, onClose,
}: {
  session: PracticeSession
  profile: Pick<UserProfile, 'displayName'>
  streakDays: number
  pieceTitle?: string
  week?: number[]
  onClose: () => void
}) {
  const request = useMemo<ShareRequest>(() => ({
    kind: 'session',
    title: 'Share your practice',
    toggles: { name: true, streak: streakDays > 0, piece: !!pieceTitle },
    mood: 'happy',
    build: (options) => buildShareFields({ session, profile, streakDays, pieceTitle, week, options }),
  }), [session, profile, streakDays, pieceTitle, week])
  return <ShareStudio request={request} onClose={onClose} />
}
