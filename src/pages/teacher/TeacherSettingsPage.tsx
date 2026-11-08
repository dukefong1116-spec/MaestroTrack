import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Bell, Palette, ShieldCheck, LifeBuoy, UserPlus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { updateUserProfile } from '@/lib/firebase/teacher'
import { useAuthStore } from '@/stores/authStore'
import PageHeader from '@/components/common/PageHeader'
import MobileLogOut from '@/components/layout/MobileLogOut'
import InviteSheet from '@/components/teacher/InviteSheet'
import { Panel, Block, Legend, NavRow, FactRow } from '@/components/ui/Panel'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

const schema = z.object({
  displayName: z.string().min(2),
  studioName: z.string().min(2),
})
type FormData = z.infer<typeof schema>

export default function TeacherSettingsPage() {
  const { profile, user } = useAuth()
  const { setProfile } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: profile?.displayName ?? '',
      studioName: profile?.studioName ?? '',
    }
  })

  async function onSubmit(data: FormData) {
    if (!profile) return
    setSaving(true)
    try {
      await updateUserProfile(profile.uid, data)
      setProfile({ ...profile, ...data })
    } finally {
      setSaving(false)
    }
  }


  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your studio and profile." />

      <div className="max-w-2xl space-y-6">
        <Panel>
          <Block first>
            <Legend title="Profile & Studio" />
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input label="Your Name" error={errors.displayName?.message} {...register('displayName')} />
              <Input label="Studio Name" placeholder="Chen Music Studio" error={errors.studioName?.message} {...register('studioName')} />
              <Button type="submit" loading={isSubmitting || saving}>Save</Button>
            </form>
          </Block>

          <NavRow icon={<Bell size={19} />} label="Notifications" to="/teacher/settings/notifications" />
          <NavRow icon={<Palette size={19} />} label="Appearance" to="/teacher/settings/appearance" />
          <NavRow icon={<ShieldCheck size={19} />} label="Privacy & Security" to="/teacher/settings/privacy" />

          <Block>
            <Legend
              title="Students"
              hint="Each invitation is for one student and lasts a week. They join when you accept them, not when they open the link."
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
