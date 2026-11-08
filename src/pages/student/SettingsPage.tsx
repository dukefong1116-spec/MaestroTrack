import { Check, ChevronRight, Bell, Palette, ShieldCheck, LifeBuoy, GraduationCap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { subscribeMyStudioRequest } from '@/lib/firebase/requests'
import { INSTRUMENT_THEMES } from '@/lib/utils/instruments'
import PageHeader from '@/components/common/PageHeader'
import MobileLogOut from '@/components/layout/MobileLogOut'
import Avatar from '@/components/profile/Avatar'
import { Panel, NavRow, FactRow } from '@/components/ui/Panel'
import type { InstrumentType } from '@/types'

export default function SettingsPage() {
  const { profile, user } = useAuth()
  // Only enough to label the row — the joining itself lives on its own
  // screen now.
  const [waiting, setWaiting] = useState(false)

  // Being in a studio is teacherId and nothing else now. The old check
  // also demanded studioCode, which a student accepted through an
  // invitation never has — they would have seen the join box forever.
  const linked = Boolean(profile?.teacherId)

  const uid = profile?.uid
  useEffect(() => {
    if (!uid || linked) return
    return subscribeMyStudioRequest(uid, (r) => setWaiting(Boolean(r)))
  }, [uid, linked])

  const instrument = profile?.instrument as InstrumentType | undefined
  const subtitle = [
    instrument ? INSTRUMENT_THEMES[instrument]?.label : null,
    profile?.experienceLevel,
  ].filter(Boolean).join(' · ')

  return (
    <div>
      <PageHeader title="Settings" />

      <div className="max-w-2xl space-y-6">
        {/* One panel, not a pile of cards: these rows are the same subject. */}
        <Panel>
          <Link
            to="/student/settings/profile"
            className="flex items-center gap-4 p-4 transition-transform active:scale-[.99]"
          >
            <Avatar src={profile?.avatar} name={profile?.displayName} instrument={instrument} size={60} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-bold" style={{ color: 'var(--clay-ink)' }}>
                {profile?.displayName || 'Your profile'}
              </p>
              {subtitle && (
                <p className="mt-0.5 truncate text-[13px] capitalize" style={{ color: 'var(--clay-dim)' }}>
                  {subtitle}
                </p>
              )}
            </div>
            <ChevronRight size={18} className="shrink-0" style={{ color: 'var(--clay-faint)' }} />
          </Link>

          <NavRow icon={<Bell size={19} />} label="Notifications" to="/student/settings/notifications" />
          <NavRow icon={<Palette size={19} />} label="Appearance" to="/student/settings/appearance" />
          <NavRow icon={<ShieldCheck size={19} />} label="Privacy & Security" to="/student/settings/privacy" />

          {/* Studio. A row like its neighbours either way — being in one
              is a fact, joining one is a screen. The form that used to sit
              here read as a stray box in the middle of a list of rows. */}
          {linked ? (
            <div className="flex items-center gap-3.5 px-5 py-4 sm:px-6" style={{ borderTop: '1px solid var(--clay-line)' }}>
              <span className="flex shrink-0" style={{ color: 'var(--clay-dim)' }}><GraduationCap size={19} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold" style={{ color: 'var(--clay-ink)' }}>Your studio</span>
                <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--clay-success-fg)' }}>
                  <Check size={12} /> {profile?.studioName || 'Joined'}
                </span>
              </span>
            </div>
          ) : (
            <NavRow
              icon={<GraduationCap size={19} />}
              label="Join a studio"
              value={waiting ? 'Waiting on your teacher' : undefined}
              to="/student/settings/join"
            />
          )}

          <NavRow icon={<LifeBuoy size={19} />} label="Support & Legal" to="/student/settings/about" />

          <FactRow label="Email" value={user?.email ?? '—'} />
          <FactRow label="Role" value={<span className="capitalize">{profile?.role ?? '—'}</span>} />
          <FactRow label="Studio" value={linked ? (profile?.studioName || 'Joined') : '—'} />
          <FactRow
            label="Member since"
            value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}
          />
        </Panel>

        {/* The one thing left outside: signing out is the only destructive
            action here, and it should not share a surface with the rest. */}
        <MobileLogOut />
      </div>
    </div>
  )
}
