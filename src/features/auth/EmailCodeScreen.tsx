import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { logOut } from '@/lib/firebase/auth'
import { apiUrl } from '@/lib/native'
import { Stage, Ask, BigButton, STAGE } from '@/components/onboarding/stage'
import type { UserProfile } from '@/types'

/**
 * Whether this account must still enter the code emailed to it. Only email
 * accounts made since codes began (every one of those carries
 * legalAcceptance); older accounts, and Google or Apple ones, never do.
 */
export function needsEmailCode(user: User | null, profile: UserProfile | null): boolean {
  return !!user && !!profile?.legalAcceptance && !user.emailVerified
    && user.providerData.some((p) => p.providerId === 'password')
}

async function call(body: object): Promise<{ sent?: boolean; verified?: boolean; devCode?: string; error?: string }> {
  const user = auth.currentUser
  if (!user) return { error: 'Sign in again.' }
  try {
    const r = await fetch(apiUrl('/api/auth/code'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${await user.getIdToken()}` },
      body: JSON.stringify(body),
    })
    return await r.json()
  } catch {
    return { error: 'No connection. Try again.' }
  }
}

/** The 6-digit code screen, in front of the app until the email is confirmed. */
export default function EmailCodeScreen({ user, onDone }: { user: User; onDone: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [wait, setWait] = useState(0)
  const [dev, setDev] = useState('')
  const sentOnce = useRef(false)

  async function send(auto = false) {
    setError('')
    setWait(30)
    const r = await call({ action: 'send' })
    if (r.verified) return finish()
    // The first, automatic send can meet one that just went (a second
    // tab, a quick reload): that code is on its way, so say nothing.
    if (r.error && !(auto && /just sent/.test(r.error))) setError(r.error)
    if (r.devCode) setDev(r.devCode)
  }

  async function finish() {
    await user.reload().catch(() => {})
    await user.getIdToken(true).catch(() => {})
    onDone()
  }

  async function check(c: string) {
    if (busy) return
    setBusy(true)
    setError('')
    const r = await call({ action: 'check', code: c })
    setBusy(false)
    if (r.verified) return finish()
    setError(r.error ?? 'Something went wrong.')
    setCode('')
  }

  // The first code goes out by itself — once per visit, so a reload does
  // not spend the hourly allowance.
  useEffect(() => {
    if (sentOnce.current) return
    sentOnce.current = true
    const key = `femata_code_sent_${user.uid}`
    let sent = false
    try { sent = sessionStorage.getItem(key) === '1'; sessionStorage.setItem(key, '1') } catch { /* unavailable */ }
    if (!sent) void send(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid])

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  return (
    <Stage staff>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-[max(48px,env(safe-area-inset-top))]">
        <Ask mood="happy">Check your email!</Ask>
        <h1 className="mt-6 text-[28px] font-black leading-tight">Enter your code</h1>
        <p className="mt-2 text-[15px] font-semibold leading-relaxed" style={{ color: STAGE.muted }}>
          We sent a 6-digit code to <b style={{ color: STAGE.cream }}>{user.email}</b>.
        </p>
        <input
          value={code}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 6)
            setCode(v)
            if (v.length === 6) void check(v)
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="6-digit code"
          placeholder="••••••"
          autoFocus
          disabled={busy}
          className="mt-6 w-full rounded-[16px] py-4 text-center text-[32px] font-extrabold tracking-[.4em] outline-none"
          style={{ background: STAGE.ink2, border: `1.5px solid ${error ? '#F2777A' : STAGE.ink3}`, color: STAGE.cream }}
        />
        {error && <p className="mt-2 text-[14px] font-semibold" style={{ color: '#F2777A' }}>{error}</p>}
        {dev && <p className="mt-2 text-[12px]" style={{ color: STAGE.muted }}>Emulator code: {dev}</p>}
        <button type="button" disabled={wait > 0} onClick={() => void send()}
          className="mt-5 text-left text-[14px] font-bold disabled:opacity-50" style={{ color: STAGE.sky }}>
          {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
        </button>
        <p className="mt-2 text-[13px] font-semibold" style={{ color: STAGE.muted }}>Not there? Check your spam folder.</p>
        <div className="mt-auto pb-[max(20px,env(safe-area-inset-bottom))]">
          <BigButton disabled={code.length !== 6 || busy} onClick={() => void check(code)}>{busy ? 'CHECKING…' : 'CONFIRM'}</BigButton>
          <button type="button" onClick={() => void logOut()} className="mt-3 w-full text-center text-[13px] font-bold" style={{ color: STAGE.muted }}>
            Wrong email? Log out
          </button>
        </div>
      </div>
    </Stage>
  )
}
