import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AppErrorBoundary from '@/components/common/AppErrorBoundary'
import { reloadForUpdate } from '@/lib/utils/reloadForUpdate'

// A page's file from before a deploy failed to load: reload to get the
// new one, before React ever sees the failure. See AppErrorBoundary.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForUpdate()) event.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)

// Fetched after the first render, so it never delays the app appearing.
void import('@/lib/pwa').then((m) => m.startServiceWorker()).catch(() => {})
