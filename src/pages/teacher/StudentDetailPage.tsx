import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, Trash2, MessageSquare } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { getPracticeSessions } from '@/lib/firebase/practice'
import { addTeacherNote, deleteTeacherNote, subscribeTeacherNotes } from '@/lib/firebase/teacher'
import { getAnalyticsSummary, getDailyData, getCategoryData, getHeatmapData } from '@/lib/utils/analytics'
import { getTheme } from '@/lib/utils/instruments'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Textarea from '@/components/ui/Textarea'
import Badge from '@/components/ui/Badge'
import PracticeBarChart from '@/components/charts/PracticeBarChart'
import CategoryPieChart from '@/components/charts/CategoryPieChart'
import PracticeHeatmap from '@/components/charts/PracticeHeatmap'
import StatCard from '@/components/common/StatCard'
import type { PracticeSession, TeacherNote, InstrumentType } from '@/types'

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { students, studentSessions, setStudentSessions } = useTeacherStore()
  const [notes, setNotes] = useState<TeacherNote[]>([])
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)

  const student = students.find((s) => s.uid === studentId)
  const sessions: PracticeSession[] = studentSessions[studentId ?? ''] ?? []
  const theme = getTheme(student?.instrument as InstrumentType | undefined)

  useEffect(() => {
    if (!studentId) return
    getPracticeSessions(studentId).then((s) => setStudentSessions(studentId, s))
    const unsub = subscribeTeacherNotes(studentId, setNotes)
    return unsub
  }, [studentId, setStudentSessions])

  const summary = useMemo(() => getAnalyticsSummary(sessions, student?.weeklyGoalMinutes ?? 300), [sessions, student])
  const dailyData = useMemo(() => getDailyData(sessions, 14), [sessions])
  const categoryData = useMemo(() => getCategoryData(sessions), [sessions])
  const heatmap = useMemo(() => getHeatmapData(sessions), [sessions])

  async function addNote() {
    if (!profile || !studentId || !newNote.trim()) return
    setSaving(true)
    try {
      await addTeacherNote(profile.uid, studentId, newNote.trim())
      setNewNote('')
    } finally {
      setSaving(false)
    }
  }

  if (!student) return (
    <div className="flex items-center justify-center h-64 text-slate-400">Student not found</div>
  )

  return (
    <div>
      <button onClick={() => navigate('/teacher/students')} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Students
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ background: `linear-gradient(135deg, ${theme.primary}40, ${theme.secondary}20)` }}>
          {theme.emoji}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{student.displayName}</h1>
          <p className="text-slate-400 text-sm capitalize">{student.instrument} · {student.experienceLevel}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="This Week" value={`${summary.totalMinutesThisWeek}m`} delay={0} />
        <StatCard label="Streak" value={`${summary.currentStreak}d`} delay={0.05} />
        <StatCard label="Consistency" value={`${summary.consistencyScore}%`} delay={0.1} />
        <StatCard label="Goal" value={`${summary.weeklyGoalPercentage}%`} delay={0.15} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Last 14 Days</p>
          <PracticeBarChart data={dailyData} color={theme.primary} />
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Category Distribution</p>
          <CategoryPieChart data={categoryData} />
        </Card>
      </div>

      <Card className="p-5 mb-8">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Practice Heatmap</p>
        <PracticeHeatmap data={heatmap} color={theme.primary} />
      </Card>

      {/* Teacher notes */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <MessageSquare size={14} /> Teacher Notes
        </p>
        <Card className="p-5 mb-4">
          <Textarea
            placeholder="Leave a note for this student..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={3}
          />
          <Button size="sm" className="mt-3" onClick={addNote} loading={saving} disabled={!newNote.trim()}>
            <Plus size={14} /> Add Note
          </Button>
        </Card>
        <div className="space-y-3">
          {notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((note) => (
            <motion.div key={note.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-slate-200">{note.content}</p>
                    <p className="text-xs text-slate-500 mt-2">{format(parseISO(note.createdAt), 'MMMM d, yyyy · h:mm a')}</p>
                  </div>
                  <button onClick={() => deleteTeacherNote(note.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
