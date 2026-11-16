import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Link2, RefreshCw, Share2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import QRCode from '@/components/ui/QRCode'
import { createInvite, revokeInvite, type NewInvite } from '@/lib/firebase/invites'
import type { UserProfile } from '@/types'

/**
 * One invitation, shown three ways.
 *
 * The QR is for the lesson, the code is for reading out, the link is for
 * sending. They are the same invitation — spending any one of them
 * spends all three — which is the point: a teacher picks whichever suits
 * the moment without having to think about what they are handing over.
 *
 * An invitation is minted when the sheet opens, not when the teacher
 * presses something. Opening this is the act of inviting somebody; making
 * them press again to see anything would be ceremony.
 */
export default function InviteSheet({
  open,
  onClose,
  profile,
}: {
  open: boolean
  onClose: () => void
  profile: UserProfile
}) {
  const [invite, setInvite] = useState<NewInvite | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)

  const mint = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      setInvite(await createInvite(profile))
    } catch (e) {
      console.error('[InviteSheet] could not create an invitation', e)
      setError(e instanceof Error ? e.message : 'Could not create an invitation. Try again.')
    } finally {
      setBusy(false)
    }
  }, [profile])

  useEffect(() => {
    if (!open) return
    setInvite(null)
    setCopied(null)
    void mint()
  }, [open, mint])

  // Clears itself, so the tick is feedback rather than a state the sheet
  // gets stuck in.
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(null), 1600)
    return () => clearTimeout(t)
  }, [copied])

  async function copy(what: 'link' | 'code') {
    if (!invite) return
    try {
      await navigator.clipboard.writeText(what === 'link' ? invite.url : invite.code)
      setCopied(what)
    } catch {
      setError('Could not reach the clipboard — select the text and copy it by hand.')
    }
  }

  /** The share sheet on a phone; absent on most desktops, so it is offered, not relied on. */
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function share() {
    if (!invite) return
    try {
      await navigator.share({
        title: `Join ${profile.studioName || 'my studio'} on MaestroTrack`,
        text: `${profile.displayName} has invited you to join ${profile.studioName || 'their studio'} on MaestroTrack.`,
        url: invite.url,
      })
    } catch {
      // A cancelled share sheet throws, and is not a failure.
    }
  }

  /** Burn this one and mint another, for an invitation sent to the wrong person. */
  async function startOver() {
    if (invite) await revokeInvite(invite.token).catch(() => {})
    await mint()
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite a student" size="sm">
      <div className="space-y-5">
        <p className="text-[13.5px] leading-snug" style={{ color: 'var(--clay-dim)' }}>
          Good for one student, for seven days. They'll appear below as waiting,
          and nobody joins until you accept them.
        </p>

        {error && (
          <p className="text-[13px]" style={{ color: 'var(--clay-danger)' }}>{error}</p>
        )}

        {!invite ? (
          <div className="flex h-[260px] items-center justify-center">
            <p className="text-[13px]" style={{ color: 'var(--clay-faint)' }}>
              {busy ? 'Making an invitation…' : '—'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-4">
              <QRCode value={invite.url} size={188} />

              <div className="text-center">
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--clay-faint)' }}>
                  or read this out
                </p>
                <button
                  type="button"
                  onClick={() => copy('code')}
                  className="mt-1 font-mono text-[30px] font-bold leading-none tracking-[0.18em] transition-transform active:scale-95"
                  style={{ color: 'var(--clay-ink)' }}
                  aria-label={`Copy the code ${invite.code.split('').join(' ')}`}
                >
                  {invite.code}
                </button>
                <p className="mt-1.5 text-[12px]" style={{ color: 'var(--clay-dim)' }}>
                  {copied === 'code' ? 'Copied.' : 'They enter it in Settings → Join a studio.'}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => copy('link')}>
                {copied === 'link' ? <Check size={14} /> : <Copy size={14} />}
                {copied === 'link' ? 'Copied' : 'Copy link'}
              </Button>
              {canShare && (
                <Button variant="primary" size="sm" className="flex-1" onClick={share}>
                  <Share2 size={14} /> Send
                </Button>
              )}
            </div>

            <div
              className="flex items-center gap-2 px-3 py-2.5 text-[12px]"
              style={{
                background: 'var(--clay-bg)',
                borderRadius: 'var(--clay-r-sm)',
                color: 'var(--clay-dim)',
              }}
            >
              <Link2 size={13} className="shrink-0" />
              <span className="truncate font-mono">{invite.url}</span>
            </div>

            <button
              type="button"
              onClick={startOver}
              disabled={busy}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold disabled:opacity-50"
              style={{ color: 'var(--clay-dim)' }}
            >
              <RefreshCw size={13} /> Sent it to the wrong person — start over
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
