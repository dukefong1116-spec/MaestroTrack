import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Keyboard, QrCode } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getInvite, requestToJoin, resolveInviteCode, type InviteProblem } from '@/lib/firebase/invites'
import { subscribeMyStudioRequest, withdrawStudioRequest } from '@/lib/firebase/requests'
import { Panel, Block, Legend, SettingsScreen } from '@/components/ui/Panel'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Sticker from '@/components/stickers/Sticker'
import { tokenFromScan } from '@/lib/utils/inviteLink'
import type { StudioInvite } from '@/types'

// The camera and its decoder are the heaviest thing on this screen and
// most people will type the code, so they arrive only if Scan is tapped.
const QRScanner = lazy(() => import('@/components/ui/QRScanner'))

const EXCUSE: Record<InviteProblem, string> = {
  'not-found': 'No invitation with that code. Check the characters and try again.',
  expired: 'That invitation has expired. Ask your teacher for a fresh one.',
  claimed: 'That one has already been used. Ask your teacher for another.',
  revoked: 'Your teacher withdrew that invitation.',
}

/**
 * Joining a studio, on its own screen.
 *
 * It was a box wedged into the middle of Settings, which is a list of
 * rows that lead somewhere — so it read as a stray form rather than part
 * of the page. Here it gets the room to offer both ways in.
 */
export default function JoinStudioPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<'choose' | 'code' | 'scan'>('choose')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [waiting, setWaiting] = useState<{ teacherId: string } | null>(null)

  const uid = profile?.uid
  const joined = Boolean(profile?.teacherId)

  useEffect(() => {
    if (!uid || joined) return
    return subscribeMyStudioRequest(uid, (r) => setWaiting(r ? { teacherId: r.teacherId } : null))
  }, [uid, joined])

  async function ask(invite: StudioInvite) {
    if (!profile) return
    await requestToJoin(profile, invite)
    setWaiting({ teacherId: invite.teacherId })
    setCode('')
    setMode('choose')
  }

  async function submitCode() {
    if (!profile || !code.trim()) return
    setError('')
    setBusy(true)
    try {
      const { invite, problem } = await resolveInviteCode(code)
      if (!invite || problem) { setError(EXCUSE[problem ?? 'not-found']); return }
      await ask(invite)
    } catch (e) {
      console.error('[JoinStudio] code failed', e)
      setError(e instanceof Error ? e.message : 'Could not send your request. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleScan(text: string) {
    const token = tokenFromScan(text)
    if (!token) {
      setError('That code is not a MaestroTrack invitation.')
      setMode('choose')
      return
    }
    setError('')
    setBusy(true)
    try {
      const { invite, problem } = await getInvite(token)
      if (!invite || problem) { setError(EXCUSE[problem ?? 'not-found']); setMode('choose'); return }
      await ask(invite)
    } catch (e) {
      console.error('[JoinStudio] scan failed', e)
      setError(e instanceof Error ? e.message : 'Could not send your request. Try again.')
      setMode('choose')
    } finally {
      setBusy(false)
    }
  }

  async function withdraw() {
    if (!uid || !waiting) return
    try {
      await withdrawStudioRequest(uid, waiting.teacherId)
      setWaiting(null)
    } catch (e) {
      console.error('[JoinStudio] withdraw failed', e)
      setError('Could not withdraw that request. Try again.')
    }
  }

  return (
    <SettingsScreen title="Join a studio" back="/student/settings">
      {/*
        One panel, like every other settings screen: the explainer, the
        two ways in and whatever they open are the same subject, so they
        are divided by hairlines rather than floated apart as cards.
      */}
      <Panel>
        {joined ? (
          <Settled
            title="You're in a studio"
            body={`${profile?.studioName || 'Your teacher'} has you on their roster.`}
            action={
              <Button variant="outline" onClick={() => navigate('/student/settings')}>
                Back to settings
              </Button>
            }
          />
        ) : waiting ? (
          <Settled
            title="Waiting on your teacher"
            body="They'll let you in. Nothing waits on this — carry on practising."
            action={
              <button
                type="button"
                onClick={withdraw}
                className="min-h-[40px] text-[13px] font-semibold"
                style={{ color: 'var(--clay-dim)' }}
              >
                Withdraw the request
              </button>
            }
          />
        ) : mode === 'scan' ? (
          <Block first>
            <Legend title="Scan the code" />
            <Suspense fallback={<p className="text-[13px]" style={{ color: 'var(--clay-faint)' }}>Opening the camera…</p>}>
              <QRScanner onFound={handleScan} onCancel={() => setMode('choose')} />
            </Suspense>
          </Block>
        ) : mode === 'code' ? (
          <Block first>
            <Legend title="Enter the code" />
            <div className="flex gap-3">
              <Input
                autoFocus
                placeholder="ABC123"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="max-w-[160px] font-mono tracking-[0.18em]"
                maxLength={7}
                onKeyDown={(e) => { if (e.key === 'Enter') void submitCode() }}
              />
              <Button onClick={submitCode} loading={busy}>Ask to join</Button>
            </div>
            <button
              type="button"
              onClick={() => { setMode('choose'); setError('') }}
              className="mt-4 min-h-[40px] text-[13px] font-semibold"
              style={{ color: 'var(--clay-dim)' }}
            >
              Back
            </button>
          </Block>
        ) : (
          <>
            <Choice
              first
              icon={<QrCode size={19} />}
              label="Scan a QR code"
              hint="Point it at your teacher's screen"
              onClick={() => { setMode('scan'); setError('') }}
            />
            <Choice
              icon={<Keyboard size={19} />}
              label="Enter a code"
              hint="Six characters"
              onClick={() => { setMode('code'); setError('') }}
            />
          </>
        )}

        {error && (
          <Block>
            <p className="text-[13.5px] font-medium" style={{ color: 'var(--clay-danger)' }}>{error}</p>
          </Block>
        )}
      </Panel>
    </SettingsScreen>
  )
}

/** Where both ends of the flow land: nothing left to do here. */
function Settled({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="px-5 py-7 text-center sm:px-6">
      <div className="mb-4 flex justify-center"><Sticker name="check" size={38} tone="accent" /></div>
      <p className="text-[18px] font-bold" style={{ color: 'var(--clay-ink)' }}>{title}</p>
      <p className="mx-auto mt-2 max-w-[320px] text-[13.5px] leading-snug" style={{ color: 'var(--clay-dim)' }}>
        {body}
      </p>
      <div className="mt-5 flex justify-center">{action}</div>
    </div>
  )
}

/**
 * One of the two ways in.
 *
 * Shaped exactly like NavRow, because it sits in the same list — but it
 * runs a handler rather than following a link, so it cannot be one.
 */
function Choice({
  icon, label, hint, onClick, first,
}: {
  icon: React.ReactNode
  label: string
  hint: string
  onClick: () => void
  first?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 px-5 py-4 text-left transition-transform active:scale-[.99] sm:px-6"
      style={first ? undefined : { borderTop: '1px solid var(--clay-line)' }}
    >
      <span className="flex shrink-0" style={{ color: 'var(--clay-dim)' }}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold" style={{ color: 'var(--clay-ink)' }}>{label}</span>
        <span className="block truncate text-xs" style={{ color: 'var(--clay-dim)' }}>{hint}</span>
      </span>
      <ChevronRight size={18} className="shrink-0" style={{ color: 'var(--clay-faint)' }} />
    </button>
  )
}
