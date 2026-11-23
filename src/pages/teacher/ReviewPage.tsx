import { Check as Tick, MessageCircle, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, parseISO, formatDistanceToNowStrict } from 'date-fns'
import { useTeacherStore } from '@/stores/teacherStore'
import { useMembers } from '@/hooks/useStudioData'
import { useOpenMessages } from '@/hooks/useTeacherMessages'
import { normaliseStatus, latestSubmission, dueness } from '@/lib/utils/assignments'
import { reviewAssignment } from '@/lib/firebase/assignments'
import { subscribeSharedRecordings } from '@/lib/firebase/recordings'
import ReviewSheet from '@/components/assignments/ReviewSheet'
import Femata from '@/components/femata/Femata'
import { StudioPage, Segmented, Pill, Check, BulkBar, BulkButton, BulkSpacer, Avatar, Empty, Btn } from '@/components/teacher/studio/ui'
import { colorFor, inputStyle } from '@/components/teacher/studio/tokens'
import type { Assignment, Recording } from '@/types'
import { useNativeSegmented } from '@/lib/nativeGlass'

type Filter = 'needs' | 'back' | 'approved' | 'all'
type Kind = 'all' | 'rec' | 'check'
type Sort = 'newest' | 'oldest' | 'due' | 'student'

const STATUS_OF: Record<string, Filter | null> = { submitted: 'needs', returned: 'back', approved: 'approved', assigned: null, cancelled: null }

/**
 * Everything handed in, as one list: what still wants your answer first,
 * filterable and sortable, and answerable several at a time.
 */
/** What Femata says when a tab has nothing in it — a different face for each. */
const EMPTY = {
  needs: { mood: 'cool', title: 'All caught up', line: 'Nothing waiting for your ears right now.' },
  back: { mood: 'wink', title: 'Nothing sent back', line: 'Everyone nailed it the first time. Nice teaching!' },
  approved: { mood: 'proud', title: 'No approvals yet', line: 'Work you approve lines up here, ready to look back on.' },
  all: { mood: 'sleepy', title: 'Quiet in here', line: 'When a student hands something in, it lands right here.' },
} as const

/** The status tabs, in order: value and name. */
const FILTERS = [['needs', 'To review'], ['back', 'Sent back'], ['approved', 'Approved'], ['all', 'All']] as const
/** On a phone: the three statuses in a switch, with "All" beside it. */
const PHONE_FILTERS = FILTERS.slice(0, 3)

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

  const memberOf = (a: Assignment) => members.find((m) => (a.studentId && m.uid === a.studentId) || (a.rosterId && m.id === a.rosterId))
  const nameOf = (a: Assignment) => memberOf(a)?.name ?? 'Student'

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
  // In the iPhone app the phone's status switch is Apple's own glass
  // segmented control (see nativeGlass), so the selection slides and
  // magnifies under a dragging finger like the tab bar does. With "All"
  // on, none of its three is chosen (-1).
  const statusRef = useRef<HTMLDivElement>(null)
  const nativeStatus = useNativeSegmented(statusRef, {
    id: 'review-status',
    items: PHONE_FILTERS.map(([f, name]) => `${name} ${count(f)}`),
    selected: PHONE_FILTERS.findIndex(([f]) => f === filter),
    tint: '#1F8FD1',
    visible: !reviewing,
  }, (i) => { setFilter(PHONE_FILTERS[i][0]); setSel(new Set()) })
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

  return (
    <StudioPage>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-3 px-5 pb-3 pt-1 sm:px-6 lg:py-5" style={{ borderBottom: '1px solid var(--clay-line)' }}>
        {/* Phone: a three-way switch at the top, "All" beside it. */}
        <div className="flex w-full items-center gap-2 lg:hidden">
          <div ref={statusRef} role="group" aria-label="Status" aria-hidden={nativeStatus || undefined} className="grid min-w-0 flex-1 grid-cols-3 p-1" style={{ borderRadius: 999, background: 'rgba(118,118,128,.14)', visibility: nativeStatus ? 'hidden' : undefined }}>
            {PHONE_FILTERS.map(([value, name]) => {
              const on = filter === value
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  tabIndex={nativeStatus ? -1 : undefined}
                  onClick={() => { setFilter(value); setSel(new Set()) }}
                  className="min-w-0 truncate py-2 text-center text-[13px] font-semibold transition-colors"
                  style={{
                    borderRadius: 999,
                    background: on ? 'var(--clay-surface)' : 'transparent',
                    boxShadow: on ? '0 1px 2px rgba(20,30,60,.08), 0 4px 12px rgba(20,30,60,.08)' : undefined,
                    color: on ? 'var(--clay-ink)' : 'var(--clay-dim)',
                  }}
                >
                  {name} <span className="tabular-nums">{count(value)}</span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            aria-pressed={filter === 'all'}
            onClick={() => { setFilter('all'); setSel(new Set()) }}
            className="shrink-0 whitespace-nowrap px-3.5 py-3 text-[13px] font-semibold"
            style={{ borderRadius: 999, ...(filter === 'all' ? { background: 'var(--clay-accent-ink)', color: 'var(--clay-page)' } : { background: 'rgba(118,118,128,.14)', color: 'var(--clay-ink)' }) }}
          >
            All <span className="tabular-nums">{count('all')}</span>
          </button>
        </div>
        <div className="hidden lg:block">
          <Segmented
            label="Status"
            className="grid min-w-[420px] grid-cols-4"
            value={filter}
            onChange={(v) => { setFilter(v); setSel(new Set()) }}
            options={([['needs', 'To review'], ['back', 'Sent back'], ['approved', 'Approved'], ['all', 'All']] as const).map(([value, name]) => ({
              value,
              label: (
                <span className="flex flex-col items-center py-1 leading-tight">
                  <span className="whitespace-nowrap text-[12.5px]">{name}</span>
                  <span className="text-[15px] font-bold tabular-nums">{count(value)}</span>
                </span>
              ),
            }))}
          />
        </div>
        <span className="hidden flex-1 sm:block" />
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
          <BulkButton tone="success" icon={<Tick size={19} strokeWidth={2.6} />} disabled={busy} onClick={() => bulk('approved')}>Approve</BulkButton>
          <BulkButton tone="warning" icon={<Undo2 size={18} strokeWidth={2.4} />} disabled={busy} onClick={() => bulk('returned')}>Send back</BulkButton>
          <BulkButton tone="info" icon={<MessageCircle size={18} strokeWidth={2.3} />} onClick={() => openMessages(null)}>Message students</BulkButton>
        </BulkBar>
      )}
      {notice && <p className="px-6 py-2 text-[13px] font-semibold" style={{ color: 'var(--clay-success-fg)', borderBottom: '1px solid var(--clay-line)' }}>{notice}</p>}

      {rows.length === 0 ? (filter === 'needs' ? (
        // Nothing to review: said big, like the student's own caught-up state.
        // In the middle of the screen, not just under the filters.
        <div className="flex min-h-[calc(100dvh-300px)] flex-col items-center justify-center px-6 py-14 text-center">
          <span className="mb-3" aria-hidden="true"><Femata mood="cool" size={140} /></span>
          <p className="text-[17px] font-bold" style={{ color: 'var(--clay-ink)' }}>All caught up</p>
          <p className="mt-1 max-w-[260px] text-[13.5px] leading-snug" style={{ color: 'var(--clay-dim)' }}>
            Nothing waiting for review. Work your students hand in will show up here.
          </p>
        </div>
      ) : <Empty fill mood={EMPTY[filter].mood} title={EMPTY[filter].title}>{EMPTY[filter].line}</Empty>) : (
        <div role="table" aria-label="Handed-in assignments">
          <div role="row" className="hidden items-center gap-3 px-6 py-2 text-[12px] font-semibold md:flex" style={{ color: 'var(--clay-dim)', background: 'var(--clay-head)', borderBottom: '1px solid var(--clay-line)' }}>
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
              <div key={a.id} role="row" className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 md:flex-nowrap md:px-6" style={{ borderBottom: '1px solid var(--clay-line)', background: on ? 'var(--clay-accent-soft)' : undefined }}>
                <span role="cell" className="w-6"><Check label={`Select ${name}: ${a.title}`} checked={on} onChange={() => toggle(a.id)} /></span>
                <span role="cell" className="flex min-w-0 items-center gap-2.5 md:w-44">
                  <Avatar name={name} color={colorFor(a.rosterId ?? a.studentId)} size={30} src={memberOf(a)?.profile?.avatar} />
                  <span className="truncate font-bold" style={{ color: 'var(--clay-ink)' }}>{name}</span>
                </span>
                <span role="cell" className="min-w-0 basis-full md:basis-auto md:flex-1">
                  <span className="block truncate font-semibold" style={{ color: 'var(--clay-ink)' }}>{a.title}</span>
                  <span className="block text-[12px]" style={{ color: 'var(--clay-dim)' }}>
                    {rec ? `Recording${sub.recordingIds?.length ? ` · ${sub.recordingIds.length} take${sub.recordingIds.length === 1 ? '' : 's'}` : ''}` : 'Checked off'}
                    {sub.minutesAtSubmission != null ? ` · ${sub.minutesAtSubmission} min logged` : ''}
                  </span>
                </span>
                <span role="cell" className="text-[13px] md:w-32" style={{ color: 'var(--clay-ink-soft)' }}>{formatDistanceToNowStrict(parseISO(sub.at), { addSuffix: true })}</span>
                <span role="cell" className="text-[13px] md:w-24" style={{ color: late ? '#B3263C' : 'var(--clay-ink-soft)', fontWeight: late ? 700 : 400 }}>{a.dueDate ? `${format(parseISO(a.dueDate), 'MMM d')}${late ? ' · late' : ''}` : '—'}</span>
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
      <BulkSpacer />
    </StudioPage>
  )
}
