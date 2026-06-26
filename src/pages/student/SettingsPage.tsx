import { useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { updateUserProfile, joinStudioByCode } from '@/lib/firebase/teacher'
import { getTheme, INSTRUMENT_LIST, INSTRUMENT_THEMES } from '@/lib/utils/instruments'
import { useAuthStore } from '@/stores/authStore'
import PageHeader from '@/components/common/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import type { InstrumentType } from '@/types'

const schema = z.object({
  displayName: z.string().min(2),
  instrument: z.enum(['piano','violin','viola','cello','flute','clarinet','saxophone','trumpet','trombone','percussion','voice','guitar'] as [InstrumentType, ...InstrumentType[]]),
  experienceLevel: z.enum(['beginner','intermediate','advanced','professional']),
  weeklyGoalMinutes: z.coerce.number().min(30),
})
type FormData = z.infer<typeof schema>

export default function SettingsPage() {
  const { profile, user } = useAuth()
  const { setProfile } = useAuthStore()
  const theme = getTheme(profile?.instrument as InstrumentType | undefined)
  const [studioCode, setStudioCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joinSuccess, setJoinSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      displayName: profile?.displayName ?? '',
      instrument: profile?.instrument,
      experienceLevel: profile?.experienceLevel,
      weeklyGoalMinutes: profile?.weeklyGoalMinutes ?? 300,
    }
  })

  async function onSubmit(data: FormData) {
    const uid = profile?.uid ?? user?.uid
    if (!uid) return
    setSaving(true)
    try {
      updateUserProfile(uid, { ...data, updatedAt: new Date().toISOString() })
      const updated = { ...(profile ?? { uid, email: user?.email ?? '', role: 'student', displayName: data.displayName, createdAt: new Date().toISOString() }), ...data }
      setProfile(updated)
      localStorage.setItem(`maestro_profile_${uid}`, JSON.stringify(updated))
    } finally {
      setSaving(false)
    }
  }

  async function handleJoinStudio() {
    const uid = profile?.uid ?? user?.uid
    if (!uid || !studioCode.trim()) return
    setJoinError('')
    const code = studioCode.trim().toUpperCase()
    if (code.length < 4) {
      setJoinError('Code too short — check with your teacher.')
      return
    }
    console.log('[Settings] Student', uid, 'joining studio with code', code)
    const ok = await joinStudioByCode(uid, code)
    if (ok) {
      const updated = { ...(profile ?? { uid, email: user?.email ?? '', role: 'student' as const, displayName: '', createdAt: new Date().toISOString() }) }
      setProfile(updated)
      localStorage.setItem(`maestro_profile_${uid}`, JSON.stringify(updated))
      setJoinSuccess(true)
    } else {
      setJoinError('Studio code not found. Make sure your teacher has logged in at least once, then try again.')
    }
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your profile and preferences." />

      <div className="space-y-6 max-w-2xl">
        {/* Profile */}
        <Card className="p-6">
          <p className="text-sm font-semibold text-slate-300 mb-4">Profile</p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Display Name" error={errors.displayName?.message} {...register('displayName')} />
            <Select
              label="Instrument"
              options={INSTRUMENT_LIST.map((i) => ({ value: i, label: `${INSTRUMENT_THEMES[i].emoji} ${INSTRUMENT_THEMES[i].label}` }))}
              error={errors.instrument?.message}
              {...register('instrument')}
            />
            <Select
              label="Experience Level"
              options={[
                { value: 'beginner', label: 'Beginner' },
                { value: 'intermediate', label: 'Intermediate' },
                { value: 'advanced', label: 'Advanced' },
                { value: 'professional', label: 'Professional' },
              ]}
              error={errors.experienceLevel?.message}
              {...register('experienceLevel')}
            />
            <Input label="Weekly Goal (minutes)" type="number" error={errors.weeklyGoalMinutes?.message} {...register('weeklyGoalMinutes')} />
            <Button type="submit" loading={isSubmitting || saving}>Save Profile</Button>
          </form>
        </Card>

        {/* Studio */}
        <Card className="p-6">
          <p className="text-sm font-semibold text-slate-300 mb-1">Join a Studio</p>
          <p className="text-xs text-slate-500 mb-4">Enter your teacher's studio code to connect your account.</p>
          {profile?.teacherId ? (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <span>✓</span> Linked to a studio
            </div>
          ) : joinSuccess ? (
            <div className="text-emerald-400 text-sm">Successfully joined the studio!</div>
          ) : (
            <div className="flex gap-3">
              <Input
                placeholder="Enter studio code (e.g. ABC123)"
                value={studioCode}
                onChange={(e) => setStudioCode(e.target.value.toUpperCase())}
                error={joinError}
                className="max-w-[200px]"
              />
              <Button onClick={handleJoinStudio}>Join</Button>
            </div>
          )}
        </Card>

        {/* Account info */}
        <Card className="p-6">
          <p className="text-sm font-semibold text-slate-300 mb-4">Account</p>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Email</span>
              <span className="text-white">{user?.email}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Role</span>
              <span className="text-white capitalize">{profile?.role}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Member Since</span>
              <span className="text-white">{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
