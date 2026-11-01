import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Copy, Bell, Palette, ShieldCheck, LifeBuoy } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { updateUserProfile } from '@/lib/firebase/teacher'
import { useAuthStore } from '@/stores/authStore'
import PageHeader from '@/components/common/PageHeader'
import MobileLogOut from '@/components/layout/MobileLogOut'
import { Panel, Block, Legend, NavRow, FactRow } from '@/components/settings/Panel'
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
  const [copied, setCopied] = useState(false)

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

  async function copyCode() {
    if (profile?.studioCode) {
      await navigator.clipboard.writeText(profile.studioCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
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
            <Legend title="Studio Code" hint="Share this code with students to invite them to your studio." />
            <div className="flex items-center gap-3">
              <div
                className="flex-1 rounded-[var(--clay-r-sm)] px-4 py-3 font-mono text-2xl font-bold tracking-widest"
                style={{ background: 'var(--clay-bg-deep)', color: 'var(--clay-ink)' }}
              >
                {profile?.studioCode ?? '—'}
              </div>
              <Button size="sm" variant="outline" onClick={copyCode}>
                <Copy size={14} /> {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </Block>

          <NavRow icon={<LifeBuoy size={19} />} label="Support & Legal" to="/teacher/settings/about" />

          <FactRow label="Email" value={user?.email ?? '—'} />
          <FactRow label="Role" value={<span className="capitalize">{profile?.role ?? '—'}</span>} />
        </Panel>

        {/* Outside, deliberately: the only destructive action on the page. */}
        <MobileLogOut />
      </div>
    </div>
  )
}
