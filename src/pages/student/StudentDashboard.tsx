import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Sticker from '@/components/stickers/Sticker'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { getAnalyticsSummary } from '@/lib/utils/analytics'
import { getTheme } from '@/lib/utils/instruments'
import { subscribeStudentAssignments, updateAssignmentStatus } from '@/lib/firebase/assignments'
import { subscribeStudentSchedule } from '@/lib/firebase/schedule'
import NudgeList from '@/components/common/NudgeList'
import WeekStrip from '@/components/streak/WeekStrip'
import BadgeMoment from '@/components/celebration/BadgeMoment'
import FreezeMoment from '@/components/celebration/FreezeMoment'
import { useGamification } from '@/hooks/useGamification'
import Card from '@/components/ui/Card'
import ProgressRing from '@/components/ui/ProgressRing'
import InstrumentIcon from '@/components/icons/InstrumentIcon'
import StreakFlame from '@/components/icons/StreakFlame'
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
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { sessions } = usePracticeStore()
  const game = useGamification()
  const theme = getTheme(profile?.instrument as InstrumentType | undefined)

  const summary = useMemo(() =>
    getAnalyticsSummary(sessions, profile?.weeklyGoalMinutes ?? 300),
    [sessions, profile?.weeklyGoalMinutes]
  )



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
        <div className="absolute top-2 right-5 opacity-[0.13] select-none pointer-events-none" style={{ color: theme.primary }}><InstrumentIcon instrument={profile?.instrument as InstrumentType | undefined} size={104} strokeWidth={1.2} /></div>
        <p className="text-[var(--clay-dim)] text-sm font-medium mb-1">{greeting}</p>
        <h1 className="text-3xl font-bold text-[var(--clay-ink)] mb-2">{profile?.displayName ?? 'Musician'}</h1>
        <div className="flex items-center gap-4 flex-wrap">
          <Badge variant="purple" size="md">
            <InstrumentIcon instrument={profile?.instrument as InstrumentType | undefined} size={13} style={{ color: theme.secondary }} />
            {theme.label}
          </Badge>
          <Badge variant="info" size="md">{profile?.experienceLevel ?? 'Student'}</Badge>
          {summary.currentStreak > 0 && (
            <Badge variant="warning" size="md">
              <StreakFlame streak={summary.currentStreak} size={14} /> {summary.currentStreak}-day streak
            </Badge>
          )}
        </div>
      </motion.div>

      {/* Next lesson */}
      {nextLesson && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-[var(--clay-accent-soft)] flex items-center justify-center shrink-0">
              <Sticker name="calendar" size={18} tone="accent" />
            </div>
            <div>
              <p className="text-xs text-[var(--clay-dim)] font-medium">Next Lesson</p>
              <p className="text-[var(--clay-ink)] font-semibold">{getNextLessonText(nextLesson)}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-[var(--clay-dim)]">{nextLesson.durationMinutes} min</p>
            </div>
          </Card>
        </motion.div>
      )}

      {/* The week at a glance — what makes the streak feel losable */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-4 px-5 py-4"
        style={{ background: 'var(--clay-surface)', borderRadius: 'var(--clay-r-md)', boxShadow: 'var(--clay-raised)' }}
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clay-dim)' }}>Streak</p>
          <p className="mt-0.5 text-[13px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
            {game.streak > 0 ? `${game.streak}-day streak` : 'Start a streak today'}
            {game.freezesLeft > 0 && (
              <span style={{ color: 'var(--clay-faint)', fontWeight: 500 }}>
                {'  ·  '}{game.freezesLeft} freeze{game.freezesLeft === 1 ? '' : 's'}
              </span>
            )}
          </p>
        </div>
        <WeekStrip days={game.week} />
      </motion.div>

      {/* Timely prompts — previously buried on the Reminders page */}
      <NudgeList />

      {/* This week + the one action that matters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-6 flex flex-col items-center justify-center gap-4">
          <p className="text-xs font-bold text-[var(--clay-dim)] uppercase tracking-widest self-start">Weekly goal</p>
          <ProgressRing percentage={summary.weeklyGoalPercentage} size={120} strokeWidth={10} color={theme.primary}>
            <div className="text-center">
              <p className="text-2xl font-bold text-[var(--clay-ink)]">{summary.weeklyGoalPercentage}%</p>
              <p className="text-xs text-[var(--clay-dim)]">of your goal</p>
            </div>
          </ProgressRing>
          <div className="text-center">
            <p className="text-sm text-[var(--clay-ink)] font-semibold">{summary.totalMinutesThisWeek} / {profile?.weeklyGoalMinutes ?? 300} min</p>
            <p className="text-xs text-[var(--clay-dim)]">
              {(profile?.weeklyGoalMinutes ?? 300) - summary.totalMinutesThisWeek > 0
                ? `${(profile?.weeklyGoalMinutes ?? 300) - summary.totalMinutesThisWeek} min to go`
                : 'Goal reached'}
            </p>
          </div>
        </Card>

        <motion.button
          onClick={() => navigate('/student/session')}
          whileTap={{ scale: 0.97 }}
          className="lg:col-span-2 flex flex-col items-center justify-center gap-3 p-8 text-center"
          style={{
            borderRadius: 'var(--clay-r-lg)',
            background: 'var(--clay-accent)',
            color: 'var(--clay-on-accent)',
            boxShadow: 'var(--clay-accent-shadow)',
          }}
        >
          <Sticker name="note" size={44} tone="onAccent" />
          <span className="text-xl font-bold">
            {summary.currentStreak > 0 ? 'Keep it going' : 'Start practising'}
          </span>
          <span className="text-sm opacity-90">
            Timer, metronome, tuner and recording — all in one place.
          </span>
        </motion.button>
      </div>

      {/* Assignments from teacher */}
      {activeAssignments.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[var(--clay-dim)] uppercase tracking-widest mb-3 flex items-center gap-2">
            <Sticker name="clipboard" size={14} tone="ink" /> This Week's Assignments
          </p>
          <div className="space-y-2">
            {activeAssignments.map((a) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[var(--clay-ink)] text-sm">{a.title}</p>
                    {a.description && <p className="text-xs text-[var(--clay-dim)] mt-0.5">{a.description}</p>}
                    {a.dueDate && (
                      <p className="text-xs text-[var(--clay-dim)] mt-1">
                        Due {format(parseISO(a.dueDate), 'MMM d')}
                        {differenceInDays(parseISO(a.dueDate), new Date()) <= 2 && (
                          <span className="text-amber-400 ml-1">· Due soon</span>
                        )}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => updateAssignmentStatus(a.id, 'completed')}
                    className="text-[var(--clay-dim)] hover:text-emerald-400 transition-colors shrink-0"
                    title="Mark complete"
                  >
                    <Sticker name="check" size={20} tone="accent" />
                  </button>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <FreezeMoment
        open={!!game.pendingFreeze}
        streak={game.pendingFreeze?.streak ?? 0}
        daysFrozen={game.pendingFreeze?.daysFrozen ?? 1}
        remaining={game.pendingFreeze?.remaining ?? 0}
        onDismiss={game.dismissFreeze}
      />
      <BadgeMoment
        badge={game.pendingBadge ? {
          id: game.pendingBadge.id,
          label: game.pendingBadge.label,
          description: game.pendingBadge.description,
        } : null}
        open={!!game.pendingBadge}
        onDismiss={game.dismissBadge}
      />
    </div>
  )
}
