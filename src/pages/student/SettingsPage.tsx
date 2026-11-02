import { Check, ChevronRight, Bell, Palette, ShieldCheck, LifeBuoy, GraduationCap } from 'lucide-react'
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
import { Panel, Block, Legend, NavRow, FactRow } from '@/components/ui/Panel'
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

  const linked = (profile?.studioCode && profile?.teacherId) || joinSuccess

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

      <div className="max-w-2xl space-y-6">
        {/* One panel, not a pile of cards: these rows are the same subject. */}
        <Panel>
          <Link
            to="/student/settings/profile"
            className="flex items-center gap-4 p-4 transition-transform active:scale-[.99]"
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

          <NavRow icon={<Bell size={19} />} label="Notifications" to="/student/settings/notifications" />
          <NavRow icon={<Palette size={19} />} label="Appearance" to="/student/settings/appearance" />
          <NavRow icon={<ShieldCheck size={19} />} label="Privacy & Security" to="/student/settings/privacy" />

          {/* Studio — a row once you are in one, the form until then. */}
          {linked ? (
            <div className="flex items-center gap-3.5 px-5 py-4 sm:px-6" style={{ borderTop: '1px solid var(--clay-line)' }}>
              <span className="flex shrink-0" style={{ color: 'var(--clay-dim)' }}><GraduationCap size={19} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold" style={{ color: 'var(--clay-ink)' }}>Your studio</span>
                <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--clay-success-fg)' }}>
                  <Check size={12} /> Linked to {profile?.studioCode ?? studioCode}
                </span>
              </span>
            </div>
          ) : (
            <Block>
              <Legend title="Join a Studio" hint="Enter your teacher's studio code to connect your account." />
              <div className="flex gap-3">
                <Input
                  placeholder="Enter studio code (e.g. ABC123)"
                  value={studioCode}
                  onChange={(e) => setStudioCode(e.target.value.toUpperCase())}
                  className="max-w-[200px]"
                />
                <Button onClick={handleJoinStudio} loading={joining}>Join</Button>
              </div>
              {joinError && (
                <p className="mt-3 text-sm font-medium" style={{ color: 'var(--clay-danger)' }}>{joinError}</p>
              )}
            </Block>
          )}

          <NavRow icon={<LifeBuoy size={19} />} label="Support & Legal" to="/student/settings/about" />

          <FactRow label="Email" value={user?.email ?? '—'} />
          <FactRow label="Role" value={<span className="capitalize">{profile?.role ?? '—'}</span>} />
          <FactRow label="Studio code" value={profile?.studioCode ?? '—'} />
          <FactRow
            label="Member since"
            value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}
          />
        </Panel>

        {/* The one thing left outside: signing out is the only destructive
            action here, and it should not share a surface with the rest. */}
        <MobileLogOut />
      </div>
    </div>
  )
}
