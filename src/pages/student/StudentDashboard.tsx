import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Sticker from '@/components/stickers/Sticker'
import NotificationBell from '@/components/notifications/NotificationBell'
import PinnedBadges from '@/components/badges/PinnedBadges'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { getAnalyticsSummary } from '@/lib/utils/analytics'
import { getTheme } from '@/lib/utils/instruments'
import { subscribeStudentSchedule } from '@/lib/firebase/schedule'
import AssignmentCard from '@/components/assignments/AssignmentCard'
import SubmitSheet from '@/components/assignments/SubmitSheet'
import { useAssignments } from '@/hooks/useAssignments'
import { normaliseStatus } from '@/lib/utils/assignments'
import NudgeList from '@/components/common/NudgeList'
import { usePracticeNudges } from '@/hooks/usePracticeNudges'
import WeekStrip from '@/components/streak/WeekStrip'
import BadgeMoment from '@/components/celebration/BadgeMoment'
import FreezeMoment from '@/components/celebration/FreezeMoment'
import MasteryMoment from '@/components/celebration/MasteryMoment'
import { useGamification } from '@/hooks/useGamification'
import { Panel, Block, Legend } from '@/components/ui/Panel'
import ProgressRing from '@/components/ui/ProgressRing'
import InstrumentIcon from '@/components/icons/InstrumentIcon'
import StreakFlame from '@/components/icons/StreakFlame'
import Badge from '@/components/ui/Badge'
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



  // The hook owns the subscription and the derived parts, so this page and
  // the Library list cannot drift apart in what they consider outstanding.
  const { todo } = useAssignments()
  const nudges = usePracticeNudges(3)
  const [opened, setOpened] = useState<Assignment | null>(null)

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

  // NudgeList renders null when it has nothing to say, so the Block
  // around it has to ask the same question or it draws an empty rule.
  const showNudges = profile?.notify?.nudges !== false && nudges.length > 0

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-6">
      {/* One surface for the state of the day: who you are, what is next,
          how the week is going, and the one button that matters. These
          were six cards floating a gap apart, which read as a pile of
          unrelated widgets rather than a page. */}
      <Panel>
        {/* Hero greeting — keeps the instrument gradient, loses the
            separate border and shadow; it is the top of the panel now. */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden p-6 sm:p-8"
          style={{ background: `linear-gradient(135deg, ${theme.primary}30, ${theme.secondary}10)` }}
        >
          <div className="pointer-events-none absolute right-5 top-2 select-none opacity-[0.13]" style={{ color: theme.primary }}>
            <InstrumentIcon instrument={profile?.instrument as InstrumentType | undefined} size={104} strokeWidth={1.2} />
          </div>
          {/* The bell lives here rather than floating over every screen:
              this is the one place notifications point at, and inside the
              hero it scrolls away like everything else. Gone at lg, where
              the sidebar carries it. */}
          <div className="absolute right-4 top-4 z-10 lg:hidden">
            <NotificationBell floating />
          </div>
          <p className="mb-1 text-sm font-medium" style={{ color: 'var(--clay-dim)' }}>{greeting}</p>
          <h1 className="mb-2 text-3xl font-bold" style={{ color: 'var(--clay-ink)' }}>{profile?.displayName ?? 'Musician'}</h1>
          <div className="flex flex-wrap items-center gap-4">
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

          {/* The badges chosen for Today, in the greeting itself. Nothing
              at all when none are pinned. */}
          <div className="mt-4">
            <PinnedBadges />
          </div>
        </motion.div>

        {nextLesson && (
          <Block>
            <div className="flex items-center gap-4">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center"
                style={{ background: 'var(--clay-accent-soft)', borderRadius: 'var(--clay-r-sm)' }}
              >
                <Sticker name="calendar" size={18} tone="accent" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium" style={{ color: 'var(--clay-dim)' }}>Next lesson</p>
                <p className="font-semibold" style={{ color: 'var(--clay-ink)' }}>{getNextLessonText(nextLesson)}</p>
              </div>
              <p className="ml-auto shrink-0 text-xs" style={{ color: 'var(--clay-dim)' }}>
                {nextLesson.durationMinutes} min
              </p>
            </div>
          </Block>
        )}

        {/* The week at a glance — what makes the streak feel losable */}
        <Block>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
            <div className="min-w-0">
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
            <WeekStrip days={game.week} className="w-full justify-between md:w-auto md:justify-end" />
          </div>
        </Block>

        {/* Timely prompts — previously buried on the Reminders page */}
        {showNudges && (
          <Block>
            <NudgeList />
          </Block>
        )}

        <Block>
          <div className="flex items-center gap-5 sm:gap-7">
            <ProgressRing percentage={summary.weeklyGoalPercentage} size={104} strokeWidth={9} color={theme.primary}>
              <div className="text-center">
                <p className="text-xl font-bold" style={{ color: 'var(--clay-ink)' }}>{summary.weeklyGoalPercentage}%</p>
              </div>
            </ProgressRing>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clay-dim)' }}>Weekly goal</p>
              <p className="mt-1 text-lg font-semibold" style={{ color: 'var(--clay-ink)' }}>
                {summary.totalMinutesThisWeek} / {profile?.weeklyGoalMinutes ?? 300} min
              </p>
              <p className="text-xs" style={{ color: 'var(--clay-dim)' }}>
                {(profile?.weeklyGoalMinutes ?? 300) - summary.totalMinutesThisWeek > 0
                  ? `${(profile?.weeklyGoalMinutes ?? 300) - summary.totalMinutesThisWeek} min to go`
                  : 'Goal reached'}
              </p>
            </div>
          </div>
        </Block>

        {/* The one action, attached to the panel rather than floating
            beside it: it is the end of the page, so it is the end of the
            surface. */}
        <motion.button
          onClick={() => navigate('/student/session')}
          whileTap={{ scale: 0.99 }}
          className="flex w-full flex-col items-center justify-center gap-2 p-7 text-center"
          style={{ background: 'var(--clay-accent)', color: 'var(--clay-on-accent)' }}
        >
          <Sticker name="note" size={40} tone="onAccent" />
          <span className="text-xl font-bold">
            {summary.currentStreak > 0 ? 'Keep it going' : 'Start practising'}
          </span>
          <span className="text-sm opacity-90">
            Timer, metronome, tuner and recording — all in one place.
          </span>
        </motion.button>
      </Panel>

      {/* Assignments from teacher — their own panel, because a list of
          things handed to you is a different subject from how your week
          is going, and each one is genuinely a separate object. */}
      {todo.length > 0 && (
        <Panel>
          <Block first>
            <Legend title="This week's assignments" />
            <div className="space-y-2">
              {/* The same card as the Library list, so an assignment looks and
                  behaves the same wherever it is met. This replaces a tick
                  that set the status to 'completed' directly — which skipped
                  submission and review entirely, so a student could mark work
                  done here while the other screen was still asking them to
                  hand it in. */}
              {todo.slice(0, 4).map((x, i) => (
                <AssignmentCard
                  key={x.assignment.id}
                  assignment={x.assignment}
                  progress={x.progress}
                  daily={x.daily}
                  due={x.due}
                  index={i}
                  onOpen={() => setOpened(x.assignment)}
                  actionLabel={normaliseStatus(x.assignment.status) === 'returned' ? 'Try again' : 'Hand in'}
                />
              ))}
            </div>
            {todo.length > 4 && (
              <button
                onClick={() => navigate('/student/library?tab=assignments')}
                className="mt-2.5 text-[12.5px] font-semibold"
                style={{ color: 'var(--clay-accent)' }}
              >
                {todo.length - 4} more
              </button>
            )}
          </Block>
        </Panel>
      )}

      <SubmitSheet assignment={opened} open={!!opened} onClose={() => setOpened(null)} />

      <FreezeMoment
        open={!!game.pendingFreeze}
        streak={game.pendingFreeze?.streak ?? 0}
        daysFrozen={game.pendingFreeze?.daysFrozen ?? 1}
        remaining={game.pendingFreeze?.remaining ?? 0}
        onDismiss={game.dismissFreeze}
      />
      <MasteryMoment
        candidate={game.pendingMastery}
        open={!!game.pendingMastery}
        onConfirm={game.confirmMastery}
        onDismiss={game.dismissMastery}
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
