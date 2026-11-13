import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { useMembers, type Member } from '@/hooks/useStudioData'
import { createAssignment, deleteAssignment, reviewAssignment } from '@/lib/firebase/assignments'
import { uploadAttachment } from '@/lib/firebase/studio'
import { normaliseStatus, needsReview, deriveDailyProgress, deriveProgress } from '@/lib/utils/assignments'
import DailyStrip from '@/components/assignments/DailyStrip'
import AttachmentList from '@/components/assignments/AttachmentList'
import Modal from '@/components/ui/Modal'
import { Btn, Pill, Empty, Field } from '@/components/teacher/studio/ui'
import { inputCls, inputStyle, type Tone } from '@/components/teacher/studio/tokens'
import type { Assignment, PracticeCategory, PracticeSession } from '@/types'

const CATEGORY_OPTIONS: PracticeCategory[] = ['Scales', 'Technique', 'Sight Reading', 'Repertoire', 'Memorization', 'Ear Training', 'Improvisation']
const STATUS: Record<string, [string, Tone]> = {
  approved: ['Approved', 'success'], submitted: ['Handed in', 'purple'], returned: ['Sent back', 'warning'], cancelled: ['Withdrawn', 'neutral'], assigned: ['Open', 'info'],
}

/** Set work, see how it is going, review what is handed in. */
export default function Assignments({ m, sessions, onReview }: { m: Member; sessions: PracticeSession[]; onReview: (a: Assignment) => void }) {
  const { profile } = useAuth()
  const all = useTeacherStore((s) => s.assignments)
  const members = useMembers()
  const [params, setParams] = useSearchParams()
  const mine = useMemo(() => all.filter((a) => (m.uid && a.studentId === m.uid) || (!m.uid && a.rosterId === m.id) || (a.rosterId === m.id && !a.studentId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [all, m])
  const [composing, setComposing] = useState(params.get('new') === '1')
  const [copying, setCopying] = useState<Assignment | null>(null)
  const first = m.name.split(' ')[0]

  useEffect(() => {
    if (params.get('new') !== '1') return
    setComposing(true)
    const next = new URLSearchParams(params)
    next.delete('new')
    setParams(next, { replace: true })
  }, [params, setParams])

  const canSet = !m.uid || m.profile?.teacherId === profile?.uid

  return (
    <div>
      <div className="flex items-center gap-3 px-5 py-3 sm:px-6" style={{ borderBottom: '1px solid var(--clay-line)' }}>
        <p className="flex-1 text-[13px]" style={{ color: 'var(--clay-dim)' }}>
          {m.onApp ? `${first} sees these in the app, and hands work in there.` : `${first} isn’t on the app yet: these are kept here and become theirs when they join. Check them off in the lesson.`}
        </p>
        {canSet && <Btn kind={composing ? 'soft' : 'primary'} onClick={() => setComposing((v) => !v)}>{composing ? 'Cancel' : '+ New assignment'}</Btn>}
      </div>
      {composing && profile && <Composer teacherId={profile.uid} m={m} onDone={() => setComposing(false)} />}
      {mine.length === 0 && !composing && <Empty>No assignments yet.</Empty>}
      {mine.map((a) => {
        const st = normaliseStatus(a.status)
        const [label, tone] = STATUS[st]
        const daily = deriveDailyProgress(a, sessions)
        const total = deriveProgress(a, sessions)
        return (
          <div key={a.id} className="px-5 py-3.5 sm:px-6" style={{ borderBottom: '1px solid var(--clay-line)' }}>
            <div className="flex flex-wrap items-center gap-2">
              <strong className="flex-1 text-[14px]" style={{ color: st === 'approved' ? 'var(--clay-dim)' : 'var(--clay-ink)' }}>{a.title}</strong>
              <Pill tone={tone}>{label}</Pill>
              {a.requiresRecording && <Pill>Recording</Pill>}
            </div>
            {a.description && <p className="mt-1 text-[13px]" style={{ color: '#4F4766' }}>{a.description}</p>}
            {daily.tracked && (
              <div className="mt-2">
                <DailyStrip progress={daily} dailyTarget={a.dailyTargetMinutes ?? 0} compact />
                <p className="mt-1 text-[12px]" style={{ color: daily.onTrack ? 'var(--clay-dim)' : 'var(--clay-danger)' }}>{daily.minutesDone} / {daily.minutesRequired} min · {daily.daysMet} of {daily.daysRequired} days{!daily.onTrack && ' · missed a day'}</p>
              </div>
            )}
            {!daily.tracked && total.tracked && <p className="mt-1 text-[12px]" style={{ color: 'var(--clay-dim)' }}>{total.minutesDone} / {a.targetMinutes} min practised{total.targetMet && ' · target met'}</p>}
            <AttachmentList files={a.attachments} className="mt-2" />
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex-1 text-[12px]" style={{ color: 'var(--clay-dim)' }}>
                Set {format(parseISO(a.createdAt), 'MMM d')}{a.dueDate ? ` · due ${format(parseISO(a.dueDate), 'MMM d')}` : ''}{a.completedAt ? ` · done ${format(parseISO(a.completedAt), 'MMM d')}` : ''}
              </span>
              {needsReview(a) && <Btn kind="quiet" onClick={() => onReview(a)}>Review</Btn>}
              {/* No app to hand it in from: checked off in the lesson instead. */}
              {!m.onApp && (st === 'assigned' || st === 'returned') && <Btn kind="quiet" onClick={() => void reviewAssignment(a.id, 'approved')}>Mark done</Btn>}
              {members.length > 1 && <Btn kind="link" onClick={() => setCopying(a)}>Copy to another student</Btn>}
              <button type="button" onClick={() => { if (window.confirm(`Delete “${a.title}”?`)) void deleteAssignment(a.id) }} aria-label={`Delete ${a.title}`} className="p-1.5" style={{ color: 'var(--clay-dim)' }}><Trash2 size={14} /></button>
            </div>
          </div>
        )
      })}
      {copying && profile && <CopyTo a={copying} from={m} teacherId={profile.uid} onClose={() => setCopying(null)} />}
    </div>
  )
}

function Composer({ teacherId, m, onDone }: { teacherId: string; m: Member; onDone: () => void }) {
  const [kind, setKind] = useState<'task' | 'daily'>('task')
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [due, setDue] = useState('')
  const [rec, setRec] = useState(false)
  const [daily, setDaily] = useState('')
  const [cat, setCat] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pick = useRef<HTMLInputElement>(null)

  async function save() {
    if (!title.trim()) return
    if (kind === 'daily' && !due) { setError('A daily assignment needs an end date.'); return }
    setBusy(true)
    setError('')
    try {
      const attachments = await Promise.all(files.map((f) => uploadAttachment(teacherId, f)))
      await createAssignment(teacherId, m.uid ?? '', {
        title: title.trim(),
        description: desc.trim() || undefined,
        dueDate: due || undefined,
        type: kind,
        requiresRecording: kind === 'task' && rec && m.onApp ? true : undefined,
        dailyTargetMinutes: kind === 'daily' && Number(daily) > 0 ? Number(daily) : undefined,
        category: kind === 'daily' && cat ? (cat as PracticeCategory) : undefined,
        rosterId: m.id,
        attachments: attachments.length ? attachments : undefined,
      })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the assignment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 px-5 py-4 sm:px-6" style={{ background: '#FBFAFE', borderBottom: '1px solid var(--clay-line)' }}>
      <div className="flex gap-2">
        {([['task', 'Task', 'handed in once'], ['daily', 'Daily practice', 'minutes every day']] as const).map(([id, label, hint]) => (
          <button key={id} type="button" aria-pressed={kind === id} onClick={() => setKind(id)} className="flex-1 rounded-xl px-3 py-2 text-left"
            style={kind === id ? { background: 'var(--clay-accent)', color: '#fff' } : { background: 'var(--clay-surface)', color: 'var(--clay-dim)' }}>
            <span className="block text-[13px] font-bold">{label}</span><span className="block text-[11.5px] opacity-80">{hint}</span>
          </button>
        ))}
      </div>
      <Field label="Title"><input className={inputCls} style={{ ...inputStyle, background: '#fff' }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'daily' ? 'Daily scales' : 'Für Elise — bars 1–16, hands together at 80'} /></Field>
      <Field label="Instructions (optional)"><textarea rows={2} className="w-full rounded-xl border-0 p-3 text-[14px] outline-none" style={{ ...inputStyle, background: '#fff' }} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={kind === 'daily' ? 'Until' : 'Due'} className="w-44"><input type="date" className={inputCls} style={{ ...inputStyle, background: '#fff' }} value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        {kind === 'daily' && (
          <>
            <Field label="Minutes a day" className="w-32"><input type="number" min={1} className={inputCls} style={{ ...inputStyle, background: '#fff' }} value={daily} onChange={(e) => setDaily(e.target.value)} /></Field>
            <Field label="Counts" className="w-48">
              <select className={inputCls} style={{ ...inputStyle, background: '#fff' }} value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">Any practice</option>{CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>Only {c}</option>)}
              </select>
            </Field>
          </>
        )}
        {kind === 'task' && m.onApp && (
          <label className="flex min-h-[40px] items-center gap-2 text-[13px]" style={{ color: 'var(--clay-ink)' }}>
            <input type="checkbox" checked={rec} onChange={(e) => setRec(e.target.checked)} className="h-[18px] w-[18px]" style={{ accentColor: 'var(--clay-accent-ink)' }} /> Ask for a recording
          </label>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {files.map((f) => (
          <span key={f.name} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[12px]" style={{ color: '#4F4766' }}>
            {f.name}<button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((x) => x !== f))} className="pl-1">✕</button>
          </span>
        ))}
        <input ref={pick} type="file" hidden multiple accept="audio/*,video/*,application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 5)); e.target.value = '' }} />
        <button type="button" onClick={() => pick.current?.click()} className="rounded-full px-3 py-1 text-[12px]" style={{ border: '1.5px dashed var(--clay-faint)', color: '#4F4766' }}>+ Attach audio, video, PDF or photo</button>
      </div>
      {error && <p className="text-[13px]" style={{ color: 'var(--clay-danger)' }}>{error}</p>}
      <div className="flex justify-end"><Btn kind="primary" onClick={save} disabled={busy || !title.trim()}>{busy ? 'Saving…' : 'Set assignment'}</Btn></div>
    </div>
  )
}

function CopyTo({ a, from, teacherId, onClose }: { a: Assignment; from: Member; teacherId: string; onClose: () => void }) {
  const members = useMembers().filter((x) => x.id !== from.id && (!x.uid || x.profile?.teacherId === teacherId))
  const [pick, setPick] = useState<string[]>([])
  const [due, setDue] = useState(a.dueDate ?? '')
  const [busy, setBusy] = useState(false)
  async function copy() {
    setBusy(true)
    try {
      await Promise.all(members.filter((x) => pick.includes(x.id)).map((x) => createAssignment(teacherId, x.uid ?? '', {
        title: a.title, description: a.description, dueDate: due || undefined, type: a.type, category: a.category,
        requiresRecording: x.onApp ? a.requiresRecording : undefined, dailyTargetMinutes: a.dailyTargetMinutes, targetMinutes: a.targetMinutes,
        rosterId: x.id, attachments: a.attachments,
      })))
      onClose()
    } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Copy to other students">
      <p className="mb-2 text-[13px]" style={{ color: 'var(--clay-dim)' }}>“{a.title}”</p>
      <div className="flex flex-wrap gap-1.5">
        {members.map((x) => {
          const on = pick.includes(x.id)
          return <button key={x.id} type="button" aria-pressed={on} onClick={() => setPick(on ? pick.filter((y) => y !== x.id) : [...pick, x.id])} className="min-h-[34px] rounded-full px-3 text-[13px] font-semibold" style={on ? { background: 'var(--clay-ink)', color: '#fff' } : inputStyle}>{x.name}</button>
        })}
      </div>
      <Field label="Due" className="mt-3 w-44"><input type="date" className={inputCls} style={inputStyle} value={due} onChange={(e) => setDue(e.target.value)} /></Field>
      <div className="mt-4 flex justify-end"><Btn kind="primary" onClick={copy} disabled={busy || !pick.length}>{busy ? 'Copying…' : `Copy to ${pick.length || ''}`}</Btn></div>
    </Modal>
  )
}
