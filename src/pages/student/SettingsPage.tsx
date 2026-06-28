import { useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'
import { updateUserProfile, getTeacherByStudioCode } from '@/lib/firebase/teacher'
import { getTheme, INSTRUMENT_LIST, INSTRUMENT_THEMES } from '@/lib/utils/instruments'
import { useAuthStore } from '@/stores/authStore'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { getUserProfile } from '@/lib/firebase/auth'
import PageHeader from '@/components/common/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import type { InstrumentType, UserProfile } from '@/types'

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
  const [joining, setJoining] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resyncing, setResyncing] = useState(false)
  const [resyncMsg, setResyncMsg] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      displayName: profile?.displayName ?? '',
      instrument: profile?.instrument,
      experienceLevel: profile?.experienceLevel,
      weeklyGoalMinutes: profile?.weeklyGoalMinutes ?? 300,
    }
  })

  async function handleResync() {
    const uid = profile?.uid ?? user?.uid
    if (!uid) return
    setResyncing(true)
    setResyncMsg('')
    try {
      const fresh = await getUserProfile(uid)
      if (fresh) {
        setProfile(fresh)
        localStorage.setItem(`maestro_profile_${uid}`, JSON.stringify(fresh))
        setResyncMsg(`role=${fresh.role ?? 'missing'}, studioCode=${fresh.studioCode ?? 'none'}, teacherId=${fresh.teacherId ?? 'none'}`)
      } else {
        setResyncMsg('No profile found in Firestore.')
      }
    } catch (e) {
      setResyncMsg(`Error: ${String(e)}`)
    } finally {
      setResyncing(false)
    }
  }

  async function onSubmit(data: FormData) {
    const uid = profile?.uid ?? user?.uid
    if (!uid) return
    setSaving(true)
    try {
      await updateUserProfile(uid, data)
      const updated = {
        ...(profile ?? { uid, email: user?.email ?? '', role: 'student' as const, createdAt: new Date().toISOString() }),
        ...data,
        updatedAt: new Date().toISOString(),
      }
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
    setJoining(true)
    const code = studioCode.trim().toUpperCase()

    try {
      // 1. Find teacher UID by studioCode
      const teacherId = await getTeacherByStudioCode(code)
      if (!teacherId) {
        setJoinError('Studio code not found. Check the code and try again.')
        return
      }

      // 2. Write student relationship fields to Firestore
      const now = new Date().toISOString()
      const patch: Record<string, unknown> = {
        role: 'student',
        studioCode: code,
        teacherId,
        updatedAt: now,
      }
      await setDoc(doc(db, 'users', uid), patch, { merge: true })

      // 3. Read back and validate all three fields are present
      const snap = await getDoc(doc(db, 'users', uid))
      const written = snap.data()
      console.log('[JoinStudio] read-back student doc:', written)

      if (!written?.role || !written?.teacherId || !written?.studioCode) {
        setJoinError('Join succeeded but profile is incomplete. Please try again.')
        return
      }

      // 4. Update local state
      const updated: UserProfile = { ...(profile as UserProfile), ...patch, uid }
      setProfile(updated)
      localStorage.setItem(`maestro_profile_${uid}`, JSON.stringify(updated))

      setJoinSuccess(true)
    } catch (e) {
      console.error('[JoinStudio] failed:', e)
      setJoinError(`Could not join studio: ${String(e)}`)
    } finally {
      setJoining(false)
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
          {(profile?.studioCode && profile?.teacherId) || joinSuccess ? (
            <div className="text-sm text-emerald-400 space-y-1">
              <div className="flex items-center gap-2">
                <span>✓</span> Linked to studio {profile?.studioCode ?? studioCode}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-3">
                <Input
                  placeholder="Enter studio code (e.g. ABC123)"
                  value={studioCode}
                  onChange={(e) => setStudioCode(e.target.value.toUpperCase())}
                  className="max-w-[200px]"
                />
                <Button onClick={handleJoinStudio} loading={joining}>Join</Button>
              </div>
              {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
            </div>
          )}
        </Card>

        {/* Resync */}
        <Card className="p-6">
          <p className="text-sm font-semibold text-slate-300 mb-1">Reload Profile</p>
          <p className="text-xs text-slate-500 mb-4">Re-reads your profile from the database.</p>
          <Button variant="outline" size="sm" onClick={handleResync} loading={resyncing}>
            Reload from Database
          </Button>
          {resyncMsg && (
            <p className={`mt-3 text-xs font-mono ${resyncMsg.startsWith('Error') || resyncMsg.includes('missing') || resyncMsg.includes('No profile') ? 'text-red-400' : 'text-emerald-400'}`}>
              {resyncMsg}
            </p>
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
              <span className={`capitalize ${profile?.role ? 'text-white' : 'text-red-400'}`}>
                {profile?.role ?? '—'}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Studio Code</span>
              <span className="text-white">{profile?.studioCode ?? '—'}</span>
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
