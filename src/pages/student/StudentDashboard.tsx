import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
import Avatar from '@/components/profile/Avatar'
import StreakFlame, { type FlameState } from '@/components/icons/StreakFlame'
import { useStreak } from '@/hooks/useStreak'
import { dowOf, freezesToSpend } from '@/lib/streak/engine'
import type { InstrumentType, Assignment, LessonSlot } from '@/types'

function Snowflake({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
      <path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2 3.8 16.8" />
    </svg>
  )
}

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
  const live = useStreak()
  const flameState: FlameState = live.todayLit ? 'lit' : live.flameFrozen ? 'frozen' : 'unlit'
  const min = live.todayRule.min
  // What is still to do today, once some of it is done.
  const toGo = Math.max(1, min - live.todayMinutes)
  const amount = live.todayMinutes > 0 ? `${toGo} more min` : `${min} min`
  const streakLine = live.todayLit
    ? "Today's lit"
    : live.flameFrozen
      ? (min > 0 ? `Frozen · practise ${amount} to thaw` : 'Frozen · practise to thaw it')
      : live.todayRule.lessonDay === dowOf(live.today)
        ? 'Lesson day · your streak holds today'
        : min > 0
          ? `Practise ${amount} to light today`
          : live.current > 0 ? 'Practise today to light it' : 'Practise today to start one'
  // A freeze about to be spent comes first; the comeback is for when
  // there was none.
  const comeback = live.comeback && !live.comeback.complete && freezesToSpend(live).length === 0
    ? live.comeback
    : null
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
        {/* Your photo opens Settings — for a student in a studio, the Studio
            tab has Settings' place in the bar. */}
        <button
          type="button"
          onClick={() => navigate('/student/settings')}
          aria-label="Settings"
          data-coach="settings-photo"
          className="shrink-0 rounded-full transition-transform active:scale-95"
        >
          <Avatar
            src={profile?.avatar}
            name={profile?.displayName}
            instrument={profile?.instrument as InstrumentType | undefined}
            size={40}
          />
        </button>
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

        {/* Streak and the badges you pinned share one line. The streak
            opens its own page. */}
        <Block>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/student/streak')}
              className="flex min-w-0 flex-1 items-center gap-3 text-left transition-opacity active:opacity-70"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center">
                <StreakFlame streak={live.current} size={28} state={flameState} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold leading-tight" style={{ color: live.flameFrozen && !live.todayLit ? '#2F6FA8' : 'var(--clay-ink)' }}>
                  {live.current > 0 ? `${live.current}-day streak` : 'No streak yet'}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--clay-dim)' }}>
                  <span className="truncate">{streakLine}</span>
                  {live.held > 0 && (
                    <span className="flex shrink-0 items-center gap-0.5 font-semibold" style={{ color: '#2F6FA8' }} aria-label={`${live.held} freeze${live.held === 1 ? '' : 's'}`}>
                      · <Snowflake size={11} /> {live.held}
                    </span>
                  )}
                </span>
              </span>
            </button>
            <PinnedBadges size={28} />
          </div>
          {comeback && (
            <button
              type="button"
              onClick={() => navigate('/student/streak')}
              className="mt-3 w-full rounded-2xl px-3.5 py-2.5 text-left"
              style={{ background: 'rgba(242,163,58,.14)' }}
            >
              <span className="block text-[13px] font-semibold" style={{ color: '#9A5A0C' }}>
                Bring back your {comeback.restore}-day streak
              </span>
              <span className="block text-[12px]" style={{ color: '#9A5A0C' }}>
                {comeback.done === 0 ? 'Practise today and tomorrow, and it’s back.' : 'Practise today and it’s back. 1 of 2 done.'}
              </span>
            </button>
          )}
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
            {live.current > 0 ? 'Keep it going' : 'Start practising'}
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
                onClick={() => navigate('/student/studio/assignments')}
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

      <SubmitSheet assignment={opened} open={!!opened} onClose={() => setOpened(null)} />

      <FreezeMoment
        open={!!game.pendingFreeze}
        streak={game.pendingFreeze?.streak ?? 0}
        days={game.pendingFreeze?.days ?? []}
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
