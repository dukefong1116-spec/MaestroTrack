import { useEffect, useMemo, useState } from 'react'
import { useTeacherStore } from '@/stores/teacherStore'
import { useAllLessons, useCalendar, useStudioSettings, type Member } from '@/hooks/useStudioData'
import { updateRosterStudent } from '@/lib/firebase/studio'
import { creditsFor } from '@/lib/studio/billing'
import { addDays, clock, dayKey, money } from '@/lib/studio/dates'
import { LENGTH_CHOICES, hasOwnLength, hasOwnPrice, lessonMinutes, lessonPriceCents, typePriceCents } from '@/lib/studio/settings'
import { getAnalyticsSummary } from '@/lib/utils/analytics'
import { needsReview, isOpen } from '@/lib/utils/assignments'
import { inputCls, inputStyle } from '@/components/teacher/studio/tokens'

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function Cell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 py-4 sm:px-6" style={{ boxShadow: '-1px 0 0 var(--clay-line), 0 -1px 0 var(--clay-line)' }}>
      <h2 className="mb-3 text-[14.5px] font-bold" style={{ color: 'var(--clay-ink)' }}>{title}</h2>
      {children}
    </section>
  )
}

export default function Overview({ m }: { m: Member }) {
  const settings = useStudioSettings()
  const families = useTeacherStore((s) => s.families)
  const sessions = useTeacherStore((s) => s.studentSessions)
  const assignments = useTeacherStore((s) => s.assignments)
  const lessons = useAllLessons()
  const today = dayKey(new Date())
  const items = useCalendar(addDays(today, -(settings.policy.creditExpiryDays ?? 365)), today)
  const r = m.roster
  const fam = families.find((f) => f.id === r.familyId)
  const weekly = lessons.filter((l) => l.rosterIds.includes(m.id) && (!l.endsOn || l.endsOn >= today))
  const credits = creditsFor(m.id, items, settings, r.creditAdjust ?? 0, today)
  const len = lessonMinutes(r, settings)
  const [price, setPrice] = useState(r.priceCents != null ? String(r.priceCents / 100) : '')
  useEffect(() => setPrice(r.priceCents != null ? String(r.priceCents / 100) : ''), [r.priceCents])
  const [contact, setContact] = useState({ parentName: r.parentName ?? '', email: r.email ?? '', phone: r.phone ?? '' })
  useEffect(() => setContact({ parentName: r.parentName ?? '', email: r.email ?? '', phone: r.phone ?? '' }), [r.parentName, r.email, r.phone])
  const mine = assignments.filter((a) => (m.uid && a.studentId === m.uid) || a.rosterId === m.id)
  const week = m.uid ? getAnalyticsSummary(sessions[m.uid] ?? [], m.profile?.weeklyGoalMinutes ?? 300) : null
  const attended = useMemo(() => items.filter((i) => i.rosterIds.includes(m.id) && i.attendance[m.id] === 'present').length, [items, m.id])
  const held = useMemo(() => items.filter((i) => i.rosterIds.includes(m.id) && i.attendance[m.id]).length, [items, m.id])

  const savePrice = () => {
    const v = price.trim()
    const cents = v === '' ? null : Math.round(Number(v) * 100)
    if (cents !== null && !(cents >= 0)) return
    if (cents !== (r.priceCents ?? null)) void updateRosterStudent(m.id, { priceCents: cents })
  }
  const saveContact = (k: keyof typeof contact) => {
    const v = contact[k].trim()
    if (v !== (r[k] ?? '')) void updateRosterStudent(m.id, { [k]: v || undefined })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      <Cell title="Contact and family">
        <label className="block text-[12.5px] font-medium" style={{ color: 'var(--clay-dim)' }}>Family
          <select className={`${inputCls} mt-1`} style={inputStyle} value={r.familyId ?? ''} onChange={(e) => void updateRosterStudent(m.id, { familyId: e.target.value || undefined })}>
            <option value="">Not in a family</option>
            {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        {fam && fam.contacts.length > 0 && (
          <p className="mt-2 text-[13px]" style={{ color: '#4F4766' }}>{fam.contacts.map((c) => [c.name, c.email, c.phone].filter(Boolean).join(' · ')).join(' / ')}</p>
        )}
        <div className="mt-3 grid gap-2">
          {(['parentName', 'email', 'phone'] as const).map((k) => (
            <label key={k} className="block text-[12.5px] font-medium" style={{ color: 'var(--clay-dim)' }}>
              {k === 'parentName' ? 'Parent or guardian' : k === 'email' ? 'Email' : 'Phone'}
              <input className={`${inputCls} mt-1 font-normal`} style={inputStyle} type={k === 'email' ? 'email' : k === 'phone' ? 'tel' : 'text'} value={contact[k]} onChange={(e) => setContact({ ...contact, [k]: e.target.value })} onBlur={() => saveContact(k)} />
            </label>
          ))}
          {m.onApp && m.profile?.email && <p className="text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>Their account: {m.profile.email}</p>}
        </div>
      </Cell>

      <Cell title="Weekly lesson">
        <p className="text-[13.5px]" style={{ color: '#4F4766' }}>
          {weekly.length ? weekly.map((l) => `${DAY[l.dayOfWeek]}s at ${clock(l.startTime)}${l.where ? ` · ${l.where}` : ''}${l.rosterIds.length > 1 ? ` (${l.title})` : ''}`).join('; ') : 'Not on the calendar yet — add a lesson from the calendar.'}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <label className="block text-[12.5px] font-medium" style={{ color: 'var(--clay-dim)' }}>Length
            <select className={`${inputCls} mt-1`} style={inputStyle} value={hasOwnLength(r) ? String(len) : 'default'} onChange={(e) => void updateRosterStudent(m.id, { lessonMinutes: e.target.value === 'default' ? null : Number(e.target.value) })}>
              <option value="default">Studio default ({settings.defaultLessonMinutes} min)</option>
              {LENGTH_CHOICES.map((x) => <option key={x} value={x}>{x} min</option>)}
            </select>
          </label>
          <label className="block text-[12.5px] font-medium" style={{ color: 'var(--clay-dim)' }}>Price a lesson ($)
            <input type="number" min="0" step="1" className={`${inputCls} mt-1`} style={inputStyle} value={price} placeholder={`${typePriceCents(len, settings) / 100} (default)`} onChange={(e) => setPrice(e.target.value)} onBlur={savePrice} />
          </label>
        </div>
        <p className="mt-2 text-[12px]" style={{ color: 'var(--clay-dim)' }}>
          {m.name.split(' ')[0]} pays {money(lessonPriceCents(r, settings))} for {len} min{hasOwnLength(r) || hasOwnPrice(r) ? ', set just for them' : ', the studio default'}. One lesson can still differ: drag it in the calendar.
        </p>
        <div className="mt-3 flex items-center gap-2.5 pt-3" style={{ borderTop: '1px solid var(--clay-line)' }}>
          <span className="flex-1 text-[13.5px]" style={{ color: 'var(--clay-ink)' }}>Make-up credits <strong className="ml-1.5 text-[16px]">{credits}</strong></span>
          <button type="button" aria-label="Remove a make-up credit" disabled={credits === 0} onClick={() => void updateRosterStudent(m.id, { creditAdjust: (r.creditAdjust ?? 0) - 1 })} className="h-9 w-9 rounded-[10px] text-[16px] disabled:opacity-40" style={inputStyle}>−</button>
          <button type="button" aria-label="Add a make-up credit" onClick={() => void updateRosterStudent(m.id, { creditAdjust: (r.creditAdjust ?? 0) + 1 })} className="h-9 w-9 rounded-[10px] text-[16px]" style={inputStyle}>+</button>
        </div>
      </Cell>

      <Cell title="At a glance">
        {[
          ['Lessons attended', held ? `${attended} of ${held} recorded` : '—'],
          ['Open assignments', String(mine.filter(isOpen).length)],
          ['Waiting for your review', String(mine.filter(needsReview).length)],
          ['Practice this week', week ? `${week.totalMinutesThisWeek} min` : 'Not on the app'],
          ['Practice streak', week ? `${week.currentStreak} days` : '—'],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between py-1.5 text-[13.5px]"><span style={{ color: 'var(--clay-dim)' }}>{k}</span><strong style={{ color: 'var(--clay-ink)' }}>{v}</strong></div>
        ))}
      </Cell>
    </div>
  )
}
