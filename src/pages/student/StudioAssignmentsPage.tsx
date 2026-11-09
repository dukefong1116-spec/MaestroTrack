import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import AssignmentRow from '@/components/assignments/AssignmentRow'
import SubmitSheet from '@/components/assignments/SubmitSheet'
import { useAuth } from '@/hooks/useAuth'
import { useAssignments } from '@/hooks/useAssignments'
import { organise, tabOf, GROUP_LABEL, type AssignmentTab, type DueGroup } from '@/lib/utils/assignmentGroups'
import type { Assignment } from '@/types'

/**
 * Every assignment, full-screen and organised: To do · Handed in · Done,
 * with To do grouped by when it is due. Tapping one opens it to hand in.
 * A link here can name one (?open=…) — from the bell, or the Studio page —
 * and it opens on the right tab.
 */

const TABS: { id: AssignmentTab; label: string }[] = [
  { id: 'todo', label: 'To do' },
  { id: 'handed', label: 'Handed in' },
  { id: 'done', label: 'Done' },
]

const GROUP_COLOR: Record<DueGroup, string> = {
  overdue: 'var(--clay-danger-fg)', today: 'var(--clay-warning-fg)',
  week: 'var(--clay-dim)', later: 'var(--clay-dim)', none: 'var(--clay-dim)',
}

export default function StudioAssignmentsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { all } = useAssignments()
  const [tab, setTab] = useState<AssignmentTab>('todo')
  const [opened, setOpened] = useState<Assignment | null>(null)

  const teacherId = profile?.role === 'student' ? profile.teacherId : undefined
  const mine = useMemo(() => all.filter((x) => x.assignment.teacherId === teacherId), [all, teacherId])
  const { tabs, groups } = useMemo(() => organise(mine, new Date()), [mine])

  // Named in the link: open it, on its own tab, then forget the parameter
  // so closing the sheet does not reopen it.
  const wanted = params.get('open')
  useEffect(() => {
    if (!wanted) return
    const found = mine.find((x) => x.assignment.id === wanted)
    if (!found) return
    setTab(tabOf(found.assignment) ?? 'todo')
    setOpened(found.assignment)
    setParams({}, { replace: true })
  }, [wanted, mine, setParams])

  if (!profile) return null
  if (!teacherId) return <Navigate to="/student" replace />

  const rows = (items: typeof mine) => items.map((x, i) => (
    <div key={x.assignment.id} style={i ? { borderTop: '1px solid var(--clay-line)' } : undefined}>
      <AssignmentRow item={x} onOpen={() => setOpened(x.assignment)} />
    </div>
  ))

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col"
      style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)', fontFamily: 'var(--clay-font)' }}
    >
      <div
        className="flex shrink-0 items-center gap-3 px-3 pb-3"
        style={{
          background: 'var(--clay-surface)',
          borderBottom: '1px solid var(--clay-line)',
          paddingTop: 'calc(12px + env(safe-area-inset-top))',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/student/studio')}
          aria-label="Back to Studio"
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: 'var(--clay-bg)' }}
        >
          <ChevronLeft size={19} />
        </button>
        <p className="text-[16px] font-bold">Assignments</p>
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 pb-8 pt-4" style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}>
        <div className="mb-4 flex p-1" style={{ background: 'var(--clay-bg-deep)', borderRadius: 999 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className="flex-1 py-2 text-[13px] font-semibold transition-colors"
              style={{
                borderRadius: 999,
                background: tab === t.id ? 'var(--clay-surface)' : 'transparent',
                color: tab === t.id ? 'var(--clay-ink)' : 'var(--clay-dim)',
              }}
            >
              {t.label} · {tabs[t.id].length}
            </button>
          ))}
        </div>

        {tab === 'todo' ? (
          groups.length === 0 ? (
            <Empty text="Nothing to do — all caught up ✨" />
          ) : groups.map((g) => (
            <section key={g.group} className="mb-4">
              <p className="mb-1.5 px-1 text-[10.5px] font-bold uppercase tracking-[.12em]" style={{ color: GROUP_COLOR[g.group] }}>
                {GROUP_LABEL[g.group]}
              </p>
              <div className="px-4" style={{ background: 'var(--clay-surface)', borderRadius: 'var(--clay-r-md)' }}>{rows(g.items)}</div>
            </section>
          ))
        ) : tabs[tab].length === 0 ? (
          <Empty text={tab === 'handed' ? 'Nothing waiting on your teacher.' : 'Nothing finished yet.'} />
        ) : (
          <div className="px-4" style={{ background: 'var(--clay-surface)', borderRadius: 'var(--clay-r-md)' }}>{rows(tabs[tab])}</div>
        )}
      </div>

      <SubmitSheet assignment={opened} open={!!opened} onClose={() => setOpened(null)} />
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="py-12 text-center text-[14px]" style={{ color: 'var(--clay-dim)' }}>{text}</p>
}
