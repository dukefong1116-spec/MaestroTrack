import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, parseISO, formatDistanceToNowStrict } from 'date-fns'
import { useTeacherStore } from '@/stores/teacherStore'
import { useMembers } from '@/hooks/useStudioData'
import { useOpenMessages } from '@/hooks/useTeacherMessages'
import { normaliseStatus, latestSubmission, dueness } from '@/lib/utils/assignments'
import { reviewAssignment } from '@/lib/firebase/assignments'
import { subscribeSharedRecordings } from '@/lib/firebase/recordings'
import ReviewSheet from '@/components/assignments/ReviewSheet'
import { StudioPage, Segmented, Pill, Check, BulkBar, BulkButton, Avatar, Empty, Btn } from '@/components/teacher/studio/ui'
import { colorFor, inputStyle } from '@/components/teacher/studio/tokens'
import type { Assignment, Recording } from '@/types'

type Filter = 'needs' | 'back' | 'approved' | 'all'
type Kind = 'all' | 'rec' | 'check'
type Sort = 'newest' | 'oldest' | 'due' | 'student'

const STATUS_OF: Record<string, Filter | null> = { submitted: 'needs', returned: 'back', approved: 'approved', assigned: null, cancelled: null }

/**
 * Everything handed in, as one list: what still wants your answer first,
 * filterable and sortable, and answerable several at a time.
 */
export default function ReviewPage() {
  const all = useTeacherStore((s) => s.assignments)
  const members = useMembers()
  const openMessages = useOpenMessages()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<Filter>('needs')
  const [kind, setKind] = useState<Kind>('all')
  const [sort, setSort] = useState<Sort>('newest')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [reviewing, setReviewing] = useState<Assignment | null>(null)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const nameOf = (a: Assignment) => members.find((m) => (a.studentId && m.uid === a.studentId) || (a.rosterId && m.id === a.rosterId))?.name ?? 'Student'

  const handedIn = useMemo(() => all
    .map((a) => {
      const st = STATUS_OF[normaliseStatus(a.status)]
      const sub = latestSubmission(a)
      const rec = (sub?.recordingIds?.length ?? 0) > 0 || !!a.requiresRecording
      return st && sub ? { a, st, sub, rec } : null
    })
    .filter((x): x is NonNullable<typeof x> => !!x), [all])

  const count = (f: Filter) => handedIn.filter((x) => f === 'all' || x.st === f).length
  const rows = useMemo(() => handedIn
    .filter((x) => (filter === 'all' || x.st === filter) && (kind === 'all' || (kind === 'rec' ? x.rec : !x.rec)))
    .sort((p, q) => sort === 'oldest' ? p.sub.at.localeCompare(q.sub.at)
      : sort === 'due' ? (p.a.dueDate ?? '9999').localeCompare(q.a.dueDate ?? '9999')
        : sort === 'student' ? nameOf(p.a).localeCompare(nameOf(q.a))
          : q.sub.at.localeCompare(p.sub.at)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [handedIn, filter, kind, sort, members])

  // Opened from a link (the bell, a student's record).
  const wanted = params.get('open')
  useEffect(() => {
    if (!wanted) return
    const found = all.find((a) => a.id === wanted)
    if (!found) return
    setReviewing(found)
    const next = new URLSearchParams(params)
    next.delete('open')
    setParams(next, { replace: true })
  }, [wanted, all, params, setParams])

  useEffect(() => {
    if (!reviewing?.studentId) { setRecordings([]); return }
    return subscribeSharedRecordings(reviewing.studentId, setRecordings)
  }, [reviewing?.studentId])

  const shown = rows.map((r) => r.a.id)
  const chosen = shown.filter((id) => sel.has(id))
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  async function bulk(verdict: 'approved' | 'returned') {
    setBusy(true)
    try {
      const ids = chosen.filter((id) => rows.find((r) => r.a.id === id)?.st === 'needs')
      await Promise.all(ids.map((id) => reviewAssignment(id, verdict)))
      setNotice(`${verdict === 'approved' ? 'Approved' : 'Sent back'} ${ids.length} assignment${ids.length === 1 ? '' : 's'}.${ids.length < chosen.length ? ' (Only ones waiting for review were changed.)' : ''}`)
      setSel(new Set())
    } catch {
      setNotice('Some could not be saved. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const n = count('needs')
  return (
    <StudioPage title="Assignments to review" subtitle={n ? `${n} handed in and waiting for you` : 'All caught up'}>
      <div className="flex flex-wrap items-center gap-2.5 px-5 py-3 sm:px-6" style={{ borderBottom: '1px solid var(--clay-line)' }}>
        <Segmented label="Status" value={filter} onChange={(v) => { setFilter(v); setSel(new Set()) }} options={[
          { value: 'needs', label: `Needs review · ${count('needs')}` },
          { value: 'back', label: `Sent back · ${count('back')}` },
          { value: 'approved', label: `Approved · ${count('approved')}` },
          { value: 'all', label: `All · ${count('all')}` },
        ]} />
        <span className="flex-1" />
        <label className="flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--clay-dim)' }}>Type
          <select value={kind} onChange={(e) => { setKind(e.target.value as Kind); setSel(new Set()) }} className="min-h-[36px] rounded-[10px] border-0 px-2.5 text-[13px] font-semibold" style={inputStyle}>
            <option value="all">Everything</option><option value="rec">Recordings</option><option value="check">Checked off</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--clay-dim)' }}>Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="min-h-[36px] rounded-[10px] border-0 px-2.5 text-[13px] font-semibold" style={inputStyle}>
            <option value="newest">Newest first</option><option value="oldest">Waiting longest</option><option value="due">Due date</option><option value="student">Student, A–Z</option>
          </select>
        </label>
      </div>

      {chosen.length > 0 && (
        <BulkBar label={`${chosen.length} selected`} onClear={() => setSel(new Set())}>
          <BulkButton primary disabled={busy} onClick={() => bulk('approved')}>Approve</BulkButton>
          <BulkButton disabled={busy} onClick={() => bulk('returned')}>Send back</BulkButton>
          <BulkButton onClick={() => openMessages(null)}>Message students</BulkButton>
        </BulkBar>
      )}
      {notice && <p className="px-6 py-2 text-[13px] font-semibold" style={{ color: 'var(--clay-success-fg)', borderBottom: '1px solid var(--clay-line)' }}>{notice}</p>}

      {rows.length === 0 ? <Empty>{filter === 'needs' ? 'Nothing waiting — all caught up.' : 'Nothing here.'}</Empty> : (
        <div role="table" aria-label="Handed-in assignments">
          <div role="row" className="hidden items-center gap-3 px-6 py-2 text-[12px] font-semibold md:flex" style={{ color: 'var(--clay-dim)', background: '#FBFAFE', borderBottom: '1px solid var(--clay-line)' }}>
            <span role="columnheader" className="w-6"><Check label="Select every row shown" checked={chosen.length === shown.length} onChange={() => setSel(chosen.length === shown.length ? new Set() : new Set(shown))} /></span>
            <span role="columnheader" className="w-44">Student</span>
            <span role="columnheader" className="flex-1">Assignment</span>
            <span role="columnheader" className="w-32">Handed in</span>
            <span role="columnheader" className="w-24">Due</span>
            <span role="columnheader" className="w-28">Status</span>
            <span className="w-20" />
          </div>
          {rows.map(({ a, st, sub, rec }) => {
            const on = sel.has(a.id)
            const name = nameOf(a)
            const late = a.dueDate && dueness(a) === 'overdue' && st === 'needs'
            return (
              <div key={a.id} role="row" className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 md:flex-nowrap md:px-6" style={{ borderBottom: '1px solid var(--clay-line)', background: on ? '#FFF6F2' : undefined }}>
                <span role="cell" className="w-6"><Check label={`Select ${name}: ${a.title}`} checked={on} onChange={() => toggle(a.id)} /></span>
                <span role="cell" className="flex min-w-0 items-center gap-2.5 md:w-44">
                  <Avatar name={name} color={colorFor(a.rosterId ?? a.studentId)} size={30} />
                  <span className="truncate font-bold" style={{ color: 'var(--clay-ink)' }}>{name}</span>
                </span>
                <span role="cell" className="min-w-0 basis-full md:basis-auto md:flex-1">
                  <span className="block truncate font-semibold" style={{ color: 'var(--clay-ink)' }}>{a.title}</span>
                  <span className="block text-[12px]" style={{ color: 'var(--clay-dim)' }}>
                    {rec ? `Recording${sub.recordingIds?.length ? ` · ${sub.recordingIds.length} take${sub.recordingIds.length === 1 ? '' : 's'}` : ''}` : 'Checked off'}
                    {sub.minutesAtSubmission != null ? ` · ${sub.minutesAtSubmission} min logged` : ''}
                  </span>
                </span>
                <span role="cell" className="text-[13px] md:w-32" style={{ color: '#4F4766' }}>{formatDistanceToNowStrict(parseISO(sub.at), { addSuffix: true })}</span>
                <span role="cell" className="text-[13px] md:w-24" style={{ color: late ? '#B3263C' : '#4F4766', fontWeight: late ? 700 : 400 }}>{a.dueDate ? `${format(parseISO(a.dueDate), 'MMM d')}${late ? ' · late' : ''}` : '—'}</span>
                <span role="cell" className="md:w-28">
                  {st === 'needs' ? <Pill tone="purple">Needs review</Pill> : st === 'back' ? <Pill tone="warning">Sent back</Pill> : <Pill tone="success">Approved</Pill>}
                </span>
                <span role="cell" className="ml-auto md:w-20 md:text-right">
                  <Btn kind="quiet" onClick={() => setReviewing(a)}>{st === 'needs' ? 'Review' : 'Open'}</Btn>
                </span>
              </div>
            )
          })}
        </div>
      )}

      <ReviewSheet
        assignment={reviewing}
        studentName={reviewing ? nameOf(reviewing) : ''}
        recordings={recordings}
        open={!!reviewing}
        onClose={() => setReviewing(null)}
      />
    </StudioPage>
  )
}
