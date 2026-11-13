import { useMemo, useState } from 'react'
import { useTeacherStore } from '@/stores/teacherStore'
import { useCalendar, type Member } from '@/hooks/useStudioData'
import { addDays, dayKey, parseDay } from '@/lib/studio/dates'
import { normaliseStatus } from '@/lib/utils/assignments'
import { Btn, Segmented } from '@/components/teacher/studio/ui'
import { REP_STATUS } from '@/lib/studio/labels'
import type { PracticeSession } from '@/types'

type Period = '30' | '90' | '365'

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

/**
 * A progress report over a period: lessons, practice, assignments, how
 * the repertoire moved, and a paragraph from you — printed, or copied into
 * a message to the family.
 */
export default function Report({ m, sessions, studio }: { m: Member; sessions: PracticeSession[]; studio: string }) {
  const [period, setPeriod] = useState<Period>('30')
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const today = dayKey(new Date())
  const from = addDays(today, -Number(period))
  const items = useCalendar(from, today).filter((i) => i.rosterIds.includes(m.id))
  const assignments = useTeacherStore((s) => s.assignments).filter((a) => (m.uid && a.studentId === m.uid) || a.rosterId === m.id)
  const added = useTeacherStore((s) => s.teacherPractice).filter((e) => e.rosterId === m.id && e.date >= from)
  const first = m.name.split(' ')[0]

  const r = useMemo(() => {
    const held = items.filter((i) => i.attendance[m.id])
    const present = held.filter((i) => i.attendance[m.id] === 'present').length
    const mins = sessions.filter((s) => s.date.slice(0, 10) >= from).reduce((a, s) => a + s.durationMinutes, 0) + added.reduce((a, e) => a + e.minutes, 0)
    const days = new Set(sessions.filter((s) => s.date.slice(0, 10) >= from).map((s) => s.date.slice(0, 10))).size
    const inPeriod = assignments.filter((a) => a.createdAt.slice(0, 10) >= from || (a.completedAt ?? '').slice(0, 10) >= from)
    const done = inPeriod.filter((a) => normaliseStatus(a.status) === 'approved').length
    const open = assignments.filter((a) => ['assigned', 'returned', 'submitted'].includes(normaliseStatus(a.status))).length
    const moved = (m.roster.repertoire ?? []).map((x) => {
      const before = [...x.history].reverse().find((h) => h.at.slice(0, 10) < from)?.status
      const now = x.status
      const label = (s?: string) => REP_STATUS.find((q) => q.value === s)?.label ?? s
      return before && before !== now ? `${x.title}: ${label(before)} → ${label(now)}` : !before && x.history[0]?.at.slice(0, 10) >= from ? `${x.title}: started` : `${x.title}: ${label(now)}`
    })
    return { held: held.length, present, mins, days, done, open, moved }
  }, [items, sessions, added, assignments, m, from])

  const periodLabel = `${parseDay(from).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${parseDay(today).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
  const stats: [string, string][] = [
    ['Lessons attended', r.held ? `${r.present} of ${r.held}` : '—'],
    ['Practice', m.onApp || added.length ? `${r.mins} min${m.onApp ? ` on ${r.days} days` : ''}` : 'Not tracked'],
    ['Assignments', `${r.done} done · ${r.open} open`],
  ]
  const text = `${m.name} — progress report\n${periodLabel}\n\n${stats.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nRepertoire\n${r.moved.join('\n') || '—'}\n\nFrom your teacher\n${note || '—'}\n\n${studio}`

  function print() {
    const w = window.open('', '_blank', 'width=800,height=900')
    if (!w) return
    w.document.write(`<!doctype html><title>${esc(m.name)} — progress report</title><style>body{font-family:-apple-system,system-ui,sans-serif;color:#3A3054;max-width:640px;margin:40px auto;padding:0 20px}h1{font-size:24px;margin:0}p.d{color:#6F6688}table{width:100%;border-collapse:collapse;margin:20px 0}td{padding:8px 0;border-top:1px solid #E4DEF0}td+td{text-align:right;font-weight:700}h2{font-size:15px;margin-top:24px}</style>
      <h1>${esc(m.name)}</h1><p class="d">Progress report · ${esc(periodLabel)} · ${esc(studio)}</p>
      <table>${stats.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
      <h2>Repertoire</h2>${r.moved.map((x) => `<div>${esc(x)}</div>`).join('') || '<div>—</div>'}
      <h2>From your teacher</h2><p style="white-space:pre-wrap">${esc(note || '—')}</p><script>print()</script>`)
    w.document.close()
  }

  return (
    <div className="px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="flex-1 text-[17px] font-bold" style={{ color: 'var(--clay-ink)' }}>Progress report · {m.name}</h2>
        <Segmented label="Period" value={period} onChange={setPeriod} options={[{ value: '30', label: '30 days' }, { value: '90', label: '3 months' }, { value: '365', label: 'Year' }]} />
      </div>
      <p className="mt-1 text-[13px]" style={{ color: 'var(--clay-dim)' }}>{periodLabel}</p>
      <div className="mt-4 grid grid-cols-1 overflow-hidden rounded-xl sm:grid-cols-3" style={{ border: '1px solid var(--clay-line)' }}>
        {stats.map(([k, v]) => (
          <div key={k} className="px-4 py-3" style={{ boxShadow: '-1px 0 0 var(--clay-line)' }}>
            <p className="text-[12px]" style={{ color: 'var(--clay-dim)' }}>{k}</p>
            <p className="mt-0.5 text-[18px] font-bold" style={{ color: 'var(--clay-ink)' }}>{v}</p>
          </div>
        ))}
      </div>
      <h3 className="mb-1.5 mt-5 text-[14px] font-bold" style={{ color: 'var(--clay-ink)' }}>Repertoire</h3>
      {r.moved.length ? r.moved.map((x) => <p key={x} className="py-0.5 text-[13.5px]" style={{ color: '#4F4766' }}>{x}</p>) : <p className="text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>Add pieces in the Repertoire tab to see them here.</p>}
      <h3 className="mb-1.5 mt-5 text-[14px] font-bold" style={{ color: 'var(--clay-ink)' }}>From you</h3>
      <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-xl border-0 p-3 text-[14px] outline-none" style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}
        placeholder={`${first} has made steady progress: the pulse is much more secure. Next: clean left-hand fingering, and practising slowly before speeding up.`} />
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn kind="primary" onClick={print}>Print or save as PDF</Btn>
        <Btn kind="soft" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { /* clipboard blocked */ } }}>{copied ? 'Copied' : 'Copy as text'}</Btn>
      </div>
    </div>
  )
}
