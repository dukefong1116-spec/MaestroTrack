import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Camera, Check, Mail, KeyRound } from 'lucide-react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { updateUserProfile } from '@/lib/firebase/teacher'
import { changeEmail, changePassword, authErrorMessage } from '@/lib/firebase/account'
import { INSTRUMENT_LIST, INSTRUMENT_THEMES } from '@/lib/utils/instruments'
import Avatar from '@/components/profile/Avatar'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import type { InstrumentType } from '@/types'

const schema = z.object({
  displayName: z.string().min(2, 'Use at least two characters.'),
  // Derived from the list the picker renders, so an instrument added to
  // one can never be rejected by the other.
  instrument: z.enum(INSTRUMENT_LIST as [InstrumentType, ...InstrumentType[]]),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced', 'professional']),
  weeklyGoalMinutes: z.coerce.number().min(30, 'At least 30 minutes.'),
})
type FormData = z.infer<typeof schema>

/** One surface with hairline rules, not a stack of floating cards. */
function Block({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div
      className="px-5 py-6 sm:px-6"
      style={first ? undefined : { borderTop: '1px solid var(--clay-line)' }}
    >
      {children}
    </div>
  )
}

/**
 * A row that opens a sheet.
 *
 * Email and password are not part of the profile form — they are separate
 * operations with their own confirmation and their own failure modes. Left
 * inline they each needed a save button of their own, which put three
 * competing "save" actions on one screen. Behind a row there is exactly
 * one action on the page, and exactly one inside the sheet.
 */
function SheetRow({
  icon, label, value, onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 px-5 py-5 text-left transition-transform active:scale-[.99] sm:px-6"
      style={{ borderTop: '1px solid var(--clay-line)' }}
    >
      <span className="flex shrink-0" style={{ color: 'var(--clay-dim)' }}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold" style={{ color: 'var(--clay-ink)' }}>{label}</span>
        <span className="block truncate text-xs" style={{ color: 'var(--clay-dim)' }}>{value}</span>
      </span>
      <ChevronRight size={18} className="shrink-0" style={{ color: 'var(--clay-faint)' }} />
    </button>
  )
}

function Note({ tone, children }: { tone: 'ok' | 'bad'; children: React.ReactNode }) {
  return (
    <p className="mt-3 text-[13px] font-medium" style={{ color: tone === 'ok' ? '#2E8B62' : 'var(--clay-danger)' }}>
      {children}
    </p>
  )
}

export default function ProfilePage() {
  const { profile, user } = useAuth()
  const { setProfile } = useAuthStore()
  const navigate = useNavigate()

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [emailOpen, setEmailOpen] = useState(false)
  const [emailPw, setEmailPw] = useState('')
  const [nextEmail, setNextEmail] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailErr, setEmailErr] = useState('')
  /** Shown on the page once the sheet has closed. */
  const [emailDone, setEmailDone] = useState('')

  const [pwOpen, setPwOpen] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwErr, setPwErr] = useState('')
  const [pwDone, setPwDone] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      displayName: profile?.displayName ?? '',
      instrument: profile?.instrument,
      experienceLevel: profile?.experienceLevel,
      weeklyGoalMinutes: profile?.weeklyGoalMinutes ?? 300,
    },
  })

  function closeEmail() {
    setEmailOpen(false)
    setEmailPw(''); setNextEmail(''); setEmailErr('')
  }
  function closePassword() {
    setPwOpen(false)
    setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwErr('')
  }

  async function onSubmit(data: FormData) {
    const uid = profile?.uid ?? user?.uid
    if (!uid) return
    setSaving(true); setSaved(false); setSaveError('')
    try {
      await updateUserProfile(uid, data)
      const updated = {
        ...(profile ?? { uid, email: user?.email ?? '', role: 'student' as const, createdAt: new Date().toISOString() }),
        ...data,
        updatedAt: new Date().toISOString(),
      }
      setProfile(updated)
      localStorage.setItem(`maestro_profile_${uid}`, JSON.stringify(updated))
      setSaved(true)
    } catch (e) {
      setSaveError(authErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function onChangeEmail() {
    setEmailErr('')
    if (!nextEmail.trim()) { setEmailErr('Enter the new address.'); return }
    if (!emailPw) { setEmailErr('Enter your current password to confirm.'); return }
    setEmailBusy(true)
    try {
      const sentTo = nextEmail.trim()
      await changeEmail(emailPw, sentTo)
      setEmailDone(`Check ${sentTo} — the address changes once you open the link we sent.`)
      closeEmail()
    } catch (e) {
      setEmailErr(authErrorMessage(e))
    } finally {
      setEmailBusy(false)
    }
  }

  async function onChangePassword() {
    setPwErr('')
    if (newPw.length < 8) { setPwErr('Use at least 8 characters.'); return }
    if (newPw !== confirmPw) { setPwErr('Those two do not match.'); return }
    setPwBusy(true)
    try {
      await changePassword(currentPw, newPw)
      setPwDone('Password updated.')
      closePassword()
    } catch (e) {
      setPwErr(authErrorMessage(e))
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <div className="max-w-2xl">
      {/* pr-14 clears the floating notification bell on a phone, the same
          allowance PageHeader makes. */}
      <div className="mb-6 flex items-center gap-3 pr-14 lg:mb-8 lg:pr-0">
        <Link
          to="/student/settings"
          aria-label="Back to Settings"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
          style={{ background: 'var(--clay-surface)', boxShadow: 'var(--clay-raised)', color: 'var(--clay-ink)' }}
        >
          <ChevronLeft size={20} />
        </Link>
        <h1
          className="text-[22px] font-bold leading-tight lg:text-[26px]"
          style={{ color: 'var(--clay-ink)', fontFamily: 'var(--clay-font)' }}
        >
          Edit Profile
        </h1>
      </div>

      <div
        className="overflow-hidden"
        style={{
          background: 'var(--clay-surface)',
          borderRadius: 'var(--clay-r-md)',
          boxShadow: 'var(--clay-raised)',
        }}
      >
        {/* Photo — the camera badge is the way in, as on the phone */}
        <Block first>
          <div className="flex justify-center">
            <Link
              to="/student/settings/profile/photo"
              aria-label="Change profile photo"
              className="relative inline-flex transition-transform active:scale-95"
            >
              <Avatar
                src={profile?.avatar}
                name={profile?.displayName}
                instrument={profile?.instrument as InstrumentType | undefined}
                size={96}
              />
              <span
                className="absolute -bottom-0.5 -right-0.5 flex h-9 w-9 items-center justify-center rounded-full"
                style={{
                  background: 'var(--clay-accent)',
                  color: 'var(--clay-on-accent)',
                  border: '3px solid var(--clay-surface)',
                  boxShadow: 'var(--clay-accent-shadow)',
                }}
              >
                <Camera size={16} />
              </span>
            </Link>
          </div>
        </Block>

        {/* Your details — the only thing the Save button at the bottom
            acts on. */}
        <Block>
          <p className="mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clay-dim)' }}>
            Your details
          </p>
          <form id="profile-details" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Display Name" error={errors.displayName?.message} {...register('displayName')} />
            <Select
              label="Instrument"
              options={INSTRUMENT_LIST.map((i) => ({ value: i, label: INSTRUMENT_THEMES[i].label }))}
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
            <Input
              label="Weekly Goal (minutes)"
              type="number"
              error={errors.weeklyGoalMinutes?.message}
              {...register('weeklyGoalMinutes')}
            />
          </form>
          {saved && <Note tone="ok"><Check size={13} className="mr-1 inline" />Saved.</Note>}
          {saveError && <Note tone="bad">{saveError}</Note>}
        </Block>

        <SheetRow
          icon={<Mail size={19} />}
          label="Change email"
          value={user?.email ?? '—'}
          onClick={() => { setEmailDone(''); setEmailOpen(true) }}
        />
        <SheetRow
          icon={<KeyRound size={19} />}
          label="Change password"
          value="••••••••"
          onClick={() => { setPwDone(''); setPwOpen(true) }}
        />
      </div>

      {emailDone && <Note tone="ok">{emailDone}</Note>}
      {pwDone && <Note tone="ok"><Check size={13} className="mr-1 inline" />{pwDone}</Note>}

      {/* The one save on this screen. */}
      <div className="mt-6 flex gap-3">
        <Button type="submit" form="profile-details" className="flex-1" loading={isSubmitting || saving}>
          Save changes
        </Button>
        <Button variant="outline" onClick={() => navigate('/student/settings')}>
          Cancel
        </Button>
      </div>

      <Modal open={emailOpen} onClose={closeEmail} title="Change email" size="sm">
        <p className="mb-5 text-sm" style={{ color: 'var(--clay-dim)' }}>
          You sign in with this. The new address only takes over once you open the link we send to it —
          until then, <span style={{ color: 'var(--clay-ink)', fontWeight: 600 }}>{user?.email}</span> keeps working.
        </p>
        <div className="space-y-4">
          <Input
            id="new-email"
            label="New email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={nextEmail}
            onChange={(e) => setNextEmail(e.target.value)}
          />
          <Input
            // Explicit, because Input derives an id from its label and both
            // sheets have a field called "Current password".
            id="email-current-password"
            label="Current password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={emailPw}
            onChange={(e) => setEmailPw(e.target.value)}
          />
          {emailErr && <Note tone="bad">{emailErr}</Note>}
          <Button className="w-full" onClick={onChangeEmail} loading={emailBusy}>
            Send confirmation
          </Button>
        </div>
      </Modal>

      <Modal open={pwOpen} onClose={closePassword} title="Change password" size="sm">
        <p className="mb-5 text-sm" style={{ color: 'var(--clay-dim)' }}>
          At least 8 characters. You stay signed in on this device.
        </p>
        <div className="space-y-4">
          <Input
            id="pw-current"
            label="Current password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
          />
          <Input
            id="pw-new"
            label="New password"
            type="password"
            autoComplete="new-password"
            placeholder="Enter a new password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
          />
          <Input
            id="pw-confirm"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            placeholder="Type it again"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
          />
          {pwErr && <Note tone="bad">{pwErr}</Note>}
          <Button className="w-full" onClick={onChangePassword} loading={pwBusy}>
            Update password
          </Button>
        </div>
      </Modal>
    </div>
  )
}
