import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, ChevronRight, MessagesSquare, ReceiptText, SlidersHorizontal, UserRoundPlus } from 'lucide-react'
import { useTeacherStore } from '@/stores/teacherStore'
import { useUnreadThreads } from '@/hooks/useTeacherMessages'
import { balanceCents } from '@/lib/studio/billing'
import { money } from '@/lib/studio/dates'
import AddStudentSheet from '@/components/teacher/AddStudentSheet'
import { StudioPage } from '@/components/teacher/studio/ui'

/** The phone's fifth tab: everything that is not one of the other four. */
export default function MorePage() {
  const navigate = useNavigate()
  const invoices = useTeacherStore((s) => s.invoices)
  const unread = useUnreadThreads()
  const [adding, setAdding] = useState(false)
  const due = invoices.reduce((a, i) => a + balanceCents(i), 0)
  // Each row a solid icon tile, its name and a line of what is inside —
  // roomier than a plain list, and the same tile style as Today's figures.
  const rows = [
    { label: 'Families & Invoices', sub: 'Billing, payments and family contacts', meta: due ? `${money(due)} due` : '', icon: ReceiptText, color: '#E0A12B', go: () => navigate('/teacher/families') },
    { label: 'Messages', sub: 'Conversations with your students', meta: unread.size ? `${unread.size} new` : '', icon: MessagesSquare, color: '#3B9BD9', go: () => navigate('/teacher/messages') },
    { label: 'Reports', sub: 'Progress reports for any period', meta: '', icon: BarChart3, color: '#3DAE7C', go: () => navigate('/teacher/reports') },
    { label: 'Add a student', sub: 'Invite someone, or keep a record', meta: '', icon: UserRoundPlus, color: '#8B6BD6', go: () => setAdding(true) },
    { label: 'Settings', sub: 'Your studio, lessons and the app', meta: '', icon: SlidersHorizontal, color: '#7D879C', go: () => navigate('/teacher/settings') },
  ]
  return (
    <StudioPage>
      <div className="py-2">
        {rows.map((r, i) => (
          <button
            key={r.label}
            type="button"
            onClick={r.go}
            className="flex w-full items-center gap-4 px-5 py-5 text-left transition-colors active:bg-[var(--clay-bg)] sm:px-6"
            style={i ? { borderTop: '1px solid var(--clay-line)' } : undefined}
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px]"
              style={{ background: r.color, color: '#fff', boxShadow: `0 6px 14px -6px ${r.color}` }}
              aria-hidden="true"
            >
              <r.icon size={23} strokeWidth={2.1} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16.5px] font-bold" style={{ color: 'var(--clay-ink)' }}>{r.label}</span>
              <span className="mt-0.5 block truncate text-[13px]" style={{ color: 'var(--clay-dim)' }}>{r.sub}</span>
            </span>
            {r.meta && <span className="shrink-0 text-[13px] font-semibold" style={{ color: 'var(--clay-accent-ink)' }}>{r.meta}</span>}
            <ChevronRight size={18} style={{ color: 'var(--clay-faint)' }} aria-hidden="true" />
          </button>
        ))}
      </div>
      <AddStudentSheet open={adding} onClose={() => setAdding(false)} onAdded={(id) => navigate(`/teacher/students/${encodeURIComponent(id)}`)} />
    </StudioPage>
  )
}
