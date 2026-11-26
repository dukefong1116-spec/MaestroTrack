import { useState } from 'react'
import { Eye, EyeOff, Link2, Trophy, UserRound } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { sendVerificationEmail } from '@/lib/firebase/auth'
import { Panel, Block, Legend, FactRow, NavRow, SettingsScreen, ToggleRow } from '@/components/ui/Panel'
import { updateUserProfile } from '@/lib/firebase/teacher'
import { useAuthStore } from '@/stores/authStore'
import { useLeagueStore } from '@/stores/leagueStore'
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

  const [verify, setVerify] = useState<'idle' | 'busy' | 'sent' | 'failed'>('idle')

  async function onVerify() {
    setVerify('busy')
    try { await sendVerificationEmail(); setVerify('sent') } catch { setVerify('failed') }
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

        {!isTeacher && (
          <>
            <Block>
              <Legend
                title="Weekly leagues"
                hint="Other players in your room see your first name and last initial, your rank and your weekly XP. With your profile shown, they can also open it: your photo and background, instrument, level, this week's practice minutes, league streak and pinned badges. Never your studio, email or full name."
              />
            </Block>
            <ToggleRow
              icon={<Trophy size={19} />}
              label="Join weekly leagues"
              hint={profile?.leagueOptOut ? "Off: you're in no league" : 'On'}
              checked={!profile?.leagueOptOut}
              onChange={(on) => {
                // Optimistic: the profile reaches here through a listener,
                // and a switch that lags a second behind its tap looks broken.
                const live = useAuthStore.getState().profile
                if (live) useAuthStore.getState().setProfile({ ...live, leagueOptOut: !on })
                // Synced at once, so leaving also takes your card off the board now.
                if (profile?.uid) void updateUserProfile(profile.uid, { leagueOptOut: !on }).then(() => useLeagueStore.getState().sync()).catch(() => {})
              }}
            />
            {!profile?.leagueOptOut && (
              <ToggleRow
                icon={<UserRound size={19} />}
                label="Show my profile to my league"
                hint={profile?.leagueProfile === false ? 'Off: your row shows only your initial' : 'On'}
                checked={profile?.leagueProfile !== false}
                onChange={(on) => {
                  const live = useAuthStore.getState().profile
                  if (live) useAuthStore.getState().setProfile({ ...live, leagueProfile: on })
                  if (profile?.uid) {
                    // The server writes or removes the card on its next sync: ask for one now.
                    void updateUserProfile(profile.uid, { leagueProfile: on })
                      .then(() => useLeagueStore.getState().sync())
                      .catch(() => {})
                  }
                }}
              />
            )}
          </>
        )}

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
        {user && !user.emailVerified && (
          <Block>
            <p className="mb-3 text-[13px]" style={{ color: 'var(--clay-dim)' }}>
              Confirming your address means a password reset can always reach you.
            </p>
            <Button variant="outline" onClick={onVerify} loading={verify === 'busy'} disabled={verify === 'sent'}>
              {verify === 'sent' ? 'Sent. Check your inbox' : 'Send verification email'}
            </Button>
            {verify === 'failed' && (
              <p className="mt-2 text-[13px] font-medium" style={{ color: 'var(--clay-danger)' }}>Could not send it. Try again in a minute.</p>
            )}
          </Block>
        )}
        <FactRow label="Last signed in" value={fmt(user?.metadata.lastSignInTime)} />
        <FactRow label="Account created" value={fmt(user?.metadata.creationTime)} />
      </Panel>
    </SettingsScreen>
  )
}
