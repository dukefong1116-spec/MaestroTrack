import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Users, UserMinus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { removeStudentFromStudio } from '@/lib/firebase/teacher'
import { getAnalyticsSummary } from '@/lib/utils/analytics'
import PageHeader from '@/components/common/PageHeader'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/common/EmptyState'
import { INSTRUMENT_THEMES } from '@/lib/utils/instruments'
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
          icon={<Users size={36} />}
          title={search ? 'No students match your search' : 'No students yet'}
          description={`Studio code: ${profile?.studioCode ?? '—'}`}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((student, i) => {
            const sessions = studentSessions[student.uid] ?? []
            const summary = getAnalyticsSummary(sessions, student.weeklyGoalMinutes ?? 300)
            const instrTheme = student.instrument ? INSTRUMENT_THEMES[student.instrument as InstrumentType] : null

            return (
              <motion.div key={student.uid} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card hover className="p-5 space-y-4" onClick={() => navigate(`/teacher/students/${student.uid}`)}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center text-xl">
                        {instrTheme?.emoji ?? '🎵'}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{student.displayName}</p>
                        <p className="text-xs text-slate-400 capitalize">{student.instrument ?? 'Unknown'}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleRemove(e, student)}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <UserMinus size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-800/60 rounded-lg p-2">
                      <p className="text-sm font-bold text-white">{summary.currentStreak}d</p>
                      <p className="text-xs text-slate-500">Streak</p>
                    </div>
                    <div className="bg-slate-800/60 rounded-lg p-2">
                      <p className="text-sm font-bold text-white">{summary.weeklyGoalPercentage}%</p>
                      <p className="text-xs text-slate-500">Goal</p>
                    </div>
                    <div className="bg-slate-800/60 rounded-lg p-2">
                      <p className="text-sm font-bold text-white">{summary.consistencyScore}%</p>
                      <p className="text-xs text-slate-500">Consist.</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Weekly goal</span>
                      <span>{summary.totalMinutesThisWeek}/{student.weeklyGoalMinutes ?? 300} min</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, summary.weeklyGoalPercentage)}%` }} />
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
