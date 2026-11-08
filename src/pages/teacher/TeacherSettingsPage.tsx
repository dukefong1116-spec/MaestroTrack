import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, ChevronRight, Palette, ShieldCheck, LifeBuoy, UserPlus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import PageHeader from '@/components/common/PageHeader'
import MobileLogOut from '@/components/layout/MobileLogOut'
import Avatar from '@/components/profile/Avatar'
import Button from '@/components/ui/Button'
import InviteSheet from '@/components/teacher/InviteSheet'
import { Panel, Block, Legend, NavRow, FactRow } from '@/components/ui/Panel'

export default function TeacherSettingsPage() {
  const { profile, user } = useAuth()
  const [inviting, setInviting] = useState(false)

  return (
    <div>
      <PageHeader title="Settings" />

      <div className="max-w-2xl space-y-6">
        <Panel>
          {/* The same row a student gets: a face, a name, and the screen
              behind it — rather than a bare form in the middle of a list. */}
          <Link
            to="/teacher/settings/profile"
            className="flex items-center gap-4 p-4 transition-transform active:scale-[.99]"
          >
            <Avatar src={profile?.avatar} name={profile?.displayName} size={60} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-bold" style={{ color: 'var(--clay-ink)' }}>
                {profile?.displayName || 'Your profile'}
              </p>
              <p className="mt-0.5 truncate text-[13px]" style={{ color: 'var(--clay-dim)' }}>
                {profile?.studioName || 'Name your studio'}
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0" style={{ color: 'var(--clay-faint)' }} />
          </Link>

          <NavRow icon={<Bell size={19} />} label="Notifications" to="/teacher/settings/notifications" />
          <NavRow icon={<Palette size={19} />} label="Appearance" to="/teacher/settings/appearance" />
          <NavRow icon={<ShieldCheck size={19} />} label="Privacy & Security" to="/teacher/settings/privacy" />

          <Block>
            <Legend
              title="Students"
              hint="One student each, good for a week."
            />
            <Button size="sm" variant="outline" onClick={() => setInviting(true)}>
              <UserPlus size={14} /> Invite a student
            </Button>
          </Block>

          <NavRow icon={<LifeBuoy size={19} />} label="Support & Legal" to="/teacher/settings/about" />

          <FactRow label="Email" value={user?.email ?? '—'} />
          <FactRow label="Role" value={<span className="capitalize">{profile?.role ?? '—'}</span>} />
        </Panel>

        {profile && (
          <InviteSheet open={inviting} onClose={() => setInviting(false)} profile={profile} />
        )}

        {/* Outside, deliberately: the only destructive action on the page. */}
        <MobileLogOut />
      </div>
    </div>
  )
}
