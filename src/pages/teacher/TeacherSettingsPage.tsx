import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CalendarClock, ChevronRight, Palette, ShieldCheck, LifeBuoy, Tags, UserPlus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useStudioSettings } from '@/hooks/useStudioData'
import { INSTRUMENT_THEMES } from '@/lib/utils/instruments'
import MobileLogOut from '@/components/layout/MobileLogOut'
import Avatar from '@/components/profile/Avatar'
import InviteSheet from '@/components/teacher/InviteSheet'
import { StudioPage } from '@/components/teacher/studio/ui'
import type { InstrumentType } from '@/types'

function Section({ title, hint, children, first }: { title: string; hint?: string; children: ReactNode; first?: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-2 px-5 py-5 sm:px-6" style={first ? undefined : { borderTop: '1px solid var(--clay-line)' }}>
      <div className="w-full sm:w-56 sm:shrink-0">
        <h2 className="text-[14.5px] font-bold" style={{ color: 'var(--clay-ink)' }}>{title}</h2>
        {hint && <p className="mt-1 text-[12.5px] leading-snug" style={{ color: 'var(--clay-dim)' }}>{hint}</p>}
      </div>
      <div className="min-w-0 flex-1 basis-[380px]">{children}</div>
    </div>
  )
}

const rowCls = 'flex w-full items-center gap-3 py-2.5 text-left'
const rowStyle = { borderBottom: '1px solid var(--clay-line)', color: 'var(--clay-ink)' }

function RowBody({ icon, label, value }: { icon: ReactNode; label: string; value?: string }) {
  return (
    <>
      <span style={{ color: 'var(--clay-dim)' }}>{icon}</span>
      <span className="flex-1 text-[13.5px] font-semibold">{label}</span>
      {/* A summary of what's inside, where there's room for it beside the label. */}
      {value && <span className="hidden truncate text-[12.5px] sm:inline" style={{ color: 'var(--clay-dim)' }}>{value}</span>}
      <ChevronRight size={16} className="shrink-0" style={{ color: 'var(--clay-faint)' }} />
    </>
  )
}

function NavRow({ icon, label, to, value }: { icon: ReactNode; label: string; to: string; value?: string }) {
  return <Link to={to} className={rowCls} style={rowStyle}><RowBody icon={icon} label={label} value={value} /></Link>
}

const hour = (h: number) => `${h % 12 || 12} ${h < 12 || h === 24 ? 'AM' : 'PM'}`

export default function TeacherSettingsPage() {
  const { profile, user } = useAuth()
  const settings = useStudioSettings()
  const [inviting, setInviting] = useState(false)

  const instrument = INSTRUMENT_THEMES[profile?.instrument as InstrumentType]?.label
  const types = settings.lessonTypes.length

  return (
    <StudioPage title="Settings">
      <Section title="You and your studio" first>
        <Link to="/teacher/settings/profile" className="flex items-center gap-3">
          <Avatar src={profile?.avatar} name={profile?.displayName} instrument={profile?.instrument as InstrumentType | undefined} size={48} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold" style={{ color: 'var(--clay-ink)' }}>{profile?.displayName || 'Your profile'}</span>
            <span className="block truncate text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>
              {[profile?.studioName || 'Studio name', instrument].filter(Boolean).join(' · ')}
            </span>
          </span>
          <ChevronRight size={16} style={{ color: 'var(--clay-faint)' }} />
        </Link>
      </Section>

      <Section title="Studio" hint="How lessons are booked, priced and shown.">
        <NavRow icon={<Tags size={18} />} label="Lessons and prices" to="/teacher/settings/lessons"
          value={`${settings.defaultLessonMinutes} min default · ${types} ${types === 1 ? 'type' : 'types'}`} />
        <NavRow icon={<CalendarClock size={18} />} label="Calendar hours" to="/teacher/settings/calendar"
          value={`${hour(settings.dayStart)} – ${hour(settings.dayEnd)}`} />
        <button type="button" onClick={() => setInviting(true)} className={rowCls} style={rowStyle}>
          <RowBody icon={<UserPlus size={18} />} label="Invite a student" value="Good for a week" />
        </button>
      </Section>

      <Section title="App">
        <NavRow icon={<Bell size={18} />} label="Notifications" to="/teacher/settings/notifications" />
        <NavRow icon={<Palette size={18} />} label="Appearance" to="/teacher/settings/appearance" />
        <NavRow icon={<ShieldCheck size={18} />} label="Privacy & Security" to="/teacher/settings/privacy" />
        <NavRow icon={<LifeBuoy size={18} />} label="Support & Legal" to="/teacher/settings/about" />
        <p className="pt-3 text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>Signed in as {user?.email ?? '—'}</p>
      </Section>

      <div className="px-5 pb-5 sm:px-6"><MobileLogOut /></div>
      {profile && <InviteSheet open={inviting} onClose={() => setInviting(false)} profile={profile} />}
    </StudioPage>
  )
}
