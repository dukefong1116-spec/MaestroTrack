import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import type { Member } from '@/hooks/useStudioData'
import { suggestCorrection, withdrawCorrection, addTeacherPractice, deleteTeacherPractice } from '@/lib/firebase/studio'
import { getAnalyticsSummary, getDailyData, getCategoryData, getHeatmapData } from '@/lib/utils/analytics'
import { dayKey, parseDay } from '@/lib/studio/dates'
import PracticeBarChart from '@/components/charts/PracticeBarChart'
import CategoryPieChart from '@/components/charts/CategoryPieChart'
import PracticeHeatmap from '@/components/charts/PracticeHeatmap'
import { Btn, Pill, Field } from '@/components/teacher/studio/ui'
import { inputCls, inputStyle } from '@/components/teacher/studio/tokens'
import type { PracticeSession, PracticeSummary } from '@/types'

/**
 * Their practice: the charts, the log line by line, and two things you can
 * do with it. Suggest a correction — it changes only if they accept it,
 * since the log is theirs. Or add practice they told you about; it shows
 * in their log as added by you and never counts toward the league.
 */
export default function Practice({ m, sessions, summary }: { m: Member; sessions: PracticeSession[]; summary: PracticeSummary | null | undefined }) {
  const { profile } = useAuth()
  const corrections = useTeacherStore((s) => s.corrections)
  const added = useTeacherStore((s) => s.teacherPractice)
  const [editing, setEditing] = useState<string | null>(null)
  const [mins, setMins] = useState('')
  const [why, setWhy] = useState('')
  const [adding, setAdding] = useState(false)
  const [addDate, setAddDate] = useState(dayKey(new Date()))
  const [addMins, setAddMins] = useState('30')
  const [addWhat, setAddWhat] = useState('')
  const [error, setError] = useState('')
  const first = m.name.split(' ')[0]

  const stats = useMemo(() => getAnalyticsSummary(sessions, m.profile?.weeklyGoalMinutes ?? 300), [sessions, m.profile?.weeklyGoalMinutes])
  const daily = useMemo(() => getDailyData(sessions, 14), [sessions])
  const cats = useMemo(() => getCategoryData(sessions), [sessions])
  const heat = useMemo(() => getHeatmapData(sessions), [sessions])
  const mineCorr = corrections.filter((c) => c.studentId === m.uid)
  const mineAdded = added.filter((e) => e.rosterId === m.id).sort((a, b) => b.date.localeCompare(a.date))
  const log = summary?.recentSessions ?? []

  async function send(sessionId: string, date: string, from: number) {
    if (!profile || !m.uid) return
    const to = Math.round(Number(mins))
    if (!(to >= 0) || to === from) { setError('Enter the minutes you think it should be.'); return }
    setError('')
    try {
      await suggestCorrection({ teacherId: profile.uid, studentId: m.uid, sessionId, sessionDate: date, fromMinutes: from, toMinutes: to, reason: why.trim() || undefined })
      setEditing(null); setMins(''); setWhy('')
    } catch { setError('Could not send it. The studio rules may not be published yet.') }
  }

  async function add() {
    if (!profile) return
    const n = Math.round(Number(addMins))
    if (!(n > 0 && n <= 600)) return
    try {
      await addTeacherPractice({ teacherId: profile.uid, rosterId: m.id, studentUid: m.uid ?? '', date: addDate, minutes: n, what: addWhat.trim() || undefined })
      setAdding(false); setAddWhat('')
    } catch { setError('Could not add it. The studio rules may not be published yet.') }
  }

  return (
    <div>
      {m.onApp && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4">
            {[['This week', `${stats.totalMinutesThisWeek} min`], ['Streak', `${stats.currentStreak} days`], ['Consistency', `${stats.consistencyScore}%`], ['Weekly goal', `${stats.weeklyGoalPercentage}%`]].map(([k, v]) => (
              <div key={k} className="px-5 py-3.5 sm:px-6" style={{ boxShadow: '-1px 0 0 var(--clay-line), 0 1px 0 var(--clay-line)' }}>
                <p className="text-[12px]" style={{ color: 'var(--clay-dim)' }}>{k}</p>
                <p className="text-[19px] font-bold" style={{ color: 'var(--clay-ink)' }}>{v}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-5 sm:px-6" style={{ boxShadow: '1px 0 0 var(--clay-line), 0 1px 0 var(--clay-line)' }}>
              <p className="mb-3 text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--clay-dim)' }}>Last 14 days</p>
              <PracticeBarChart data={daily} color="#FF7A5C" />
            </div>
            <div className="p-5 sm:px-6" style={{ boxShadow: '0 1px 0 var(--clay-line)' }}>
              <p className="mb-3 text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--clay-dim)' }}>What they practise</p>
              <CategoryPieChart data={cats} />
            </div>
          </div>
          <div className="p-5 sm:px-6" style={{ borderBottom: '1px solid var(--clay-line)' }}>
            <p className="mb-3 text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--clay-dim)' }}>The year</p>
            <PracticeHeatmap data={heat} color="#FF7A5C" />
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 px-5 pb-2 pt-4 sm:px-6">
        <h2 className="flex-1 text-[15px] font-bold" style={{ color: 'var(--clay-ink)' }}>Practice log</h2>
        <Btn kind="soft" onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : `+ Add practice for ${first}`}</Btn>
      </div>
      {error && <p className="px-6 pb-2 text-[13px]" style={{ color: 'var(--clay-danger)' }}>{error}</p>}
      {adding && (
        <div className="mx-5 mb-3 flex flex-wrap items-end gap-2.5 rounded-xl p-3 sm:mx-6" style={{ background: 'var(--clay-bg)' }}>
          <Field label="Day" className="w-40"><input type="date" className={inputCls} style={{ ...inputStyle, background: '#fff' }} value={addDate} max={dayKey(new Date())} onChange={(e) => setAddDate(e.target.value)} /></Field>
          <Field label="Minutes" className="w-24"><input type="number" min={1} max={600} className={inputCls} style={{ ...inputStyle, background: '#fff' }} value={addMins} onChange={(e) => setAddMins(e.target.value)} /></Field>
          <Field label="What (optional)" className="min-w-[180px] flex-1"><input className={inputCls} style={{ ...inputStyle, background: '#fff' }} value={addWhat} onChange={(e) => setAddWhat(e.target.value)} placeholder="Told me in the lesson" /></Field>
          <Btn kind="primary" onClick={add}>Add</Btn>
        </div>
      )}
      {mineAdded.map((e) => (
        <div key={e.id} className="flex flex-wrap items-center gap-2.5 px-5 py-2.5 sm:px-6" style={{ borderTop: '1px solid var(--clay-line)' }}>
          <strong className="w-28 text-[13.5px]" style={{ color: 'var(--clay-ink)' }}>{parseDay(e.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
          <span className="flex-1 text-[13.5px]" style={{ color: '#4F4766' }}>{e.minutes} min{e.what ? ` · ${e.what}` : ''}</span>
          <Pill>Added by you</Pill>
          <button type="button" onClick={() => void deleteTeacherPractice(e.id)} className="text-[12.5px] font-semibold" style={{ color: 'var(--clay-dim)' }}>Remove</button>
        </div>
      ))}
      {!m.onApp && mineAdded.length === 0 && <p className="px-6 pb-4 text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>{first} isn’t on the app, so practice is only what you add here.</p>}
      {m.onApp && log.length === 0 && <p className="px-6 pb-4 text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>The log appears here after {first} next opens the app.</p>}
      {log.map((s) => {
        const pending = mineCorr.find((c) => c.sessionId === s.id && c.status === 'pending')
        const decided = mineCorr.filter((c) => c.sessionId === s.id && c.status !== 'pending').at(-1)
        return (
          <div key={s.id} className="px-5 py-2.5 sm:px-6" style={{ borderTop: '1px solid var(--clay-line)' }}>
            <div className="flex flex-wrap items-center gap-2.5">
              <strong className="w-28 text-[13.5px]" style={{ color: 'var(--clay-ink)' }}>{parseDay(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
              <span className="flex-1 text-[13.5px]" style={{ color: '#4F4766' }}>{s.minutes} min · {s.category}</span>
              {pending ? (
                <>
                  <Pill tone="warning">Suggested {pending.toMinutes} min · waiting for {first}</Pill>
                  <button type="button" onClick={() => void withdrawCorrection(pending.id)} className="text-[12.5px] font-semibold" style={{ color: 'var(--clay-dim)' }}>Withdraw</button>
                </>
              ) : (
                <>
                  {decided && <Pill tone={decided.status === 'accepted' ? 'success' : 'neutral'}>{decided.status === 'accepted' ? `${first} accepted your correction` : `${first} kept ${decided.fromMinutes} min`}</Pill>}
                  {editing !== s.id && <Btn kind="link" onClick={() => { setEditing(s.id); setMins(String(s.minutes)); setWhy('') }}>Suggest a correction</Btn>}
                </>
              )}
            </div>
            {editing === s.id && (
              <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl p-2.5" style={{ background: 'var(--clay-bg)' }}>
                <Field label="Minutes" className="w-24"><input type="number" min={0} className={inputCls} style={{ ...inputStyle, background: '#fff' }} value={mins} onChange={(e) => setMins(e.target.value)} /></Field>
                <Field label="Why" className="min-w-[200px] flex-1"><input className={inputCls} style={{ ...inputStyle, background: '#fff' }} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="The timer ran on after you stopped" /></Field>
                <Btn kind="soft" style={{ background: '#fff' }} onClick={() => setEditing(null)}>Cancel</Btn>
                <Btn kind="primary" onClick={() => send(s.id, s.date, s.minutes)}>Send to {first}</Btn>
              </div>
            )}
          </div>
        )
      })}
      <p className="px-5 py-3 text-[12px] sm:px-6" style={{ color: 'var(--clay-dim)', borderTop: '1px solid var(--clay-line)' }}>
        The log is {first}’s own: a correction only applies if {first} accepts it. Private practice notes are never shared.
      </p>
    </div>
  )
}
