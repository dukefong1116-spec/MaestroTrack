import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useMembers, useStudioSettings } from '@/hooks/useStudioData'
import { saveStudioSettings, updateRosterStudent } from '@/lib/firebase/studio'
import { LENGTH_CHOICES, hasOwnLength, hasOwnPrice, lessonMinutes, lessonPriceCents } from '@/lib/studio/settings'
import { money } from '@/lib/studio/dates'
import { StudioPage, Btn } from '@/components/teacher/studio/ui'
import { inputCls, inputStyle } from '@/components/teacher/studio/tokens'
import type { LessonType, StudioSettings } from '@/types'

/**
 * The studio's settings, one topic to a page. They used to share the
 * Settings page itself, which made it a long form; now Settings is a list
 * of rows and each row opens one of these.
 */
export type StudioSettingsPart = 'lessons' | 'calendar'

/** A drop-down that sits in a line of text, so sized to its contents rather than the row. */
const inlineSelect = 'min-h-[40px] min-w-[120px] rounded-[10px] border-0 px-3 text-[14px] font-semibold outline-none focus:ring-2'

const TITLES: Record<StudioSettingsPart, { title: string; subtitle: string }> = {
  lessons: { title: 'Lessons and prices', subtitle: 'Default length, lesson types and what each costs' },
  calendar: { title: 'Calendar hours', subtitle: 'The hours the week view shows' },
}

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

export default function StudioSettingsPage({ part }: { part: StudioSettingsPart }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const settings = useStudioSettings()
  const members = useMembers()
  const [error, setError] = useState('')

  async function save(patch: Partial<StudioSettings>) {
    if (!profile) return
    setError('')
    try { await saveStudioSettings(profile.uid, patch) } catch { setError('Could not save. Check your connection — or the studio rules may not be published yet.') }
  }
  const types = settings.lessonTypes
  const setType = (i: number, patch: Partial<LessonType>) => save({ lessonTypes: types.map((t, j) => (j === i ? { ...t, ...patch } : t)) })
  const own = members.filter((m) => hasOwnLength(m.roster) || hasOwnPrice(m.roster))

  return (
    <StudioPage title={TITLES[part].title} subtitle={TITLES[part].subtitle} back={{ to: '/teacher/settings', label: 'Settings' }}>
      {error && <p className="px-6 py-2 text-[13px]" style={{ color: 'var(--clay-danger)', borderBottom: '1px solid var(--clay-line)' }}>{error}</p>}

      {part === 'lessons' && (
        <>
          <Section title="Default length" hint="New lessons start at this length. Any student, or any single lesson, can still be different." first>
            <select aria-label="Default lesson length" className={`${inputCls} max-w-[200px]`} style={inputStyle} value={settings.defaultLessonMinutes} onChange={(e) => save({ defaultLessonMinutes: Number(e.target.value) })}>
              {LENGTH_CHOICES.map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
          </Section>

          <Section title="Lesson types and prices" hint="What a lesson of each kind costs. A group class is priced per student.">
            <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--clay-line)' }}>
              <div className="hidden grid-cols-[minmax(0,1fr)_120px_110px_70px_40px] gap-2 px-3 py-2 text-[12px] font-semibold sm:grid" style={{ background: 'var(--clay-head)', color: 'var(--clay-dim)' }}>
                <span>Name</span><span>Length</span><span>Price a lesson</span><span>Group</span><span />
              </div>
              {types.map((t, i) => (
                <div key={t.id} className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_120px_110px_70px_40px]" style={{ borderTop: '1px solid var(--clay-line)' }}>
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
          </Section>

          <Section title="Students with their own length or price" hint="To change one lesson only, drag its bottom edge in the calendar, or open it.">
            {own.length === 0 && <p className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>None — everyone uses the studio defaults.</p>}
            {own.map((m, i) => (
              <div key={m.id} className="flex flex-wrap items-center gap-2 py-2" style={i ? { borderTop: '1px solid var(--clay-line)' } : undefined}>
                <span className="min-w-[200px] flex-1 text-[13.5px]" style={{ color: 'var(--clay-ink)' }}>
                  <strong>{m.name}</strong>
                  <span style={{ color: 'var(--clay-dim)' }}> · {lessonMinutes(m.roster, settings)} min{hasOwnLength(m.roster) ? '' : ' (default)'} · {money(lessonPriceCents(m.roster, settings))}{hasOwnPrice(m.roster) ? '' : ' (default)'}</span>
                </span>
                <Btn kind="link" onClick={() => navigate(`/teacher/students/${encodeURIComponent(m.id)}`)}>Change</Btn>
                <Btn kind="soft" onClick={() => void updateRosterStudent(m.id, { lessonMinutes: null, priceCents: null })}>Use defaults</Btn>
              </div>
            ))}
          </Section>
        </>
      )}

      {part === 'calendar' && (
        <Section title="Week view" hint="Lessons outside these hours still appear." first>
          <div className="flex flex-wrap items-center gap-2 text-[13.5px]" style={{ color: 'var(--clay-ink)' }}>
            From
            <select aria-label="Day starts" className={inlineSelect} style={inputStyle} value={settings.dayStart} onChange={(e) => save({ dayStart: Number(e.target.value) })}>
              {Array.from({ length: 13 }, (_, i) => i + 5).map((h) => <option key={h} value={h}>{h % 12 || 12} {h < 12 ? 'AM' : 'PM'}</option>)}
            </select>
            to
            <select aria-label="Day ends" className={inlineSelect} style={inputStyle} value={settings.dayEnd} onChange={(e) => save({ dayEnd: Number(e.target.value) })}>
              {Array.from({ length: 10 }, (_, i) => i + 15).map((h) => <option key={h} value={h}>{h % 12 || 12} {h < 12 || h === 24 ? 'AM' : 'PM'}</option>)}
            </select>
          </div>
        </Section>
      )}
    </StudioPage>
  )
}
