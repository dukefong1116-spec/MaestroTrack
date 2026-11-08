import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sticker from '@/components/stickers/Sticker'
import NotificationBell from '@/components/notifications/NotificationBell'
import PinnedBadges from '@/components/badges/PinnedBadges'
import Spotlight from '@/components/onboarding/Spotlight'
import { useOnboarding } from '@/hooks/useOnboarding'
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
import Avatar from '@/components/profile/Avatar'
import StreakFlame from '@/components/icons/StreakFlame'
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

  const { show: showTour, finish: finishTour } = useOnboarding()

  const weeklyGoal = profile?.weeklyGoalMinutes ?? 300
  const minutesLeft = Math.max(0, weeklyGoal - summary.totalMinutesThisWeek)
  // Days left in the week, today included — startOfWeek is Sunday, so
  // Monday leaves six. Said out loud because "135 min to go" means
  // something different on a Tuesday than on a Saturday.
  const daysLeft = 7 - new Date().getDay()

  // NudgeList renders null when it has nothing to say, so the Block
  // around it has to ask the same question or it draws an empty rule.
  const showNudges = profile?.notify?.nudges !== false && nudges.length > 0

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-5">
      {/* Who you are is one line. It was a third of the screen, spent on a
          greeting nobody needs told twice. */}
      <div className="flex items-center gap-3 px-1">
        <Avatar
          src={profile?.avatar}
          name={profile?.displayName}
          instrument={profile?.instrument as InstrumentType | undefined}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs" style={{ color: 'var(--clay-dim)' }}>{greeting}</p>
          <p className="truncate text-[16px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
            {profile?.displayName ?? 'Musician'}
          </p>
        </div>
        {/* The bell belongs to this screen, not to every screen. Gone at
            lg, where the sidebar carries it. */}
        <div className="lg:hidden">
          <NotificationBell floating />
        </div>
      </div>

      {/* The week, made the subject: it is the question the page answers. */}
      <Panel>
        <Block first>
          <div className="flex flex-col items-center" data-coach="week-ring">
            <ProgressRing
              percentage={summary.weeklyGoalPercentage}
              size={178}
              strokeWidth={14}
              color={theme.primary}
            >
              <div className="text-center">
                <p className="text-[40px] font-bold leading-none" style={{ color: 'var(--clay-ink)' }}>
                  {summary.weeklyGoalPercentage}%
                </p>
                <p className="mt-1.5 text-[13px]" style={{ color: 'var(--clay-dim)' }}>of your week</p>
              </div>
            </ProgressRing>
            <p className="mt-3.5 text-[19px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
              {summary.totalMinutesThisWeek} of {weeklyGoal} min
            </p>
            <p className="mt-0.5 text-[13px]" style={{ color: 'var(--clay-dim)' }}>
              {minutesLeft > 0
                ? `${minutesLeft} to go · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
                : 'Goal reached'}
            </p>
          </div>
        </Block>

        {/* The seven days, labelled, so a gap in them is legible. */}
        <Block>
          <div data-coach="week-strip">
            <WeekStrip days={game.week} className="justify-between" />
          </div>
        </Block>

        {/* Streak and the badges you pinned share one line. */}
        <Block>
          <div className="flex items-center gap-2.5">
            <StreakFlame streak={game.streak} size={18} />
            <span className="min-w-0 flex-1 text-[13.5px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
              {game.streak > 0 ? `${game.streak} days` : 'No streak yet'}
              {game.freezesLeft > 0 && (
                <span style={{ color: 'var(--clay-faint)', fontWeight: 500 }}>
                  {'  ·  '}{game.freezesLeft} freeze{game.freezesLeft === 1 ? '' : 's'}
                </span>
              )}
            </span>
            <PinnedBadges size={28} />
          </div>
        </Block>

        {/* Timely prompts — previously buried on the Reminders page */}
        {showNudges && (
          <Block>
            <NudgeList />
          </Block>
        )}

        {/* A button, not a slab. */}
        <Block>
          <button
            type="button"
            data-coach="start-practising"
            onClick={() => navigate('/student/session')}
            className="flex min-h-[54px] w-full items-center justify-center gap-2.5 text-[16.5px] font-bold transition-transform active:scale-[.99]"
            style={{
              borderRadius: 'var(--clay-r-sm)',
              background: 'var(--clay-accent)',
              color: 'var(--clay-on-accent)',
            }}
          >
            <Sticker name="note" size={20} tone="onAccent" />
            {summary.currentStreak > 0 ? 'Keep it going' : 'Start practising'}
          </button>
        </Block>
      </Panel>

      {/* What is coming, quietly. */}
      {nextLesson && (
        <Panel>
          <Block first>
            <div className="flex items-center gap-3">
              <Sticker name="calendar" size={18} tone="accent" />
              <p className="min-w-0 flex-1 text-[13.5px]" style={{ color: 'var(--clay-ink)' }}>
                Next lesson{' '}
                <span style={{ color: 'var(--clay-dim)' }}>{getNextLessonText(nextLesson)}</span>
              </p>
              <p className="shrink-0 text-xs" style={{ color: 'var(--clay-dim)' }}>
                {nextLesson.durationMinutes} min
              </p>
            </div>
          </Block>
        </Panel>
      )}

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
              {todo.slice(0, 4).map((x) => (
                <AssignmentCard
                  key={x.assignment.id}
                  assignment={x.assignment}
                  progress={x.progress}
                  daily={x.daily}
                  due={x.due}
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

      {/* Mounted here rather than in the layout: every step points at
          something on this screen or at the bar under it, so the tour
          only exists where it has something to point at. */}
      {showTour && <Spotlight onDone={finishTour} />}

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
