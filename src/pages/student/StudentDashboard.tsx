import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sticker from '@/components/stickers/Sticker'
import NotificationBell from '@/components/notifications/NotificationBell'
import { nextOccurrence } from '@/lib/utils/notifications'
import { startOfDay } from 'date-fns'
import PinnedBadges from '@/components/badges/PinnedBadges'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { getAnalyticsSummary } from '@/lib/utils/analytics'
import AssignmentCard from '@/components/assignments/AssignmentCard'
import SubmitSheet from '@/components/assignments/SubmitSheet'
import { useAssignments } from '@/hooks/useAssignments'
import { normaliseStatus } from '@/lib/utils/assignments'
import NudgeList from '@/components/common/NudgeList'
import { usePracticeNudges } from '@/hooks/usePracticeNudges'
import FreezeMoment from '@/components/celebration/FreezeMoment'
import MasteryMoment from '@/components/celebration/MasteryMoment'
import { useGamification } from '@/hooks/useGamification'
import { Panel, Block, Legend } from '@/components/ui/Panel'
import Avatar from '@/components/profile/Avatar'
import StreakFlame, { type FlameState } from '@/components/icons/StreakFlame'
import { useStreak } from '@/hooks/useStreak'
import { markOpen } from '@/lib/utils/openTimes'
import { dowOf, freezesToSpend } from '@/lib/streak/engine'
import type { FemataMood } from '@/components/femata/Femata'
import FemataBuddy from '@/components/femata/FemataBuddy'
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
  // The real next date, so a lesson moved this week or a one-off from the
  // studio calendar reads right; a weekly slot comes out as before.
  const now = new Date()
  const when = nextOccurrence(slot, now)
  const days = Math.round((startOfDay(when).getTime() - startOfDay(now).getTime()) / 86_400_000)
  if (days === 0) return `Today at ${formatTime(slot.startTime)}`
  if (days === 1) return `Tomorrow at ${formatTime(slot.startTime)}`
  return `${DAYS[when.getDay()]} at ${formatTime(slot.startTime)}`
}

export default function StudentDashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { sessions } = usePracticeStore()
  const sessionsLive = usePracticeStore((s) => s.sessionsLoaded)

  // The real opening time on this phone, readable in Settings › About.
  const hasSomething = sessions.length > 0 || sessionsLive
  useEffect(() => {
    if (hasSomething) markOpen('shown')
    if (sessionsLive) markOpen('live')
  }, [hasSomething, sessionsLive])
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
  const femataMood: FemataMood = live.todayLit ? 'proud' : comeback ? 'sad' : 'sleepy'

  const summary = useMemo(() =>
    getAnalyticsSummary(sessions, profile?.weeklyGoalMinutes ?? 300),
    [sessions, profile?.weeklyGoalMinutes]
  )



  // The hook owns the subscription and the derived parts, so this page and
  // the Library list cannot drift apart in what they consider outstanding.
  const { todo } = useAssignments()
  const nudges = usePracticeNudges(3)
  const [opened, setOpened] = useState<Assignment | null>(null)

  // The one schedule listener the whole app shares (useStudentData), which
  // also means it shows from the saved copy at once.
  const lessonSlots: LessonSlot[] = usePracticeStore((s) => s.lessons)
  const nextLesson = lessonSlots.length > 0
    ? lessonSlots.slice().sort((a, b) => {
        const now = new Date()
        return nextOccurrence(a, now).getTime() - nextOccurrence(b, now).getTime()
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

  const firstName = (profile?.displayName ?? '').trim().split(/\s+/)[0] || 'there'
  // Today's minutes against a seventh of the weekly goal.
  const dailyGoal = Math.max(1, Math.round(weeklyGoal / 7))
  const todayMinutes = sessions.filter((x) => x.date.slice(0, 10) === live.today).reduce((a, x) => a + x.durationMinutes, 0)
  const goalReached = todayMinutes >= dailyGoal

  return (
    <div className="space-y-5">
      {/* Femata floats in the corner, showing how the day is going: sleepy
          until you practise, proud once today is lit, sad when a streak has
          just been lost. Tap it to pat it. */}
      <FemataBuddy mood={femataMood} tone={live.todayLit ? 'sunrise' : 'sky'} />
      {/* Hello, with your face big enough to be yours. The photo opens
          Settings — for a student in a studio, the Studio tab has
          Settings' place in the bar. */}
      <div className="flex items-center gap-4 px-1">
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
            size={64}
          />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[26px] font-bold leading-tight" style={{ color: 'var(--clay-ink)' }}>
            Hi {firstName}
          </p>
          <div className="mt-1"><PinnedBadges size={26} /></div>
        </div>
        {/* The bell belongs to this screen, not to every screen. Gone at
            lg, where the sidebar carries it. */}
        <div className="lg:hidden">
          <NotificationBell floating />
        </div>
      </div>

      <Panel>
        {/* The streak, made the subject: the flame, the count, the week. */}
        <Block first>
          <button
            type="button"
            onClick={() => navigate('/student/streak')}
            className="flex w-full flex-col items-center text-center transition-opacity active:opacity-80"
            data-coach="week-ring"
          >
            <span className="flex h-[132px] items-center justify-center">
              <StreakFlame streak={live.current} size={112} state={flameState} />
            </span>
            <span className="mt-1 flex items-baseline gap-2">
              <span
                className="text-[44px] font-extrabold leading-none tabular-nums"
                style={{ color: live.flameFrozen && !live.todayLit ? '#2F6FA8' : 'var(--clay-ink)' }}
              >
                {live.current}
              </span>
              <span className="text-[20px] font-bold" style={{ color: 'var(--clay-ink)' }}>
                day streak
              </span>
            </span>
            <span className="mt-1.5 flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--clay-dim)' }}>
              <span>{streakLine}</span>
              {live.held > 0 && (
                <span className="flex shrink-0 items-center gap-0.5 font-semibold" style={{ color: '#2F6FA8' }} aria-label={`${live.held} freeze${live.held === 1 ? '' : 's'}`}>
                  · <Snowflake size={12} /> {live.held}
                </span>
              )}
            </span>
          </button>

          {/* The week as flames: lit where you practised, ice where a
              freeze held it, a ring round today. */}
          <button
            type="button"
            onClick={() => navigate('/student/streak')}
            data-coach="week-strip"
            aria-label="Your week"
            className="mt-4 flex w-full items-end justify-between rounded-2xl px-3 py-3 transition-opacity active:opacity-80"
            style={{ background: 'var(--clay-bg)' }}
          >
            {game.week.map((d) => (
              <span key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={d.isToday ? { boxShadow: '0 0 0 2px var(--clay-accent)' } : undefined}
                >
                  {d.frozen && !d.practised
                    ? <span style={{ color: '#2F6FA8' }}><Snowflake size={20} /></span>
                    : <StreakFlame streak={d.practised ? Math.max(1, live.current) : 0} size={24} state={d.practised ? 'lit' : 'unlit'} still />}
                </span>
                <span className="text-[11px] font-semibold" style={{ color: d.isToday ? 'var(--clay-ink)' : 'var(--clay-dim)' }}>
                  {d.label}
                </span>
              </span>
            ))}
          </button>

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

        {/* Start practice: the one thing to do here. */}
        <Block>
          <button
            type="button"
            data-coach="start-practising"
            onClick={() => navigate('/student/session')}
            className="flex min-h-[58px] w-full items-center justify-center gap-2.5 text-[17px] font-bold transition-transform active:scale-[.99]"
            style={{
              borderRadius: 'var(--clay-r-md)',
              background: 'var(--clay-accent)',
              color: 'var(--clay-on-accent)',
            }}
          >
            <Sticker name="note" size={20} tone="onAccent" />
            {live.current > 0 ? 'Keep it going' : 'Start practising'}
          </button>
        </Block>

        {/* Today's goal, as a bar that fills. */}
        <Block>
          <div className="flex items-baseline justify-between">
            <p className="text-[15px] font-bold" style={{ color: 'var(--clay-ink)' }}>
              {goalReached ? 'Daily goal reached' : 'Daily goal'}
            </p>
            <p className="text-[13px] font-semibold tabular-nums" style={{ color: goalReached ? 'var(--clay-success-fg)' : 'var(--clay-dim)' }}>
              {todayMinutes} / {dailyGoal} min
            </p>
          </div>
          <div className="mt-2.5 h-3 overflow-hidden rounded-full" style={{ background: 'var(--clay-bg-deep)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, Math.round((todayMinutes / Math.max(1, dailyGoal)) * 100))}%`,
                background: goalReached ? 'var(--clay-success-fg)' : 'var(--clay-accent)',
              }}
            />
          </div>
          <p className="mt-2 text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>
            This week {summary.totalMinutesThisWeek} of {weeklyGoal} min
            {minutesLeft > 0 ? ` · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : ' · week done'}
          </p>
        </Block>

        {/* Timely prompts — previously buried on the Reminders page */}
        {showNudges && (
          <Block>
            <NudgeList />
          </Block>
        )}
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
        // After any badge on screen: one celebration at a time.
        open={!!game.pendingFreeze && !game.pendingBadge}
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
    </div>
  )
}
