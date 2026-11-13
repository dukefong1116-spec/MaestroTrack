import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useTeacherStore } from '@/stores/teacherStore'
import { useMembers } from '@/hooks/useStudioData'
import { getAnalyticsSummary } from '@/lib/utils/analytics'
import { StudioPage, Avatar, Btn, Empty } from '@/components/teacher/studio/ui'
import { colorFor } from '@/components/teacher/studio/tokens'

/** A progress report for any student, over any period — and the studio's practice research. */
export default function ReportsPage() {
  const navigate = useNavigate()
  const members = useMembers()
  const sessions = useTeacherStore((s) => s.studentSessions)
  return (
    <StudioPage title="Reports" subtitle="A progress report for any student, over any period" actions={<Btn kind="soft" onClick={() => navigate('/teacher/research')}>Practice research</Btn>}>
      {members.length === 0 && <Empty>No students yet.</Empty>}
      {members.map((m) => {
        const s = m.uid ? getAnalyticsSummary(sessions[m.uid] ?? [], m.profile?.weeklyGoalMinutes ?? 300) : null
        return (
          <button key={m.id} type="button" onClick={() => navigate(`/teacher/students/${encodeURIComponent(m.id)}?tab=report`)} className="flex w-full items-center gap-3 px-5 py-3 text-left sm:px-6" style={{ borderBottom: '1px solid var(--clay-line)' }}>
            <Avatar name={m.name} color={colorFor(m.id)} size={38} />
            <span className="min-w-0 flex-1">
              <span className="block font-bold" style={{ color: 'var(--clay-ink)' }}>{m.name}</span>
              <span className="block text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>{s ? `${s.totalMinutesThisWeek} min this week · ${s.currentStreak}-day streak` : 'Lessons and notes only'}</span>
            </span>
            <span className="text-[13px] font-bold" style={{ color: 'var(--clay-accent-ink)' }}>Open report</span>
            <ChevronRight size={16} style={{ color: 'var(--clay-faint)' }} aria-hidden="true" />
          </button>
        )
      })}
    </StudioPage>
  )
}
