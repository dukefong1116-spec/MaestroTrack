import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, LineChart, MessageCircle, Settings, UserPlus, Wallet } from 'lucide-react'
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
  const rows = [
    { label: 'Families & Invoices', meta: due ? `${money(due)} due` : '', icon: Wallet, bg: 'var(--clay-warning-bg)', fg: '#7A4F05', go: () => navigate('/teacher/families') },
    { label: 'Messages', meta: unread.size ? `${unread.size} new` : '', icon: MessageCircle, bg: 'var(--clay-accent-soft)', fg: '#C2452B', go: () => navigate('/teacher/messages') },
    { label: 'Reports', meta: '', icon: LineChart, bg: 'var(--clay-success-bg)', fg: '#1F6B4A', go: () => navigate('/teacher/reports') },
    { label: 'Add a student', meta: 'Invite or add', icon: UserPlus, bg: 'var(--clay-purple-bg)', fg: '#5B3FA8', go: () => setAdding(true) },
    { label: 'Settings', meta: '', icon: Settings, bg: 'var(--clay-bg-deep)', fg: '#4F4766', go: () => navigate('/teacher/settings') },
  ]
  return (
    <StudioPage title="More">
      {rows.map((r) => (
        <button key={r.label} type="button" onClick={r.go} className="flex w-full items-center gap-3 px-5 py-3.5 text-left" style={{ borderBottom: '1px solid var(--clay-line)' }}>
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: r.bg, color: r.fg }}><r.icon size={18} aria-hidden="true" /></span>
          <span className="flex-1 text-[15px] font-semibold" style={{ color: 'var(--clay-ink)' }}>{r.label}</span>
          <span className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>{r.meta}</span>
          <ChevronRight size={16} style={{ color: 'var(--clay-faint)' }} aria-hidden="true" />
        </button>
      ))}
      <AddStudentSheet open={adding} onClose={() => setAdding(false)} onAdded={(id) => navigate(`/teacher/students/${encodeURIComponent(id)}`)} />
    </StudioPage>
  )
}
