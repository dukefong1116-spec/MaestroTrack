import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { UserMinus } from 'lucide-react'
import Sticker from '@/components/stickers/Sticker'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { removeStudentFromStudio } from '@/lib/firebase/teacher'
import { getAnalyticsSummary } from '@/lib/utils/analytics'
import PageHeader from '@/components/common/PageHeader'
import InstrumentIcon from '@/components/icons/InstrumentIcon'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/common/EmptyState'
import type { UserProfile, InstrumentType } from '@/types'

export default function StudentsPage() {
  const { profile } = useAuth()
  const { students, studentSessions } = useTeacherStore()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() =>
    students.filter((s) =>
      s.displayName.toLowerCase().includes(search.toLowerCase()) ||
      s.instrument?.toLowerCase().includes(search.toLowerCase())
    ),
    [students, search]
  )

  async function handleRemove(e: React.MouseEvent, student: UserProfile) {
    e.stopPropagation()
    if (window.confirm(`Remove ${student.displayName} from your studio?`)) {
      await removeStudentFromStudio(student.uid)
    }
  }

  return (
    <div>
      <PageHeader title="My Students" subtitle={`${students.length} students in your studio`} />

      <div className="mb-6">
        <Input
          placeholder="Search by name or instrument..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Sticker name="users" size={36} tone="accent" />}
          title={search ? 'No students match your search' : 'No students yet'}
          description={`Studio code: ${profile?.studioCode ?? '—'}`}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((student, i) => {
            const sessions = studentSessions[student.uid] ?? []
            const summary = getAnalyticsSummary(sessions, student.weeklyGoalMinutes ?? 300)

            return (
              <motion.div key={student.uid} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card hover className="p-5 space-y-4" onClick={() => navigate(`/teacher/students/${student.uid}`)}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--clay-accent) 15%, transparent)', color: 'var(--clay-accent)' }}>
                        <InstrumentIcon instrument={student.instrument as InstrumentType | undefined} size={19} />
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--clay-ink)]">{student.displayName}</p>
                        <p className="text-xs text-[var(--clay-dim)] capitalize">{student.instrument ?? 'Unknown'}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleRemove(e, student)}
                      className="text-[var(--clay-dim)] hover:text-red-400 transition-colors"
                    >
                      <UserMinus size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-[var(--clay-bg-deep)] rounded-lg p-2">
                      <p className="text-sm font-bold text-[var(--clay-ink)]">{summary.currentStreak}d</p>
                      <p className="text-xs text-[var(--clay-dim)]">Streak</p>
                    </div>
                    <div className="bg-[var(--clay-bg-deep)] rounded-lg p-2">
                      <p className="text-sm font-bold text-[var(--clay-ink)]">{summary.weeklyGoalPercentage}%</p>
                      <p className="text-xs text-[var(--clay-dim)]">Goal</p>
                    </div>
                    <div className="bg-[var(--clay-bg-deep)] rounded-lg p-2">
                      <p className="text-sm font-bold text-[var(--clay-ink)]">{summary.consistencyScore}%</p>
                      <p className="text-xs text-[var(--clay-dim)]">Consist.</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-[var(--clay-dim)] mb-1">
                      <span>Weekly goal</span>
                      <span>{summary.totalMinutesThisWeek}/{student.weeklyGoalMinutes ?? 300} min</span>
                    </div>
                    <div className="h-1.5 bg-[var(--clay-line)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--clay-accent)] rounded-full" style={{ width: `${Math.min(100, summary.weeklyGoalPercentage)}%` }} />
                    </div>
                  </div>

                  <Badge variant={student.experienceLevel === 'advanced' || student.experienceLevel === 'professional' ? 'purple' : 'info'} size="sm" className="capitalize">
                    {student.experienceLevel ?? 'Student'}
                  </Badge>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
