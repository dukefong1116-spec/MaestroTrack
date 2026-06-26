import { useState, useEffect } from 'react'
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

// Repair a student profile that is missing role, studioCode, or teacherId.
// Returns the patched profile and whether any repair was needed.
async function repairStudentProfile(
  uid: string,
  profile: UserProfile
): Promise<{ profile: UserProfile; repaired: boolean; log: string[] }> {
  const log: string[] = []
  const patches: Partial<UserProfile & { updatedAt: string }> = {}

  log.push(`[ProfileRepair] uid: ${uid}`)
  log.push(`[ProfileRepair] current role: ${profile.role ?? 'MISSING'}`)
  log.push(`[ProfileRepair] current studioCode: ${profile.studioCode ?? 'MISSING'}`)
  log.push(`[ProfileRepair] current teacherId: ${profile.teacherId ?? 'MISSING'}`)

  // Must have role: 'student'
  if (profile.role !== 'student') {
    log.push('[ProfileRepair] repairing role → student')
    patches.role = 'student'
  }

  // If studioCode present but teacherId missing, look up the teacher
  if (profile.studioCode && !profile.teacherId) {
    log.push(`[ProfileRepair] studioCode present (${profile.studioCode}) but teacherId missing — looking up teacher`)
    const teacherId = await getTeacherByStudioCode(profile.studioCode)
    if (teacherId) {
      log.push(`[ProfileRepair] found teacherId: ${teacherId}`)
      patches.teacherId = teacherId
    } else {
      log.push('[ProfileRepair] teacher lookup returned null — studioCode may not exist in Firestore yet')
    }
  }

  if (Object.keys(patches).length === 0) {
    log.push('[ProfileRepair] no repairs needed')
    return { profile, repaired: false, log }
  }

  patches.updatedAt = new Date().toISOString()
  log.push('[ProfileRepair] writing repairs to Firestore:', JSON.stringify(patches))
  await setDoc(doc(db, 'users', uid), patches, { merge: true })

  // Read back to confirm
  const snap = await getDoc(doc(db, 'users', uid))
  log.push('[ProfileRepair] repaired profile after write:', JSON.stringify(snap.data()))

  const repairedProfile: UserProfile = { ...profile, ...patches }
  return { profile: repairedProfile, repaired: true, log }
}

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

  // On mount: log profile debug info and auto-repair if needed
  useEffect(() => {
    const uid = profile?.uid ?? user?.uid
    if (!uid || !profile) return

    const lsKey = `maestro_profile_${uid}`
    const lsRaw = localStorage.getItem(lsKey)
    let lsProfile: unknown = null
    try { lsProfile = lsRaw ? JSON.parse(lsRaw) : null } catch { /* ignore */ }

    console.log('[Settings] current uid:', uid)
    console.log('[Settings] Firestore/state profile:', profile)
    console.log('[Settings] localStorage profile:', lsProfile)
    console.log('[Settings] role:', profile.role ?? 'MISSING')
    console.log('[Settings] studioCode:', profile.studioCode ?? 'none')
    console.log('[Settings] teacherId:', profile.teacherId ?? 'none')

    const needsRepair =
      profile.role !== 'student' ||
      (!!profile.studioCode && !profile.teacherId)

    console.log('[Settings] repair needed?', needsRepair)

    if (needsRepair) {
      repairStudentProfile(uid, profile).then(({ profile: repaired, repaired: didRepair, log }) => {
        log.forEach((l) => console.log(l))
        if (didRepair) {
          setProfile(repaired)
          localStorage.setItem(lsKey, JSON.stringify(repaired))
          console.log('[ProfileRepair] local state updated with repaired profile')
        }
      }).catch((e) => console.error('[ProfileRepair] repair failed:', e))
    }
  // Only run once on mount when profile first becomes available
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!profile?.uid])

  async function handleResync() {
    const uid = profile?.uid ?? user?.uid
    if (!uid) return
    setResyncing(true)
    setResyncMsg('')
    try {
      console.log('[Resync] Reading profile from Firestore...')
      const firestoreProfile = await getUserProfile(uid)
      console.log('[Resync] Firestore profile:', firestoreProfile)

      // Start from Firestore doc, or fall back to current state
      let base: UserProfile = firestoreProfile ?? profile!
      // Always ensure role is set
      if (!base.role) {
        const cachedRole = localStorage.getItem(`maestro_role_${uid}`)
        if (cachedRole === 'student' || cachedRole === 'teacher') base = { ...base, role: cachedRole }
      }

      const { profile: repaired, repaired: didRepair, log } = await repairStudentProfile(uid, base)
      log.forEach((l) => console.log(l))

      setProfile(repaired)
      localStorage.setItem(`maestro_profile_${uid}`, JSON.stringify(repaired))

      const msg = didRepair
        ? `Repaired: role=${repaired.role}, studioCode=${repaired.studioCode ?? 'none'}, teacherId=${repaired.teacherId ?? 'none'}`
        : `Profile OK: role=${repaired.role}, studioCode=${repaired.studioCode ?? 'none'}, teacherId=${repaired.teacherId ?? 'none'}`
      setResyncMsg(msg)
      console.log('[Resync] done:', msg)
    } catch (e) {
      const msg = `Resync failed: ${String(e)}`
      setResyncMsg(msg)
      console.error('[Resync] error:', e)
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

    console.log('[JoinStudio] clicked')
    console.log('[JoinStudio] student uid:', uid)
    console.log('[JoinStudio] entered studio code:', code)

    try {
      // Look up the teacher UID by their studioCode
      console.log('[JoinStudio] looking up teacher by studioCode:', code)
      const teacherId = await getTeacherByStudioCode(code)
      console.log('[JoinStudio] teacherId found:', teacherId ?? 'null')

      if (!teacherId) {
        setJoinError('Studio code not found. Ask your teacher to check their code.')
        setJoining(false)
        return
      }

      // Write complete student profile to Firestore.
      // Both teacherId AND studioCode are stored.
      // role: 'student' is required for the teacher dashboard query.
      const now = new Date().toISOString()
      const profileData: Record<string, unknown> = {
        email: user?.email ?? '',
        role: 'student',
        displayName: profile?.displayName ?? '',
        studioCode: code,
        teacherId,
        createdAt: profile?.createdAt ?? now,
        updatedAt: now,
      }
      // Keep existing profile fields (instrument, experienceLevel, etc.)
      if (profile) {
        const { uid: _u, ...rest } = profile as Record<string, unknown>
        void _u
        Object.assign(profileData, rest, {
          studioCode: code,
          teacherId,
          role: 'student',
          updatedAt: now,
        })
      }

      console.log('[JoinStudio] writing to Firestore users/', uid, profileData)
      await setDoc(doc(db, 'users', uid), profileData, { merge: true })
      console.log('[JoinStudio] Firestore write success')

      // Read back to confirm
      const snap = await getDoc(doc(db, 'users', uid))
      console.log('[JoinStudio] student doc after update:', snap.data())

      // Update local state and localStorage
      const updated = { uid, ...profileData } as UserProfile
      setProfile(updated)
      localStorage.setItem(`maestro_profile_${uid}`, JSON.stringify(updated))

      setJoinSuccess(true)
      console.log('[JoinStudio] success — student linked to teacher', teacherId)
    } catch (e) {
      console.error('[JoinStudio] failed:', e)
      setJoinError('Could not join studio. Check your internet connection and try again.')
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
              {profile?.teacherId && (
                <p className="text-xs text-slate-500">Teacher ID: {profile.teacherId}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {profile?.studioCode && !profile?.teacherId && (
                <p className="text-xs text-amber-400">
                  Studio code saved ({profile.studioCode}) but teacher link is incomplete. Click "Repair Studio Link" below.
                </p>
              )}
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

        {/* Resync / Repair */}
        <Card className="p-6">
          <p className="text-sm font-semibold text-slate-300 mb-1">Repair Studio Link</p>
          <p className="text-xs text-slate-500 mb-4">
            If your studio link isn't showing correctly, this will re-read your profile from the server
            and fix any missing fields.
          </p>
          <Button variant="outline" size="sm" onClick={handleResync} loading={resyncing}>
            Resync Profile
          </Button>
          {resyncMsg && (
            <p className={`mt-3 text-xs font-mono ${resyncMsg.startsWith('Resync failed') ? 'text-red-400' : 'text-emerald-400'}`}>
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
                {profile?.role ?? 'missing — click Resync Profile'}
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
