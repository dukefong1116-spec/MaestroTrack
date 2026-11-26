import { useState } from 'react'
import { socialProviders, socialError, type SocialProvider } from '@/lib/firebase/auth'

/**
 * Continue with Google / Apple, in each one's own required look (Google's
 * white button with the four-colour G; Apple's black with the Apple mark).
 * Shows nothing until a provider is switched on (socialProviders).
 * `run` does the signing in; its error is shown here.
 */
export default function SocialButtons({ run, divider = 'or', dark = false }: {
  run: (p: SocialProvider) => Promise<void>
  divider?: string
  dark?: boolean
}) {
  const [busy, setBusy] = useState<SocialProvider | null>(null)
  const [error, setError] = useState('')
  const list = (['apple', 'google'] as const).filter((p) => socialProviders[p])
  if (!list.length) return null

  async function go(p: SocialProvider) {
    if (busy) return
    setBusy(p)
    setError('')
    try { await run(p) } catch (e) { setError(socialError(e)) }
    setBusy(null)
  }

  const line = dark ? 'rgba(255,255,255,.14)' : 'var(--clay-line)'
  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center gap-3 text-[12px] font-bold uppercase tracking-wider" style={{ color: dark ? '#9AA8C0' : 'var(--clay-dim)' }}>
        <span className="h-px flex-1" style={{ background: line }} />{divider}<span className="h-px flex-1" style={{ background: line }} />
      </div>
      <div className="flex flex-col gap-2.5">
        {list.map((p) => (
          <button key={p} type="button" disabled={!!busy} onClick={() => void go(p)}
            className="flex w-full items-center justify-center gap-2.5 rounded-[14px] py-3 text-[15.5px] font-semibold disabled:opacity-60"
            style={p === 'apple'
              ? { background: dark ? '#FFFFFF' : '#000000', color: dark ? '#000000' : '#FFFFFF' }
              : { background: '#FFFFFF', color: '#1F1F1F', border: '1px solid #DADCE0' }}>
            {p === 'apple' ? <AppleMark /> : <GoogleG />}
            {busy === p ? 'Signing in…' : `Continue with ${p === 'apple' ? 'Apple' : 'Google'}`}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-[13px] font-bold" style={{ color: dark ? '#FF8FA3' : 'var(--clay-danger)' }}>{error}</p>}
    </div>
  )
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

function AppleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 814 1000" aria-hidden="true" fill="currentColor">
      <path d="M788 341c-6 4-108 62-108 190 0 148 130 200 134 202-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-165-40c-77 0-104 41-166 41s-106-57-156-127C44 791 0 671 0 557 0 374 119 277 236 277c62 0 114 41 153 41 37 0 95-43 166-43 27 0 124 2 188 66zM554 170c29-35 50-83 50-131 0-7-1-13-2-19-47 2-103 32-137 71-27 30-52 78-52 127 0 7 1 15 2 17 3 1 8 1 13 1 42 0 95-28 126-66z" />
    </svg>
  )
}
