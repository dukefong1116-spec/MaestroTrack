import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Copy, RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { updateUserProfile } from '@/lib/firebase/teacher'
import { useAuthStore } from '@/stores/authStore'
import PageHeader from '@/components/common/PageHeader'
import Card from '@/components/ui/Card'
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

      <div className="space-y-6 max-w-2xl">
        <Card className="p-6">
          <p className="text-sm font-semibold text-[var(--clay-faint)] mb-4">Profile & Studio</p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Your Name" error={errors.displayName?.message} {...register('displayName')} />
            <Input label="Studio Name" placeholder="Chen Music Studio" error={errors.studioName?.message} {...register('studioName')} />
            <Button type="submit" loading={isSubmitting || saving}>Save</Button>
          </form>
        </Card>

        <Card className="p-6">
          <p className="text-sm font-semibold text-[var(--clay-faint)] mb-1">Studio Code</p>
          <p className="text-xs text-[var(--clay-dim)] mb-4">Share this code with students to invite them to your studio.</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-[var(--clay-bg-deep)] border border-[var(--clay-line)] rounded-xl px-4 py-3 font-mono text-2xl font-bold text-[var(--clay-ink)] tracking-widest">
              {profile?.studioCode ?? '—'}
            </div>
            <Button size="sm" variant="outline" onClick={copyCode}>
              <Copy size={14} /> {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <p className="text-sm font-semibold text-[var(--clay-faint)] mb-4">Account</p>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-[var(--clay-dim)]">
              <span>Email</span>
              <span className="text-[var(--clay-ink)]">{user?.email}</span>
            </div>
            <div className="flex justify-between text-[var(--clay-dim)]">
              <span>Role</span>
              <span className="text-[var(--clay-ink)] capitalize">{profile?.role}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
