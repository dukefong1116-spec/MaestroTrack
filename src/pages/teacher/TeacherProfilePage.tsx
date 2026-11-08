import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Camera } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { updateUserProfile } from '@/lib/firebase/teacher'
import Avatar from '@/components/profile/Avatar'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Panel, Block, Legend, FactRow, SettingsScreen } from '@/components/ui/Panel'
import type { InstrumentType } from '@/types'

const schema = z.object({
  displayName: z.string().min(2, 'Your name is required'),
  studioName: z.string().min(2, 'A studio name is required'),
})
type FormData = z.infer<typeof schema>

/**
 * A teacher's own profile, shaped like a student's.
 *
 * Teachers had a bare name-and-studio form wedged into Settings while
 * students got a face and a screen of their own. Nothing about teaching
 * made that difference necessary — and a teacher's photo is the one a
 * student sees on an invitation, so it is worth setting.
 */
export default function TeacherProfilePage() {
  const { profile, user } = useAuth()
  const { setProfile } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: profile?.displayName ?? '',
      studioName: profile?.studioName ?? '',
    },
  })

  async function onSubmit(data: FormData) {
    if (!profile) return
    setSaving(true)
    setSaved(false)
    try {
      await updateUserProfile(profile.uid, data)
      setProfile({ ...profile, ...data })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsScreen title="Profile & studio" back="/teacher/settings">
      <Panel>
        <Block first>
          <div className="flex flex-col items-center">
            {/* The photo is its own screen, as it is for a student: it
                involves a file picker and a crop, not a text field. */}
            <Link
              to="/teacher/settings/profile/photo"
              aria-label="Change your photo"
              className="relative transition-transform active:scale-95"
            >
              <Avatar
                src={profile?.avatar}
                name={profile?.displayName}
                instrument={profile?.instrument as InstrumentType | undefined}
                size={96}
              />
              <span
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full"
                style={{
                  background: 'var(--clay-accent)',
                  color: 'var(--clay-on-accent)',
                  boxShadow: 'var(--clay-raised)',
                }}
              >
                <Camera size={15} />
              </span>
            </Link>
            <p className="mt-3 text-[17px] font-bold" style={{ color: 'var(--clay-ink)' }}>
              {profile?.displayName || 'Your name'}
            </p>
            <p className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>
              {profile?.studioName || 'Your studio'}
            </p>
          </div>
        </Block>

        <Block>
          <Legend title="Details" />
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Your name" error={errors.displayName?.message} {...register('displayName')} />
            <Input
              label="Studio name"
              placeholder="Chen Music Studio"
              error={errors.studioName?.message}
              {...register('studioName')}
            />
            <Button type="submit" loading={isSubmitting || saving}>
              {saved && !saving ? 'Saved' : 'Save'}
            </Button>
          </form>
        </Block>

        <FactRow label="Email" value={user?.email ?? '—'} />
        <FactRow label="Role" value="Teacher" />
        <FactRow
          label="Member since"
          value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}
        />
      </Panel>
    </SettingsScreen>
  )
}
