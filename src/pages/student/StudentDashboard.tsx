import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Flame, Target, Clock, Music, Trophy, Zap, ClipboardList, CheckCircle2, CalendarClock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { getAnalyticsSummary, getDailyData, getHeatmapData } from '@/lib/utils/analytics'
import { getTheme } from '@/lib/utils/instruments'
import { subscribeStudentAssignments, updateAssignmentStatus } from '@/lib/firebase/assignments'
import { subscribeStudentSchedule } from '@/lib/firebase/schedule'
import StatCard from '@/components/common/StatCard'
import Card from '@/components/ui/Card'
import ProgressRing from '@/components/ui/ProgressRing'
import PracticeBarChart from '@/components/charts/PracticeBarChart'
import PracticeHeatmap from '@/components/charts/PracticeHeatmap'
import Badge from '@/components/ui/Badge'
import { format, parseISO, differenceInDays } from 'date-fns'
import type { InstrumentType, Assignment, LessonSlot } from '@/types'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function getNextLessonText(slot: LessonSlot): string {
  const today = new Date().getDay()
  let daysUntil = (slot.dayOfWeek - today + 7) % 7
  if (daysUntil === 0) daysUntil = 7 // next week if today
  if (daysUntil === 0) return `Today at ${formatTime(slot.startTime)}`
  if (daysUntil === 1) return `Tomorrow at ${formatTime(slot.startTime)}`
  return `${DAYS[slot.dayOfWeek]} at ${formatTime(slot.startTime)}`
}

export default function StudentDashboard() {
  const { profile } = useAuth()
  const { sessions, pieces, performances } = usePracticeStore()
  const theme = getTheme(profile?.instrument as InstrumentType | undefined)

  const summary = useMemo(() =>
    getAnalyticsSummary(sessions, profile?.weeklyGoalMinutes ?? 300),
    [sessions, profile?.weeklyGoalMinutes]
  )
  const dailyData = useMemo(() => getDailyData(sessions, 14), [sessions])
  const heatmapData = useMemo(() => getHeatmapData(sessions), [sessions])

  const upcomingPerformances = performances
    .filter((p) => differenceInDays(parseISO(p.date), new Date()) >= 0)
    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
    .slice(0, 3)

  const activePieces = pieces.filter((p) => p.status === 'active').slice(0, 4)

  const [assignments, setAssignments] = useState<Assignment[]>([])
  useEffect(() => {
    if (!profile?.uid) return
    return subscribeStudentAssignments(profile.uid, setAssignments)
  }, [profile?.uid])
  const activeAssignments = assignments.filter((a) => a.status === 'active')

  const [lessonSlots, setLessonSlots] = useState<LessonSlot[]>([])
  useEffect(() => {
    if (!profile?.uid) return
    return subscribeStudentSchedule(profile.uid, setLessonSlots)
  }, [profile?.uid])
  const nextLesson = lessonSlots.length > 0
    ? lessonSlots.slice().sort((a, b) => {
        const today = new Date().getDay()
        const da = (a.dayOfWeek - today + 7) % 7 || 7
        const db = (b.dayOfWeek - today + 7) % 7 || 7
        return da - db
      })[0]
    : null

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-8">
      {/* Hero greeting */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-8"
        style={{ background: `linear-gradient(135deg, ${theme.primary}30, ${theme.secondary}10)`, border: `1px solid ${theme.primary}30` }}
      >
        <div className="absolute top-4 right-6 text-7xl opacity-20 select-none">{theme.emoji}</div>
        <p className="text-[#6B6860] text-sm font-medium mb-1">{greeting}</p>
        <h1 className="text-3xl font-bold text-[#22201C] mb-2">{profile?.displayName ?? 'Musician'} 👋</h1>
        <div className="flex items-center gap-4 flex-wrap">
          <Badge variant="purple" size="md">
            <span style={{ color: theme.secondary }}>{theme.emoji}</span>
            {theme.label}
          </Badge>
          <Badge variant="info" size="md">{profile?.experienceLevel ?? 'Student'}</Badge>
          {summary.currentStreak > 0 && (
            <Badge variant="warning" size="md">
              🔥 {summary.currentStreak}-day streak
            </Badge>
          )}
        </div>
      </motion.div>

      {/* Next lesson */}
      {nextLesson && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-[#FDDDD9] flex items-center justify-center shrink-0">
              <CalendarClock size={18} className="text-[#E8503A]" />
            </div>
            <div>
              <p className="text-xs text-[#6B6860] font-medium">Next Lesson</p>
              <p className="text-[#22201C] font-semibold">{getNextLessonText(nextLesson)}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-[#6B6860]">{nextLesson.durationMinutes} min</p>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Practice Streak"
          value={`${summary.currentStreak}d`}
          subtitle={`Best: ${summary.longestStreak} days`}
          icon={<Flame size={16} />}
          accent={theme.primary}
          delay={0.05}
        />
        <StatCard
          label="This Week"
          value={`${Math.round(summary.totalMinutesThisWeek / 60 * 10) / 10}h`}
          subtitle={`Goal: ${Math.round((profile?.weeklyGoalMinutes ?? 300) / 60)}h`}
          icon={<Clock size={16} />}
          accent={theme.primary}
          delay={0.1}
        >
          <div className="mt-2 h-1.5 bg-[#DEDAD2] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${summary.weeklyGoalPercentage}%`, background: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})` }} />
          </div>
        </StatCard>
        <StatCard
          label="This Month"
          value={`${Math.round(summary.totalMinutesThisMonth / 60)}h`}
          subtitle="Total practice"
          icon={<Target size={16} />}
          accent={theme.primary}
          delay={0.15}
        />
        <StatCard
          label="Consistency"
          value={`${summary.consistencyScore}%`}
          subtitle="Last 30 days"
          icon={<Zap size={16} />}
          accent={theme.primary}
          delay={0.2}
        />
      </div>

      {/* Weekly goal ring + bar chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-6 flex flex-col items-center justify-center gap-4">
          <p className="text-xs font-semibold text-[#6B6860] uppercase tracking-widest self-start">Weekly Goal</p>
          <ProgressRing percentage={summary.weeklyGoalPercentage} size={120} strokeWidth={10} color={theme.primary}>
            <div className="text-center">
              <p className="text-2xl font-bold text-[#22201C]">{summary.weeklyGoalPercentage}%</p>
              <p className="text-xs text-[#6B6860]">complete</p>
            </div>
          </ProgressRing>
          <div className="text-center">
            <p className="text-sm text-[#22201C] font-medium">{summary.totalMinutesThisWeek} / {profile?.weeklyGoalMinutes ?? 300} min</p>
            <p className="text-xs text-[#6B6860]">{(profile?.weeklyGoalMinutes ?? 300) - summary.totalMinutesThisWeek > 0 ? `${(profile?.weeklyGoalMinutes ?? 300) - summary.totalMinutesThisWeek} min to go` : '🎉 Goal reached!'}</p>
          </div>
        </Card>

        <Card className="lg:col-span-2 p-5">
          <p className="text-xs font-semibold text-[#6B6860] uppercase tracking-widest mb-4">Last 14 Days</p>
          <PracticeBarChart data={dailyData} color={theme.primary} />
        </Card>
      </div>

      {/* Active Pieces */}
      {activePieces.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#6B6860] uppercase tracking-widest mb-3 flex items-center gap-2">
            <Music size={14} /> Active Pieces
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {activePieces.map((piece, i) => (
              <motion.div key={piece.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
                <Card className="p-4" hover>
                  <p className="font-semibold text-[#22201C] text-sm truncate">{piece.title}</p>
                  {piece.composer && <p className="text-xs text-[#6B6860] truncate">{piece.composer}</p>}
                  <div className="mt-3 h-1 bg-[#DEDAD2] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${piece.completionPercentage}%`, backgroundColor: theme.primary }} />
                  </div>
                  <p className="text-xs text-[#6B6860] mt-1">{piece.completionPercentage}% ready · {piece.totalMinutes}min</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming performances */}
      {upcomingPerformances.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#6B6860] uppercase tracking-widest mb-3 flex items-center gap-2">
            <Trophy size={14} /> Upcoming Performances
          </p>
          <div className="space-y-2">
            {upcomingPerformances.map((perf) => {
              const daysLeft = differenceInDays(parseISO(perf.date), new Date())
              return (
                <Card key={perf.id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[#22201C] text-sm">{perf.eventName}</p>
                    <p className="text-xs text-[#6B6860]">{format(parseISO(perf.date), 'MMMM d, yyyy')} · {perf.location}</p>
                  </div>
                  <Badge variant={daysLeft <= 7 ? 'danger' : daysLeft <= 30 ? 'warning' : 'info'} size="md">
                    {daysLeft === 0 ? 'Today!' : `${daysLeft}d away`}
                  </Badge>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Assignments from teacher */}
      {activeAssignments.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#6B6860] uppercase tracking-widest mb-3 flex items-center gap-2">
            <ClipboardList size={14} /> This Week's Assignments
          </p>
          <div className="space-y-2">
            {activeAssignments.map((a) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#22201C] text-sm">{a.title}</p>
                    {a.description && <p className="text-xs text-[#6B6860] mt-0.5">{a.description}</p>}
                    {a.dueDate && (
                      <p className="text-xs text-[#6B6860] mt-1">
                        Due {format(parseISO(a.dueDate), 'MMM d')}
                        {differenceInDays(parseISO(a.dueDate), new Date()) <= 2 && (
                          <span className="text-amber-400 ml-1">· Due soon</span>
                        )}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => updateAssignmentStatus(a.id, 'completed')}
                    className="text-[#6B6860] hover:text-emerald-400 transition-colors shrink-0"
                    title="Mark complete"
                  >
                    <CheckCircle2 size={20} />
                  </button>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap */}
      <Card className="p-5">
        <p className="text-xs font-semibold text-[#6B6860] uppercase tracking-widest mb-4">Practice Activity — Last Year</p>
        <PracticeHeatmap data={heatmapData} color={theme.primary} />
      </Card>
    </div>
  )
}
