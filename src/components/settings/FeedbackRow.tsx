import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageSquareHeart, X } from 'lucide-react'
import { NavRow } from '@/components/ui/Panel'
import Femata from '@/components/femata/Femata'
import { auth } from '@/lib/firebase/config'
import { apiUrl, isNativeApp } from '@/lib/native'

/**
 * Settings → Send feedback: a window to write in, emailed to
 * help@femataus.com (api/feedback.js), then a thank-you.
 */
export default function FeedbackRow() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <NavRow icon={<MessageSquareHeart size={19} />} label="Send feedback" value="Ideas, problems, anything" onClick={() => setOpen(true)} />
      {open && createPortal(<FeedbackWindow onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}

function FeedbackWindow({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function submit() {
    if (busy || text.trim().length < 3) return
    setBusy(true)
    setError('')
    try {
      const user = auth.currentUser
      if (!user) throw new Error('Sign in again.')
      const r = await fetch(apiUrl('/api/feedback'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ message: text.trim(), platform: isNativeApp ? 'iPhone app' : 'web' }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'Could not send. Try again.')
      setSent(true)
    } catch (e) {
      setError(e instanceof Error && e.message !== 'Failed to fetch' ? e.message : 'No connection. Try again.')
    }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center" style={{ background: 'rgba(8,12,22,.45)' }}
      onClick={onClose} role="dialog" aria-modal="true" aria-label="Send feedback">
      <div className="w-full max-w-md rounded-[22px] p-5 pb-[max(20px,env(safe-area-inset-bottom))]" style={{ background: 'var(--clay-surface)', boxShadow: '0 20px 50px rgba(0,0,0,.25)' }}
        onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <div className="flex flex-col items-center py-4 text-center">
            <Femata mood="celebrate" size={96} />
            <h2 className="mt-3 text-[20px] font-extrabold" style={{ color: 'var(--clay-ink)' }}>Thank you for your feedback!</h2>
            <p className="mt-1 text-[14px]" style={{ color: 'var(--clay-dim)' }}>We read every message. If you asked something, we'll reply by email.</p>
            <button type="button" onClick={onClose} className="mt-5 w-full rounded-[14px] py-3 text-[15px] font-bold" style={{ background: 'var(--clay-accent)', color: 'var(--clay-on-accent, #fff)' }}>Done</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-[19px] font-extrabold" style={{ color: 'var(--clay-ink)' }}>Send feedback</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full" style={{ background: 'var(--clay-bg)', color: 'var(--clay-dim)' }}><X size={17} /></button>
            </div>
            <p className="mt-1 text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>Leave your feedback: what's working, what isn't, or what you'd like to see.</p>
            <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 4000))} rows={6} autoFocus
              placeholder="Your feedback…"
              className="mt-3 w-full resize-none rounded-[14px] p-3 text-[16px] outline-none"
              style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)', border: '1px solid var(--clay-line)' }} />
            {error && <p className="mt-1 text-[13px] font-semibold" style={{ color: 'var(--clay-danger)' }}>{error}</p>}
            <button type="button" disabled={busy || text.trim().length < 3} onClick={() => void submit()}
              className="mt-3 w-full rounded-[14px] py-3 text-[15px] font-bold disabled:opacity-50" style={{ background: 'var(--clay-accent)', color: 'var(--clay-on-accent, #fff)' }}>
              {busy ? 'Sending…' : 'Submit'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
