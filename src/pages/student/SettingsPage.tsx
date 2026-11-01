import { Check, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getTeacherByStudioCode } from '@/lib/firebase/teacher'
import { INSTRUMENT_THEMES } from '@/lib/utils/instruments'
import { useAuthStore } from '@/stores/authStore'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import PageHeader from '@/components/common/PageHeader'
import MobileLogOut from '@/components/layout/MobileLogOut'
import Avatar from '@/components/profile/Avatar'
import Card from '@/components/ui/Card'
import SoundSetting from '@/components/settings/SoundSetting'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import type { InstrumentType, UserProfile } from '@/types'

export default function SettingsPage() {
  const { profile, user } = useAuth()
  const { setProfile } = useAuthStore()
  const [studioCode, setStudioCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joinSuccess, setJoinSuccess] = useState(false)
  const [joining, setJoining] = useState(false)

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

  const instrument = profile?.instrument as InstrumentType | undefined
  const subtitle = [
    instrument ? INSTRUMENT_THEMES[instrument]?.label : null,
    profile?.experienceLevel,
  ].filter(Boolean).join(' · ')

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your profile and preferences." />

      <div className="space-y-6 max-w-2xl">
        {/* Who you are. The whole row opens the editor — the fields that
            used to sit here in a form have moved there, along with the
            things a form on a settings page could never do (your photo,
            your email, your password). */}
        <Link
          to="/student/settings/profile"
          className="flex items-center gap-4 rounded-[var(--clay-r-md)] p-4 transition-transform active:scale-[.99]"
          style={{ background: 'var(--clay-surface)', boxShadow: 'var(--clay-raised)' }}
        >
          <Avatar src={profile?.avatar} name={profile?.displayName} instrument={instrument} size={60} />
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

        {/* Studio */}
        <Card className="p-6">
          <p className="text-sm font-semibold text-[var(--clay-faint)] mb-1">Join a Studio</p>
          <p className="text-xs text-[var(--clay-dim)] mb-4">Enter your teacher's studio code to connect your account.</p>
          {(profile?.studioCode && profile?.teacherId) || joinSuccess ? (
            <div className="text-sm text-emerald-400 space-y-1">
              <div className="flex items-center gap-2">
                <Check size={13} /> Linked to studio {profile?.studioCode ?? studioCode}
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

        <SoundSetting />

        {/* Account info */}
        <Card className="p-6">
          <p className="text-sm font-semibold text-[var(--clay-faint)] mb-4">Account</p>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-[var(--clay-dim)]">
              <span>Email</span>
              <span className="text-[var(--clay-ink)]">{user?.email}</span>
            </div>
            <div className="flex justify-between text-[var(--clay-dim)]">
              <span>Role</span>
              <span className={`capitalize ${profile?.role ? 'text-[var(--clay-ink)]' : 'text-red-400'}`}>
                {profile?.role ?? '—'}
              </span>
            </div>
            <div className="flex justify-between text-[var(--clay-dim)]">
              <span>Studio Code</span>
              <span className="text-[var(--clay-ink)]">{profile?.studioCode ?? '—'}</span>
            </div>
            <div className="flex justify-between text-[var(--clay-dim)]">
              <span>Member Since</span>
              <span className="text-[var(--clay-ink)]">{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}</span>
            </div>
          </div>
        </Card>

        <MobileLogOut />
      </div>
    </div>
  )
}
