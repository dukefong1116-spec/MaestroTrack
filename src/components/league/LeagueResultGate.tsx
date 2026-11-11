import { Suspense, lazy } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'

/**
 * Whether the week's result is due — and only then is the reveal (its
 * trophies, animation and sounds) fetched at all, so the app's start is
 * no heavier for it.
 *
 * Due once per week: the server writes the result when your room ends,
 * and closing the reveal records that week as seen.
 */
const LeagueResultMoment = lazy(() => import('./LeagueResultMoment'))

export default function LeagueResultGate() {
  const { profile, profileLive } = useAuth()
  const location = useLocation()
  const result = profile?.league?.lastResult
  const due =
    // Judged on the server's copy of the profile, not the one saved on
    // this device, which may not know the week was already seen.
    profileLive &&
    profile?.role === 'student' &&
    !!result &&
    result.week !== profile.leagueSeen &&
    !profile.leagueOptOut &&
    // Never over the first-run tour, nor in the middle of a session.
    (!profile.onboarding?.tour || profile.onboarding.tour === 'done') &&
    !location.pathname.startsWith('/student/session')

  return (
    <Suspense fallback={null}>
      <AnimatePresence>{due && result && <LeagueResultMoment key={result.week} result={result} />}</AnimatePresence>
    </Suspense>
  )
}
