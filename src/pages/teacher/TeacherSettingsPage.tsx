import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, Palette, ShieldCheck, LifeBuoy, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { useMembers, useStudioSettings } from '@/hooks/useStudioData'
import { saveStudioSettings, updateRosterStudent } from '@/lib/firebase/studio'
import { updateUserProfile } from '@/lib/firebase/teacher'
import { LENGTH_CHOICES, hasOwnLength, hasOwnPrice, lessonMinutes, lessonPriceCents } from '@/lib/studio/settings'
import { money } from '@/lib/studio/dates'
import MobileLogOut from '@/components/layout/MobileLogOut'
import Avatar from '@/components/profile/Avatar'
import InviteSheet from '@/components/teacher/InviteSheet'
import { StudioPage, Btn } from '@/components/teacher/studio/ui'
import { inputCls, inputStyle } from '@/components/teacher/studio/tokens'
import type { LessonType, StudioSettings } from '@/types'

function Section({ title, hint, children, first }: { title: string; hint?: string; children: ReactNode; first?: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-2 px-5 py-5 sm:px-6" style={first ? undefined : { borderTop: '1px solid var(--clay-line)' }}>
      <div className="w-full sm:w-56 sm:shrink-0">
        <h2 className="text-[14.5px] font-bold" style={{ color: 'var(--clay-ink)' }}>{title}</h2>
        {hint && <p className="mt-1 text-[12.5px] leading-snug" style={{ color: 'var(--clay-dim)' }}>{hint}</p>}
      </div>
      <div className="min-w-0 flex-1 basis-[380px]">{children}</div>
    </div>
  )
}

function Toggle({ on, label, onFlip }: { on: boolean; label: string; onFlip: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onFlip} className="flex w-full items-center gap-3 py-2.5 text-left" style={{ borderBottom: '1px solid var(--clay-line)' }}>
      <span className="flex-1 text-[13.5px]" style={{ color: 'var(--clay-ink)' }}>{label}</span>
      <span className="relative inline-block h-[26px] w-11 shrink-0 rounded-full transition-colors" style={{ background: on ? 'var(--clay-accent)' : '#D9D2E8' }}>
        <span className="absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all" style={{ left: on ? 21 : 3, boxShadow: '0 1px 3px rgba(58,48,84,.3)' }} />
      </span>
    </button>
  )
}

function NavRow({ icon, label, to }: { icon: ReactNode; label: string; to: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid var(--clay-line)', color: 'var(--clay-ink)' }}>
      <span style={{ color: 'var(--clay-dim)' }}>{icon}</span>
      <span className="flex-1 text-[13.5px] font-semibold">{label}</span>
      <ChevronRight size={16} style={{ color: 'var(--clay-faint)' }} />
    </Link>
  )
}

/** A price field that saves when you leave it, not on every keystroke. */
function PriceInput({ cents, onSave, label }: { cents: number; onSave: (cents: number) => void; label: string }) {
  const [v, setV] = useState((cents / 100).toString())
  useEffect(() => setV((cents / 100).toString()), [cents])
  const commit = () => { const n = Math.round(Number(v) * 100); if (Number.isFinite(n) && n >= 0 && n !== cents) onSave(n); else setV((cents / 100).toString()) }
  return (
    <label className="flex items-center gap-1 rounded-[9px] px-2.5" style={inputStyle}>
      <span style={{ color: 'var(--clay-dim)' }}>$</span>
      <input type="number" min="0" step="1" aria-label={label} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        className="min-h-[38px] w-full min-w-0 border-0 bg-transparent text-[14px] font-bold outline-none" />
    </label>
  )
}

export default function TeacherSettingsPage() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const settings = useStudioSettings()
  const members = useMembers()
  const [studioName, setStudioName] = useState(profile?.studioName ?? '')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => setStudioName(profile?.studioName ?? ''), [profile?.studioName])

  async function save(patch: Partial<StudioSettings>) {
    if (!profile) return
    setError('')
    try { await saveStudioSettings(profile.uid, patch) } catch { setError('Could not save. Check your connection — or the studio rules may not be published yet.') }
  }
  const types = settings.lessonTypes
  const setType = (i: number, patch: Partial<LessonType>) => save({ lessonTypes: types.map((t, j) => (j === i ? { ...t, ...patch } : t)) })

  async function saveStudioName() {
    if (!profile || studioName.trim() === (profile.studioName ?? '')) return
    const live = useAuthStore.getState().profile
    if (live) useAuthStore.getState().setProfile({ ...live, studioName: studioName.trim() })
    await updateUserProfile(profile.uid, { studioName: studioName.trim() }).catch(() => setError('Could not save the studio name.'))
  }

  const own = members.filter((m) => hasOwnLength(m.roster) || hasOwnPrice(m.roster))

  return (
    <StudioPage title="Settings" subtitle="Your studio, lessons, prices and policies">
      {error && <p className="px-6 py-2 text-[13px]" style={{ color: 'var(--clay-danger)', borderBottom: '1px solid var(--clay-line)' }}>{error}</p>}

      <Section title="You and your studio" hint="Shown to students and on invoices." first>
        <Link to="/teacher/settings/profile" className="mb-3 flex items-center gap-3">
          <Avatar src={profile?.avatar} name={profile?.displayName} size={48} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold" style={{ color: 'var(--clay-ink)' }}>{profile?.displayName || 'Your profile'}</span>
            <span className="block text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>Name and photo</span>
          </span>
          <ChevronRight size={16} style={{ color: 'var(--clay-faint)' }} />
        </Link>
        <label className="block text-[12.5px] font-medium" style={{ color: 'var(--clay-dim)' }}>
          Studio name
          <input className={`${inputCls} mt-1 max-w-sm`} style={inputStyle} value={studioName} onChange={(e) => setStudioName(e.target.value)} onBlur={saveStudioName} placeholder="Harper Strings" />
        </label>
      </Section>

      <Section title="Lessons and prices" hint="New lessons start at the default length. Any student, or any single lesson, can still be different.">
        <label className="block text-[12.5px] font-medium" style={{ color: 'var(--clay-dim)' }}>
          Default lesson length
          <select className={`${inputCls} mt-1 max-w-[200px]`} style={inputStyle} value={settings.defaultLessonMinutes} onChange={(e) => save({ defaultLessonMinutes: Number(e.target.value) })}>
            {LENGTH_CHOICES.map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </label>

        <p className="mb-1.5 mt-4 text-[12.5px] font-medium" style={{ color: 'var(--clay-dim)' }}>Lesson types and prices</p>
        <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--clay-line)' }}>
          <div className="hidden grid-cols-[minmax(0,1fr)_110px_110px_70px_40px] gap-2 px-3 py-2 text-[12px] font-semibold sm:grid" style={{ background: '#FBFAFE', color: 'var(--clay-dim)' }}>
            <span>Name</span><span>Length</span><span>Price a lesson</span><span>Group</span><span />
          </div>
          {types.map((t, i) => (
            <div key={t.id} className="grid grid-cols-[minmax(0,1fr)_110px] items-center gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_110px_110px_70px_40px]" style={{ borderTop: '1px solid var(--clay-line)' }}>
              <input aria-label={`Name of lesson type ${i + 1}`} className={inputCls} style={inputStyle} defaultValue={t.name} onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && setType(i, { name: e.target.value.trim().slice(0, 60) })} />
              <select aria-label={`Length of ${t.name}`} className={inputCls} style={inputStyle} value={t.minutes} onChange={(e) => setType(i, { minutes: Number(e.target.value) })}>
                {[...new Set([...LENGTH_CHOICES, t.minutes])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
              <PriceInput cents={t.priceCents} label={`Price of ${t.name}, ${t.minutes} min`} onSave={(c) => setType(i, { priceCents: c })} />
              <label className="flex items-center gap-1.5 text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>
                <input type="checkbox" checked={!!t.group} onChange={(e) => setType(i, { group: e.target.checked || undefined })} style={{ accentColor: 'var(--clay-accent-ink)' }} className="h-4 w-4" /> <span className="sm:sr-only">Group class, per student</span>
              </label>
              <button type="button" aria-label={`Remove ${t.name}, ${t.minutes} min`} onClick={() => save({ lessonTypes: types.filter((_, j) => j !== i) })} className="flex h-9 w-9 items-center justify-center rounded-[9px]" style={{ color: 'var(--clay-dim)' }}><X size={15} /></button>
            </div>
          ))}
        </div>
        <Btn kind="link" className="mt-1" onClick={() => save({ lessonTypes: [...types, { id: `t${Date.now().toString(36)}`, name: 'Private lesson', minutes: 90, priceCents: 9000 }] })}>+ Add a lesson type</Btn>

        <p className="mb-1 mt-4 text-[12.5px] font-medium" style={{ color: 'var(--clay-dim)' }}>Students with their own length or price</p>
        {own.length === 0 && <p className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>None — everyone uses the studio defaults.</p>}
        {own.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-2 py-2" style={{ borderTop: '1px solid var(--clay-line)' }}>
            <span className="min-w-[200px] flex-1 text-[13.5px]" style={{ color: 'var(--clay-ink)' }}>
              <strong>{m.name}</strong>
              <span style={{ color: 'var(--clay-dim)' }}> · {lessonMinutes(m.roster, settings)} min{hasOwnLength(m.roster) ? '' : ' (default)'} · {money(lessonPriceCents(m.roster, settings))}{hasOwnPrice(m.roster) ? '' : ' (default)'}</span>
            </span>
            <Btn kind="link" onClick={() => navigate(`/teacher/students/${encodeURIComponent(m.id)}`)}>Change</Btn>
            <Btn kind="soft" onClick={() => void updateRosterStudent(m.id, { lessonMinutes: null, priceCents: null })}>Use defaults</Btn>
          </div>
        ))}
        <p className="mt-2 text-[12px]" style={{ color: 'var(--clay-dim)' }}>To change one lesson only, drag its bottom edge in the calendar, or open it.</p>
      </Section>

      <Section title="Cancellations and make-ups">
        <Toggle on={settings.policy.teacherCancelCredit} label="A lesson you cancel gives a make-up credit" onFlip={() => save({ policy: { ...settings.policy, teacherCancelCredit: !settings.policy.teacherCancelCredit } })} />
        <Toggle on={settings.policy.noticeCredit} label="A lesson the student cancels with notice gives a make-up credit" onFlip={() => save({ policy: { ...settings.policy, noticeCredit: !settings.policy.noticeCredit } })} />
        <label className="flex items-center gap-3 py-2.5 text-[13.5px]" style={{ color: 'var(--clay-ink)' }}>
          <span className="flex-1">Make-up credits expire after</span>
          <select className="min-h-[36px] rounded-[10px] border-0 px-2.5 text-[13px] font-semibold" style={inputStyle} value={settings.policy.creditExpiryDays ?? 0} onChange={(e) => save({ policy: { ...settings.policy, creditExpiryDays: Number(e.target.value) || null } })}>
            <option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option><option value={180}>6 months</option><option value={0}>Never</option>
          </select>
        </label>
      </Section>

      <Section title="Calendar" hint="The hours the week view shows. Lessons outside them still appear.">
        <div className="flex flex-wrap items-center gap-2 text-[13.5px]" style={{ color: 'var(--clay-ink)' }}>
          From
          <select className="min-h-[36px] rounded-[10px] border-0 px-2.5 font-semibold" style={inputStyle} value={settings.dayStart} onChange={(e) => save({ dayStart: Number(e.target.value) })}>
            {Array.from({ length: 13 }, (_, i) => i + 5).map((h) => <option key={h} value={h}>{h % 12 || 12} {h < 12 ? 'AM' : 'PM'}</option>)}
          </select>
          to
          <select className="min-h-[36px] rounded-[10px] border-0 px-2.5 font-semibold" style={inputStyle} value={settings.dayEnd} onChange={(e) => save({ dayEnd: Number(e.target.value) })}>
            {Array.from({ length: 10 }, (_, i) => i + 15).map((h) => <option key={h} value={h}>{h % 12 || 12} {h < 12 || h === 24 ? 'AM' : 'PM'}</option>)}
          </select>
        </div>
      </Section>

      <Section title="Students" hint="One invitation per student, good for a week.">
        <Btn kind="soft" onClick={() => setInviting(true)}>Invite a student</Btn>
      </Section>

      <Section title="App">
        <NavRow icon={<Bell size={18} />} label="Notifications" to="/teacher/settings/notifications" />
        <NavRow icon={<Palette size={18} />} label="Appearance" to="/teacher/settings/appearance" />
        <NavRow icon={<ShieldCheck size={18} />} label="Privacy & Security" to="/teacher/settings/privacy" />
        <NavRow icon={<LifeBuoy size={18} />} label="Support & Legal" to="/teacher/settings/about" />
        <p className="pt-3 text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>Signed in as {user?.email ?? '—'}</p>
      </Section>

      <div className="px-5 pb-5 sm:px-6"><MobileLogOut /></div>
      {profile && <InviteSheet open={inviting} onClose={() => setInviting(false)} profile={profile} />}
    </StudioPage>
  )
}
