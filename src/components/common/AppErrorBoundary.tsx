import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isStaleChunk, reloadForUpdate } from '@/lib/utils/reloadForUpdate'

/**
 * What happens when the app breaks, instead of a blank page.
 *
 * Every page is loaded on demand, under a file name that changes with each
 * deploy. A tab opened before a deploy still asks for the old names, which
 * no longer exist — and React, with nothing to catch the failed load,
 * unmounted the whole app and left only the background colour. A reload
 * fetches the new names and is all it ever needed, so that case reloads
 * by itself, once. Anything else shows a way out rather than nothing.
 */

export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (isStaleChunk(error) && reloadForUpdate()) return
    console.error('[app] crashed', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)', fontFamily: 'var(--clay-font)' }}
      >
        <p className="text-[17px] font-semibold">Something went wrong</p>
        <p className="max-w-xs text-[14px]" style={{ color: 'var(--clay-dim)' }}>
          Reloading usually fixes it. Nothing you saved is lost.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-6 py-3 text-[15px] font-semibold"
          style={{ background: 'var(--clay-accent)', color: 'var(--clay-on-accent)', borderRadius: 'var(--clay-r-md)' }}
        >
          Reload
        </button>
      </div>
    )
  }
}
