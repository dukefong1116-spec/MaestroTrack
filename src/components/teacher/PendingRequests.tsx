import { useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import Sticker from '@/components/stickers/Sticker'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { acceptStudioRequest, declineStudioRequest } from '@/lib/firebase/requests'
import InstrumentIcon from '@/components/icons/InstrumentIcon'
import type { InstrumentType, StudioRequest } from '@/types'

/**
 * Everyone waiting to be let in.
 *
 * Renders nothing when nobody is, so it never costs a teacher space on
 * the ordinary day — the same bargain SubmissionsWaiting makes.
 */
export default function PendingRequests() {
  const { profile } = useAuth()
  const requests = useTeacherStore((s) => s.requests)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  if (!requests.length) return null

  async function decide(request: StudioRequest, accept: boolean) {
    setBusy(request.id)
    setError('')
    try {
      if (accept) await acceptStudioRequest(request, profile?.studioName, profile?.displayName)
      else await declineStudioRequest(request)
      // No local removal: the subscription is filtered to pending, so the
      // row leaves on its own once the write lands. Removing it here as
      // well would make the list flicker when the two disagree.
    } catch (e) {
      console.error('[PendingRequests] could not answer the request', e)
      setError(e instanceof Error ? e.message : 'Could not answer that request. Try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mb-6">
      <p
        className="mb-3 text-xs font-semibold uppercase tracking-widest"
        style={{ color: 'var(--clay-dim)' }}
      >
        Waiting to join · {requests.length}
      </p>

      {error && (
        <p className="mb-2 text-[13px]" style={{ color: 'var(--clay-danger)' }}>{error}</p>
      )}

      <div
        style={{
          background: 'var(--clay-surface)',
          borderRadius: 'var(--clay-r-md)',
          boxShadow: 'var(--clay-raised)',
          overflow: 'hidden',
        }}
      >
        {requests.map((r, i) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-3 px-4 py-3.5"
            style={i === 0 ? undefined : { borderTop: '1px solid var(--clay-line)' }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{
                background: 'color-mix(in srgb, var(--clay-accent) 15%, transparent)',
                color: 'var(--clay-accent)',
              }}
            >
              {r.instrument
                ? <InstrumentIcon instrument={r.instrument as InstrumentType} size={17} />
                : <Sticker name="users" size={16} tone="accent" />}
            </span>

            {/* A floor on the name, so at phone width the two buttons wrap
                to their own line instead of squeezing "Rafi Okonkwo" down
                to "Rafi Oko…". */}
            <div className="min-w-[150px] flex-1">
              <p className="truncate text-[14.5px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
                {r.studentName || 'Someone'}
              </p>
              <p className="text-[12px]" style={{ color: 'var(--clay-dim)' }}>
                {r.createdAt
                  ? `asked ${formatDistanceToNow(parseISO(r.createdAt), { addSuffix: true })}`
                  : 'asked to join'}
              </p>
            </div>

            <div className="ml-auto flex shrink-0 gap-2">
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => decide(r, false)}
                className="min-h-[36px] px-3 text-[13px] font-semibold transition-transform active:scale-95 disabled:opacity-50"
                style={{ color: 'var(--clay-dim)', borderRadius: 'var(--clay-r-sm)' }}
              >
                Decline
              </button>
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => decide(r, true)}
                className="min-h-[36px] px-4 text-[13px] font-bold transition-transform active:scale-95 disabled:opacity-50"
                style={{
                  background: 'var(--clay-accent)',
                  color: 'var(--clay-on-accent)',
                  borderRadius: 'var(--clay-r-sm)',
                }}
              >
                {busy === r.id ? '…' : 'Accept'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
