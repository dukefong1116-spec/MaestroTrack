import { useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { useMembers, linkRosterToAccount, linking } from '@/hooks/useStudioData'
import { acceptStudioRequest, declineStudioRequest } from '@/lib/firebase/requests'
import { Btn } from '@/components/teacher/studio/ui'
import { inputStyle } from '@/components/teacher/studio/tokens'
import type { StudioRequest } from '@/types'

/**
 * Everyone waiting to be let in — the same Accept and Decline as before.
 * If you were already keeping a record for this student without an
 * account, choose it, and everything in it becomes theirs as they join.
 * Renders nothing when nobody is waiting.
 */
export default function WaitingToJoin() {
  const { profile } = useAuth()
  const requests = useTeacherStore((s) => s.requests)
  const offline = useMembers().filter((m) => !m.onApp)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [linkTo, setLinkTo] = useState<Record<string, string>>({})

  if (!requests.length) return null

  async function decide(r: StudioRequest, accept: boolean) {
    setBusy(r.id)
    setError('')
    try {
      if (!accept) { await declineStudioRequest(r); return }
      const target = linkTo[r.id]
      if (target) linking.add(r.studentId)
      await acceptStudioRequest(r, profile?.studioName, profile?.displayName)
      if (target) await linkRosterToAccount(target, r.studentId)
    } catch (e) {
      console.error('[WaitingToJoin] could not answer the request', e)
      setError(e instanceof Error ? e.message : 'Could not answer that request. Try again.')
    } finally {
      if (linkTo[r.id]) setTimeout(() => linking.delete(r.studentId), 4000)
      setBusy(null)
    }
  }

  return (
    <div className="px-5 py-3 sm:px-6" style={{ background: '#FFF6F2', borderBottom: '1px solid #F6E3DC' }}>
      <p className="mb-2 text-[13.5px] font-bold" style={{ color: 'var(--clay-ink)' }}>Waiting to join your studio · {requests.length}</p>
      {error && <p className="mb-2 text-[13px]" style={{ color: 'var(--clay-danger)' }}>{error}</p>}
      <div className="space-y-2.5">
        {requests.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3">
            <div className="min-w-[150px] flex-1 text-[13.5px]">
              <strong style={{ color: 'var(--clay-ink)' }}>{r.studentName || 'Someone'}</strong>
              <span style={{ color: 'var(--clay-dim)' }}>
                {r.instrument ? ` · ${r.instrument}` : ''} · {r.createdAt ? `asked ${formatDistanceToNow(parseISO(r.createdAt), { addSuffix: true })}` : 'asked to join'}
              </span>
            </div>
            {offline.length > 0 && (
              <select
                aria-label={`Whose record is ${r.studentName}?`}
                className="min-h-[38px] min-w-[190px] rounded-[10px] border-0 px-3 text-[13px] font-semibold"
                style={{ ...inputStyle, background: '#fff' }}
                value={linkTo[r.id] ?? ''}
                onChange={(e) => setLinkTo({ ...linkTo, [r.id]: e.target.value })}
              >
                <option value="">New student</option>
                {offline.map((m) => <option key={m.id} value={m.id}>Is {m.name}</option>)}
              </select>
            )}
            <div className="flex gap-2">
              <Btn kind="soft" style={{ background: '#fff' }} disabled={busy === r.id} onClick={() => decide(r, false)}>Decline</Btn>
              <Btn kind="primary" disabled={busy === r.id} onClick={() => decide(r, true)}>{busy === r.id ? '…' : 'Accept'}</Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
