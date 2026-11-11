import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { openingPageReady } from '@/lib/openingPage'
import AppErrorBoundary from '@/components/common/AppErrorBoundary'
import { reloadForUpdate } from '@/lib/utils/reloadForUpdate'

// A page's file from before a deploy failed to load: reload to get the
// new one, before React ever sees the failure. See AppErrorBoundary.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForUpdate()) event.preventDefault()
})

// The page being opened is already on its way (App.tsx starts it). Waiting
// for it — briefly, and only up to a limit — lets it appear in the first
// draw, instead of after a spinner and React's reveal pause. (A promise,
// not a top-level await: that made the bundler split startup into three
// times as many files.)
void Promise.race([openingPageReady(), new Promise((r) => setTimeout(r, 1500))]).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </StrictMode>,
  )
})

// Fetched after the first render, so it never delays the app appearing.
void import('@/lib/pwa').then((m) => m.startServiceWorker()).catch(() => {})
