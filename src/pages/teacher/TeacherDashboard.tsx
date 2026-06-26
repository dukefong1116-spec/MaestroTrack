import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Users, Copy, TrendingUp, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { getAnalyticsSummary, computeStreak } from '@/lib/utils/analytics'
import PageHeader from '@/components/common/PageHeader'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import StatCard from '@/components/common/StatCard'
import EmptyState from '@/components/common/EmptyState'
import type { UserProfile } from '@/types'

function StudentRow({ student, sessions, onClick }: { student: UserProfile; sessions: ReturnType<typeof getAnalyticsSummary>; onClick: () => void }) {
  const { current: streak } = computeStreak([])
  return (
    <Card hover className="p-4 flex items-center justify-between gap-4" onClick={onClick}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-indigo-600/30 flex items-center justify-center text-sm font-bold text-indigo-300 shrink-0">
          {student.displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-white text-sm truncate">{student.displayName}</p>
          <p className="text-xs text-slate-400">{student.instrument ?? 'Unknown'} · {student.experienceLevel ?? '—'}</p>
        </div>
      </div>
      <div className="flex items-center gap-6 text-xs text-slate-400 shrink-0">
        <div className="text-center hidden sm:block">
          <p className="text-white font-semibold">{sessions.totalMinutesThisWeek}</p>
          <p>min/wk</p>
        </div>
        <div className="text-center hidden sm:block">
          <p className="text-white font-semibold">{sessions.consistencyScore}%</p>
          <p>consistency</p>
        </div>
        <div className="text-center hidden sm:block">
          <p className="text-white font-semibold">{sessions.weeklyGoalPercentage}%</p>
          <p>goal</p>
        </div>
        <Badge variant={sessions.currentStreak >= 7 ? 'success' : sessions.currentStreak >= 3 ? 'warning' : 'default'} size="sm">
          🔥 {sessions.currentStreak}d
        </Badge>
      </div>
    </Card>
  )
}

export default function TeacherDashboard() {
  const { profile } = useAuth()
  const { students, studentSessions } = useTeacherStore()
  const navigate = useNavigate()

  const summaries = useMemo(() =>
    Object.fromEntries(students.map((s) => [
      s.uid,
      getAnalyticsSummary(studentSessions[s.uid] ?? [], s.weeklyGoalMinutes ?? 300)
    ])),
    [students, studentSessions]
  )

  const totalWeekMinutes = useMemo(() =>
    Object.values(summaries).reduce((a, s) => a + s.totalMinutesThisWeek, 0),
    [summaries]
  )
  const avgConsistency = useMemo(() => {
    const vals = Object.values(summaries)
    return vals.length ? Math.round(vals.reduce((a, s) => a + s.consistencyScore, 0) / vals.length) : 0
  }, [summaries])
  const studentsOnStreak = useMemo(() =>
    Object.values(summaries).filter((s) => s.currentStreak >= 3).length,
    [summaries]
  )

  async function copyCode() {
    if (profile?.studioCode) await navigator.clipboard.writeText(profile.studioCode)
  }

  return (
    <div>
      <PageHeader title={`${profile?.studioName ?? 'My Studio'}`} subtitle="Manage your students and monitor their progress." />

      {/* Studio code */}
      <Card className="p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400">Studio Code</p>
          <p className="text-2xl font-mono font-bold text-white tracking-widest">{profile?.studioCode ?? '—'}</p>
        </div>
        <button onClick={copyCode} className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
          <Copy size={14} /> Copy
        </button>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Students" value={students.length} icon={<Users size={16} />} delay={0.05} />
        <StatCard label="Studio Minutes" value={totalWeekMinutes} subtitle="this week" icon={<Clock size={16} />} delay={0.1} />
        <StatCard label="Avg Consistency" value={`${avgConsistency}%`} icon={<TrendingUp size={16} />} delay={0.15} />
        <StatCard label="On Streak" value={studentsOnStreak} subtitle="3+ days" delay={0.2} />
      </div>

      {/* Student list */}
      {students.length === 0 ? (
        <EmptyState
          icon={<Users size={36} />}
          title="No students yet"
          description={`Share your studio code with students: ${profile?.studioCode ?? '—'}`}
        />
      ) : (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Students</p>
          <div className="space-y-2">
            {students.map((student, i) => (
              <motion.div key={student.uid} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <StudentRow
                  student={student}
                  sessions={summaries[student.uid] ?? getAnalyticsSummary([], 300)}
                  onClick={() => navigate(`/teacher/students/${student.uid}`)}
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
