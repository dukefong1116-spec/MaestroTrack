import { useMemo, useState } from 'react'
import { useTeacherStore } from '@/stores/teacherStore'
import { useCalendar, type Member } from '@/hooks/useStudioData'
import { addDays, dayKey, parseDay } from '@/lib/studio/dates'
import { normaliseStatus } from '@/lib/utils/assignments'
import { Btn, Segmented } from '@/components/teacher/studio/ui'
import { REP_STATUS } from '@/lib/studio/labels'
import type { PracticeSession } from '@/types'

type Period = '30' | '90' | '365'

/** 45 min, 2 h, 3 h 20 min — a year of practice reads badly as 7,380 min. */
const fmtMinutes = (n: number) => (n < 60 ? `${n} min` : `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60} min` : ''}`)

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
    // A lesson the teacher cancelled was never the student's to attend.
    const held = items.filter((i) => i.attendance[m.id] && i.attendance[m.id] !== 'teacher_cancel')
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

  // The year on both ends when they differ: a year's report otherwise
  // read "November 15 – November 15, 2026".
  const sameYear = from.slice(0, 4) === today.slice(0, 4)
  const periodLabel = `${parseDay(from).toLocaleDateString('en-US', { month: 'long', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })} – ${parseDay(today).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
  const stats: [string, string][] = [
    ['Lessons attended', r.held ? `${r.present} of ${r.held}` : '—'],
    ['Practice', m.onApp || added.length ? `${fmtMinutes(r.mins)}${m.onApp ? ` on ${r.days} ${r.days === 1 ? 'day' : 'days'}` : ''}` : 'Not tracked'],
    ['Assignments', `${r.done} done · ${r.open} open`],
  ]
  const byline = [periodLabel, studio].filter(Boolean).join(' · ')
  const text = [
    `${m.name} — progress report`,
    byline,
    '',
    ...stats.map(([k, v]) => `${k}: ${v}`),
    '',
    'Repertoire',
    ...(r.moved.length ? r.moved.map((x) => `• ${x}`) : ['—']),
    '',
    'From your teacher',
    note.trim() || '—',
  ].join('\n')

  function print() {
    const w = window.open('', '_blank', 'width=800,height=900')
    if (!w) return
    w.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(m.name)} — progress report</title><style>body{font-family:-apple-system,system-ui,sans-serif;color:#0F1B2A;max-width:640px;margin:40px auto;padding:0 20px;line-height:1.5}h1{font-size:24px;margin:0}p.d{color:#5E7088;margin:4px 0 0}table{width:100%;border-collapse:collapse;margin:24px 0}td{padding:9px 0;border-top:1px solid #D8E5EC}tr:last-child td{border-bottom:1px solid #D8E5EC}td+td{text-align:right;font-weight:700}h2{font-size:15px;margin:24px 0 6px}ul{margin:0;padding-left:20px}li{padding:2px 0}p.n{white-space:pre-wrap;margin:0}</style></head><body>
      <h1>${esc(m.name)}</h1><p class="d">Progress report · ${esc(byline)}</p>
      <table>${stats.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
      <h2>Repertoire</h2>${r.moved.length ? `<ul>${r.moved.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="n">—</p>'}
      <h2>From your teacher</h2><p class="n">${esc(note.trim() || '—')}</p><script>print()</script></body></html>`)
    w.document.close()
  }

  return (
    <div className="px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="min-w-[230px] flex-1 text-[17px] font-bold" style={{ color: 'var(--clay-ink)' }}>Progress report · {m.name}</h2>
        <Segmented label="Period" value={period} onChange={setPeriod} options={[{ value: '30', label: '30 days' }, { value: '90', label: '3 months' }, { value: '365', label: 'Year' }]} />
      </div>
      <p className="mt-1 text-[13px]" style={{ color: 'var(--clay-dim)' }}>{periodLabel}</p>
      {/* Rules between the cells whichever way they stack: a left-edge
          shadow alone left the phone's single column with no dividers. */}
      <div className="mt-4 grid grid-cols-1 divide-y overflow-hidden rounded-xl sm:grid-cols-3 sm:divide-x sm:divide-y-0" style={{ border: '1px solid var(--clay-line)', borderColor: 'var(--clay-line)' }}>
        {stats.map(([k, v]) => (
          <div key={k} className="px-4 py-3" style={{ borderColor: 'var(--clay-line)' }}>
            <p className="text-[12px]" style={{ color: 'var(--clay-dim)' }}>{k}</p>
            <p className="mt-0.5 text-[18px] font-bold" style={{ color: 'var(--clay-ink)' }}>{v}</p>
          </div>
        ))}
      </div>
      <h3 className="mb-1.5 mt-5 text-[14px] font-bold" style={{ color: 'var(--clay-ink)' }}>Repertoire</h3>
      {r.moved.length ? <ul className="list-disc space-y-0.5 pl-5 text-[13.5px]" style={{ color: 'var(--clay-ink-soft)' }}>{r.moved.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>Add pieces in the Repertoire tab to see them here.</p>}
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
