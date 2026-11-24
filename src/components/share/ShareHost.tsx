import { Suspense, lazy } from 'react'
import { AnimatePresence } from 'framer-motion'
import { closeShare, useShareStore } from '@/stores/shareStore'

/** Fetched the first time something is shared, so the app's start stays light. */
const ShareStudio = lazy(() => import('./ShareStudio'))

/** The one share window, from any page: opened with openShare(). */
export default function ShareHost() {
  const request = useShareStore((s) => s.request)
  return (
    <Suspense fallback={null}>
      <AnimatePresence>{request && <ShareStudio key={request.kind + request.title} request={request} onClose={closeShare} />}</AnimatePresence>
    </Suspense>
  )
}
