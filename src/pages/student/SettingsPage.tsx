import { Check, ChevronLeft, ChevronRight, Bell, Palette, ShieldCheck, LifeBuoy, GraduationCap, Pencil, BookOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStepBack } from '@/hooks/useStepBack'
import { useAuth } from '@/hooks/useAuth'
import { subscribeMyStudioRequest } from '@/lib/firebase/requests'
import { INSTRUMENT_THEMES } from '@/lib/utils/instruments'
import MobileLogOut from '@/components/layout/MobileLogOut'
import Avatar from '@/components/profile/Avatar'
import Banner from '@/components/profile/Banner'
import BannerSheet from '@/components/profile/BannerSheet'
import { Panel, NavRow, FactRow } from '@/components/ui/Panel'
import type { InstrumentType } from '@/types'
import FeedbackRow from '@/components/settings/FeedbackRow'

export default function SettingsPage() {
  const { profile, user } = useAuth()
  // On an iPad or computer, Settings opens straight to a page with the list
  // beside it (SettingsScreen); this overview is the phone's.
  const goWide = useNavigate()
  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) goWide('/student/settings/profile', { replace: true })
  }, [goWide])

  const stepBack = useStepBack('/student')
  // Only enough to label the row — the joining itself lives on its own
  // screen now.
  const [waiting, setWaiting] = useState(false)
  const [banner, setBanner] = useState(false)

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
      {/* Back the way you came — Settings is opened from your photo on
          Today, and a student in a studio has no Settings tab to leave by. */}
      <div className="mb-6 flex items-center gap-3 lg:mb-8">
        <button
          type="button"
          onClick={stepBack}
          aria-label="Back"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
          style={{ background: 'var(--clay-surface)', boxShadow: 'var(--clay-raised)', color: 'var(--clay-ink)' }}
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[22px] font-bold leading-tight lg:text-[26px]" style={{ color: 'var(--clay-ink)' }}>Settings</h1>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* One panel, not a pile of cards: these rows are the same subject. */}
        <Panel>
          {/* Your banner, with the photo on its edge. The pencil is the
              only way in: changing it is occasional, so it stays small. */}
          <div className="relative">
            <Banner image={profile?.bannerImage} color={profile?.bannerColor} height={170}>
              <button
                type="button"
                onClick={() => setBanner(true)}
                aria-label="Change profile background"
                className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full"
                style={{ background: 'rgba(0,0,0,.3)', color: '#fff' }}
              >
                <Pencil size={15} aria-hidden="true" />
              </button>
            </Banner>
            <Link to="/student/settings/profile" aria-hidden="true" tabIndex={-1} className="absolute -bottom-8 left-4 rounded-full" style={{ border: '4px solid var(--clay-surface)' }}>
              <Avatar src={profile?.avatar} name={profile?.displayName} instrument={instrument} size={64} />
            </Link>
          </div>
          <Link
            to="/student/settings/profile"
            className="flex items-center gap-4 px-4 pb-4 pt-10 transition-transform active:scale-[.99]"
          >
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
                  <Check size={12} /> {profile?.studioName || (profile?.teacherName ? `${profile.teacherName}’s studio` : 'Joined')}
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

          <NavRow icon={<BookOpen size={19} />} label="Guide" value="How everything works" to="/student/settings/guide" />
          <FeedbackRow />
          <NavRow icon={<LifeBuoy size={19} />} label="Support & Legal" to="/student/settings/about" />

          <FactRow label="Email" value={user?.email ?? '—'} />
          <FactRow label="Role" value={<span className="capitalize">{profile?.role ?? '—'}</span>} />
          <FactRow label="Studio" value={linked ? (profile?.studioName || (profile?.teacherName ? `${profile.teacherName}’s studio` : 'Joined')) : '—'} />
          <FactRow
            label="Member since"
            value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}
          />
        </Panel>

        {/* The one thing left outside: signing out is the only destructive
            action here, and it should not share a surface with the rest. */}
        <MobileLogOut />
      </div>
      <BannerSheet open={banner} onClose={() => setBanner(false)} />
    </div>
  )
}
