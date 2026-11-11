import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getInvite, requestToJoin, type InviteProblem } from '@/lib/firebase/invites'
import { holdPendingInvite } from '@/lib/utils/pendingInvite'
import Button from '@/components/ui/Button'
import Sticker from '@/components/stickers/Sticker'
import type { StudioInvite } from '@/types'

const EXCUSE: Record<InviteProblem, { title: string; body: string }> = {
  'not-found': {
    title: 'That invitation does not exist',
    body: 'The link may have been cut short somewhere between your teacher and you. Ask them to send it again.',
  },
  expired: {
    title: 'That invitation has expired',
    body: 'Invitations last a week. Ask your teacher for a fresh one — it only takes them a moment.',
  },
  claimed: {
    title: 'That invitation has already been used',
    body: 'Each one works for a single student. If it was not you who used it, ask your teacher for your own.',
  },
  revoked: {
    title: 'That invitation was withdrawn',
    body: 'Your teacher cancelled this one. Ask them for a new link.',
  },
}

/**
 * The page a teacher's link opens.
 *
 * It has to work for somebody with no account at all, which is why the
 * invitation document is readable without signing in: a stranger holding
 * the link sees whose studio it is, and that is the whole point of having
 * been sent it.
 *
 * Everything else about joining is gated. Asking to join needs an
 * account, and being let in needs the teacher.
 */
export default function JoinPage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const { profile, user, loading: authLoading, provisional } = useAuth()
  // This page asks whether you are signed in, so it waits for Firebase's
  // real answer rather than the last account used on this device.
  const loading = authLoading || provisional

  const [invite, setInvite] = useState<StudioInvite | null>(null)
  const [problem, setProblem] = useState<InviteProblem | null>(null)
  const [checking, setChecking] = useState(true)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    setChecking(true)
    getInvite(token)
      .then(({ invite: found, problem: why }) => {
        if (!live) return
        setInvite(found)
        setProblem(why)
      })
      .catch((e) => {
        console.error('[Join] could not read the invitation', e)
        if (live) setProblem('not-found')
      })
      .finally(() => { if (live) setChecking(false) })
    return () => { live = false }
  }, [token])

  /** Keep the token across a signup round trip. */
  const remember = useCallback(() => { holdPendingInvite(token) }, [token])

  async function ask() {
    if (!profile || !invite) return
    setSending(true)
    setError('')
    try {
      await requestToJoin(profile, invite)
      setSent(true)
    } catch (e) {
      console.error('[Join] could not ask to join', e)
      setError(e instanceof Error ? e.message : 'Could not send your request. Try again.')
    } finally {
      setSending(false)
    }
  }

  const studio = invite?.studioName || 'a studio'
  const teacherName = invite?.teacherName || 'Your teacher'

  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center px-5 py-10"
      style={{ background: 'var(--clay-bg)', fontFamily: 'var(--clay-font)' }}
    >
      <div
        className="w-full max-w-[400px] px-6 py-8"
        style={{
          background: 'var(--clay-surface)',
          borderRadius: 'var(--clay-r-lg)',
          boxShadow: 'var(--clay-deep)',
        }}
      >
        {checking ? (
          <p className="text-center text-[14px]" style={{ color: 'var(--clay-faint)' }}>
            Checking that invitation…
          </p>
        ) : problem ? (
          <Excuse {...EXCUSE[problem]} />
        ) : sent ? (
          <Settled
            title="Asked to join"
            body={`${teacherName} will see your request and let you in. You can start logging practice in the meantime — nothing waits on this.`}
            action={<Button variant="primary" onClick={() => navigate('/student')}>Go to Today</Button>}
          />
        ) : (
          <>
            <div className="mb-5 flex justify-center">
              <Sticker name="users" size={40} tone="accent" />
            </div>

            <p className="text-center text-[13px] font-bold uppercase tracking-widest" style={{ color: 'var(--clay-faint)' }}>
              An invitation
            </p>
            <h1
              className="mt-1.5 text-center text-[23px] font-bold leading-tight"
              style={{ color: 'var(--clay-ink)' }}
            >
              {teacherName} invited you to {studio}
            </h1>

            {error && (
              <p className="mt-4 text-center text-[13px]" style={{ color: 'var(--clay-danger)' }}>{error}</p>
            )}

            {/*
              Only this part waits on auth. Reading the invitation never
              needed it — the whole point is that it works for somebody
              with no account — and gating the page on it meant the usual
              visitor sat watching a spinner while Firebase woke up.
            */}
            {loading ? (
              <p className="mt-6 text-center text-[13px]" style={{ color: 'var(--clay-faint)' }}>
                One moment…
              </p>
            ) : !user ? (
              <div className="mt-6 space-y-2.5">
                <Link to="/signup" onClick={remember} className="block">
                  <Button variant="primary" className="w-full">Create an account</Button>
                </Link>
                <Link to="/login" onClick={remember} className="block">
                  <Button variant="outline" className="w-full">I already have one</Button>
                </Link>
              </div>
            ) : profile?.role === 'teacher' ? (
              <Excuse
                title="You are signed in as a teacher"
                body="A teaching account cannot join another studio. Sign in as the student this was meant for."
                inline
              />
            ) : profile?.teacherId ? (
              <Excuse
                title="You are already in a studio"
                body="Ask your current teacher to remove you before joining another."
                inline
              />
            ) : (
              <div className="mt-6">
                <Button variant="primary" className="w-full" onClick={ask} loading={sending}>
                  Ask to join
                </Button>
                <p className="mt-2.5 text-center text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>
                  {teacherName} has to accept before you join.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Excuse({ title, body, inline }: { title: string; body: string; inline?: boolean }) {
  return (
    <div className={inline ? 'mt-5' : ''}>
      <h1 className="text-center text-[19px] font-bold leading-tight" style={{ color: 'var(--clay-ink)' }}>
        {title}
      </h1>
      <p className="mt-2 text-center text-[13.5px] leading-snug" style={{ color: 'var(--clay-dim)' }}>
        {body}
      </p>
      {!inline && (
        <div className="mt-6 flex justify-center">
          <Link to="/login"><Button variant="outline">Back to sign in</Button></Link>
        </div>
      )}
    </div>
  )
}

function Settled({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="mb-4 flex justify-center"><Sticker name="check" size={40} tone="accent" /></div>
      <h1 className="text-[21px] font-bold leading-tight" style={{ color: 'var(--clay-ink)' }}>{title}</h1>
      <p className="mt-2 text-[13.5px] leading-snug" style={{ color: 'var(--clay-dim)' }}>{body}</p>
      <div className="mt-6 flex justify-center">{action}</div>
    </div>
  )
}
