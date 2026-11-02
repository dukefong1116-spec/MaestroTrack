import { useState } from 'react'
import { Check, Download, Eye, EyeOff, Link2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { buildDataExport, downloadJson } from '@/lib/firebase/exportData'
import { authErrorMessage } from '@/lib/firebase/account'
import { Panel, Block, Legend, FactRow, NavRow, SettingsScreen } from '@/components/ui/Panel'
import Button from '@/components/ui/Button'

/**
 * What is shared, and what is not.
 *
 * The visibility list is not a set of switches — it is a description of
 * what the Firestore rules already guarantee, written down where someone
 * can read it. Every line is checkable against firestore.rules.
 *
 * No two-factor row: Firebase MFA needs Identity Platform, which is a
 * billing change on the project rather than code. A control that cannot
 * work does not belong in a security screen.
 */

function Line({ can, children }: { can: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <span className="mt-0.5 flex shrink-0" style={{ color: can ? 'var(--clay-warning-fg)' : 'var(--clay-success-fg)' }}>
        {can ? <Eye size={17} /> : <EyeOff size={17} />}
      </span>
      <span className="text-[13.5px] leading-snug" style={{ color: 'var(--clay-ink)' }}>{children}</span>
    </li>
  )
}

export default function PrivacyPage() {
  const { profile, user } = useAuth()
  const isTeacher = profile?.role === 'teacher'
  const back = isTeacher ? '/teacher/settings' : '/student/settings'

  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const [error, setError] = useState('')

  async function onExport() {
    setBusy(true); setDone(''); setError('')
    try {
      const result = await buildDataExport()
      downloadJson(result)
      const rows = Object.values(result.counts).reduce((a, b) => a + b, 0)
      setDone(`${result.filename} — ${rows} record${rows === 1 ? '' : 's'}.`)
    } catch (e) {
      setError(authErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : '—')

  return (
    <SettingsScreen title="Privacy & Security" back={back}>
      <Panel>
        <Block first>
          <Legend
            title={isTeacher ? 'What you can see' : 'What your teacher can see'}
            hint={isTeacher
              ? 'Your students keep more than you might expect. This is enforced by the database, not by the app being polite.'
              : 'Enforced by the database itself, not by the app choosing to be careful.'}
          />
          <ul className="-my-2">
            {isTeacher ? (
              <>
                <Line can>How long each student practised, and how consistently</Line>
                <Line can>Assignments you set, and what is handed in to you</Line>
                <Line can={false}>Their practice notes — what they wrote while practising</Line>
                <Line can={false}>Recordings they did not hand in</Line>
                <Line can={false}>Anything from a student who has not joined your studio</Line>
              </>
            ) : (
              <>
                <Line can>How long you practised, and how consistently</Line>
                <Line can>Work you hand in, and recordings you attach to it</Line>
                <Line can={false}>Your practice notes — nobody sees the thoughts pad</Line>
                <Line can={false}>Recordings you have not handed in</Line>
                <Line can={false}>Anything at all, until you join a studio</Line>
              </>
            )}
          </ul>
          <p className="mt-4 text-xs leading-relaxed" style={{ color: 'var(--clay-faint)' }}>
            One caveat worth knowing: a link to a recording works for anyone holding it, so
            forwarding one forwards the audio.
          </p>
        </Block>

        <Block>
          <Legend
            title="Your data"
            hint="Everything on your account as one JSON file — profile, sessions, pieces, performances, assignments."
          />
          <Button variant="outline" onClick={onExport} loading={busy}>
            <Download size={16} /> Download my data
          </Button>
          {done && (
            <p className="mt-3 text-[13px] font-medium" style={{ color: 'var(--clay-success-fg)' }}>
              <Check size={13} className="mr-1 inline" />{done}
            </p>
          )}
          {error && (
            <p className="mt-3 text-[13px] font-medium" style={{ color: 'var(--clay-danger)' }}>{error}</p>
          )}
        </Block>

        <NavRow
          icon={<Link2 size={18} />}
          label="Shared links"
          value="Links you have published, and how to take them down"
          to={isTeacher ? '/teacher/settings/privacy/links' : '/student/settings/privacy/links'}
        />

        <Block>
          <Legend title="Sign-in" />
        </Block>
        <FactRow label="Email" value={user?.email ?? '—'} />
        <FactRow label="Email verified" value={user?.emailVerified ? 'Yes' : 'No'} />
        <FactRow label="Last signed in" value={fmt(user?.metadata.lastSignInTime)} />
        <FactRow label="Account created" value={fmt(user?.metadata.creationTime)} />
      </Panel>
    </SettingsScreen>
  )
}
