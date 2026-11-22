import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { Panel, SettingsScreen } from '@/components/ui/Panel'
import Femata, { type FemataMood } from '@/components/femata/Femata'
import { haptic } from '@/lib/haptics'
import { DAYS_PER_FREEZE, MAX_FREEZES } from '@/lib/streak/engine'
import { DAILY_CAP, DAY_MIN, ROOM_MAX, STREAK_DAYS, TIERS } from '@/lib/league/rules'

/**
 * The whole app, explained: Settings › Guide.
 *
 * One page for a student, one for a teacher, each a list of topics that
 * open in place, with Femata's face on each. Written as what to do, not as
 * a tour of the screens.
 */

interface Topic { id: string; mood: FemataMood; title: string; lead: string; body: ReactNode }

const P = ({ children }: { children: ReactNode }) => (
  <p className="text-[14px] leading-relaxed" style={{ color: 'var(--clay-ink)' }}>{children}</p>
)
const Steps = ({ items }: { items: ReactNode[] }) => (
  <ol className="space-y-2">
    {items.map((x, i) => (
      <li key={i} className="flex gap-2.5 text-[14px] leading-snug" style={{ color: 'var(--clay-ink)' }}>
        <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: 'var(--clay-accent-soft)', color: 'var(--clay-accent-ink)' }}>{i + 1}</span>
        <span>{x}</span>
      </li>
    ))}
  </ol>
)
const Tip = ({ children }: { children: ReactNode }) => (
  <p className="rounded-xl px-3.5 py-2.5 text-[13px] leading-snug" style={{ background: 'var(--clay-bg)', color: 'var(--clay-dim)' }}>💡 {children}</p>
)
const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold">{children}</strong>

const top = TIERS[TIERS.length - 1].name

const STUDENT: Topic[] = [
  {
    id: 'start', mood: 'happy', title: 'Getting started', lead: 'Your first five minutes.',
    body: <>
      <Steps items={[
        <>Open <B>Today</B>. It shows your streak, your week and today’s goal.</>,
        <>Tap <B>Start</B> (or <B>Keep it going</B>). A session opens and the clock starts.</>,
        <>Pick what you’re practising: a category, and your pieces if you have some.</>,
        <>Play. When you’re done, tap <B>Finish</B> and say how it went.</>,
        <>Back on Today, your flame is lit. Come back tomorrow to grow the streak.</>,
      ]} />
      <Tip>Forgot to time a session? Practice › <B>Log past</B> adds one after the fact.</Tip>
    </>,
  },
  {
    id: 'streak', mood: 'proud', title: 'Your streak', lead: 'Lighting the flame, freezes and comebacks.',
    body: <>
      <P>Practise on a day and that day’s flame lights. Days in a row make your streak. Tap the flame on Today to see every day on a calendar.</P>
      <P><B>Freezes</B> save a missed day. You earn one every {DAYS_PER_FREEZE} days of practice and can hold up to {MAX_FREEZES}. When you miss a day, a freeze is used for you and the streak carries on.</P>
      <P><B>Lesson days</B> count too: on the day of your lesson, the lesson itself keeps the streak.</P>
      <P><B>Comebacks</B>: lost a streak with no freeze left? Practise two days running soon after, and it comes back.</P>
      <P><B>Streak goal</B>: choose how far to aim (7, 14, 30, 50 days or your own). Femata cheers you on the way.</P>
    </>,
  },
  {
    id: 'session', mood: 'focused', title: 'Practice sessions', lead: 'The timer, tools and finishing.',
    body: <>
      <P>A session times itself. Pause whenever you stop; only the time you play counts.</P>
      <P>Switch <B>categories</B> as you go (scales, technique, a piece…). Your minutes are split between them.</P>
      <P>The <B>tools</B> are in the session: notes, a metronome, a tuner and a recorder. Recordings are saved with the session.</P>
      <P><B>Finish</B> asks how it went, saves the session and celebrates what you earned.</P>
      <Tip>In the iPhone app, a running session shows on your Lock Screen and in the Dynamic Island, with Pause and Finish right there.</Tip>
    </>,
  },
  {
    id: 'library', mood: 'thinking', title: 'Library and pieces', lead: 'What you’re learning, and who sees it.',
    body: <>
      <P>Add the pieces you’re learning in <B>Library</B>. Pick them in a session and Femata tracks the minutes, sessions and progress on each.</P>
      <P>Mark a piece <B>Mastered</B> when it’s done, or <B>Archive</B> it to put it away.</P>
      <P>In a studio, each piece has a <B>“Let my teacher see this”</B> switch. Pieces your teacher adds for you show <B>From your teacher</B>, and you’re told when one arrives.</P>
      <P>Performances coming up live in Library too.</P>
    </>,
  },
  {
    id: 'progress', mood: 'celebrate', title: 'History, progress and badges', lead: 'Everything you’ve done.',
    body: <>
      <P><B>Practice › Sessions</B> is your history. Tap a session to see its notes and recordings, share it or delete it.</P>
      <P><B>Practice › Progress</B> shows your goals for the day, week and month, your patterns, and your badges.</P>
      <P>Badges are won as you go: streaks, minutes, variety, early mornings… Pin your favourites next to your name on Today.</P>
    </>,
  },
  {
    id: 'league', mood: 'excited', title: 'The weekly league', lead: 'Practise, climb, move up.',
    body: <>
      <P>Each week you’re in a room with up to {ROOM_MAX} players near your time zone. Practice earns points: minutes on the timer (up to {DAILY_CAP} a day), a bonus for each day of at least {DAY_MIN} minutes, and extra from day {STREAK_DAYS} of a streak.</P>
      <P>When the week ends, the top of the room <B>moves up</B> a tier and the bottom moves down. The tiers go from {TIERS[0].name} to {top}; the top three in {top} finish the week as <B>Maestro</B>.</P>
      <Tip>You can leave the league any time in Settings › Privacy &amp; Security.</Tip>
    </>,
  },
  {
    id: 'studio', mood: 'wink', title: 'Your teacher’s studio', lead: 'Assignments, lessons and messages.',
    body: <>
      <P>Join with the link or code your teacher sends. Once they accept, a <B>Studio</B> tab appears (and Settings moves behind your photo on Today).</P>
      <P><B>Assignments</B>: what your teacher set, with a due date. Hand work in with a recording; your teacher approves it or sends it back with notes.</P>
      <P><B>Lessons</B>: your next lesson shows on Today, and you’re reminded the day before.</P>
      <P><B>Messages</B>: talk to your teacher right in the app.</P>
    </>,
  },
  {
    id: 'phone', mood: 'cool', title: 'Widgets and the iPhone app', lead: 'Femata on your Home Screen.',
    body: <>
      <Steps items={[
        <>Touch and hold an empty spot on your Home Screen.</>,
        <>Tap <B>Edit</B> › <B>Add Widget</B>, then find <B>Femata</B>.</>,
        <>Pick a size: your streak, your day, or your lessons.</>,
      ]} />
      <P>Widgets follow whoever is signed in, and the <B>Start</B> button opens a session straight away.</P>
    </>,
  },
  {
    id: 'settings', mood: 'sleepy', title: 'Notifications, look and feel', lead: 'Make it yours.',
    body: <>
      <P><B>Notifications</B>: choose what the bell tells you about, and set a daily practice reminder.</P>
      <P><B>Appearance</B>: light or dark, an accent colour, text size, reduce motion, and <B>Haptics</B> (the little taps you feel on streaks, finishes and Femata).</P>
      <P>And Femata? Tap it for a pat. Drag it anywhere on the screen; it stays where you leave it.</P>
    </>,
  },
]

const TEACHER: Topic[] = [
  {
    id: 'start', mood: 'happy', title: 'Getting started', lead: 'Set up your studio.',
    body: <>
      <Steps items={[
        <>Settings › <B>Lessons and prices</B>: your lesson lengths and what you charge.</>,
        <>Settings › <B>Calendar hours</B>: when you teach.</>,
        <><B>Add a student</B> (on More): invite them to the app, or just keep a record.</>,
        <>Put lessons on the <B>Calendar</B> with the round <B>+</B>.</>,
      ]} />
      <Tip>An invite link lasts a week. A student who joins appears on your Students page once you accept.</Tip>
    </>,
  },
  {
    id: 'today', mood: 'focused', title: 'Today', lead: 'Your day at a glance.',
    body: <P>Today lists your lessons in order, students who have gone quiet, and anything waiting for you. Tap a lesson to open the student.</P>,
  },
  {
    id: 'calendar', mood: 'thinking', title: 'Calendar', lead: 'Lessons and events.',
    body: <>
      <P>Switch between week and month. The <B>+</B> adds a lesson or an event; tap any lesson to move it, cancel one date or the whole series.</P>
      <P>Colour lessons with <B>tags</B> (beginners, exam prep…) from the panel beside the calendar.</P>
    </>,
  },
  {
    id: 'students', mood: 'proud', title: 'Students', lead: 'Everything about one student.',
    body: <>
      <P>Open a student for their tabs:</P>
      <Steps items={[
        <><B>Lessons and notes</B>: what you covered, and what’s next.</>,
        <><B>Assignments</B>: the <B>+</B> sets new work; they see it in their app.</>,
        <><B>Repertoire</B>: the pieces in their Library they share with you, live. The <B>+</B> adds a piece straight to their Library (they’re notified), or tracks a skill.</>,
        <><B>Practice</B>, <B>Recordings</B> and <B>Report</B>: how much, what they recorded, and a report to share with parents.</>,
      ]} />
    </>,
  },
  {
    id: 'review', mood: 'wink', title: 'Review', lead: 'Work handed in.',
    body: <P>Submitted assignments wait here. Listen, then <B>Approve</B> or <B>Send back</B> with a note. The student is told either way.</P>,
  },
  {
    id: 'money', mood: 'cool', title: 'Families and invoices', lead: 'Who owes what.',
    body: <P>Group students into families, see balances, record payments and email invoices or reminders in one go.</P>,
  },
  {
    id: 'phone', mood: 'excited', title: 'Widgets and the iPhone app', lead: 'Your studio on the Home Screen.',
    body: <>
      <P>Add a <B>Femata</B> widget from the Home Screen’s Edit › Add Widget. As a teacher you see your next lesson, recordings to review, and a <B>Lessons</B> calendar of what’s coming.</P>
    </>,
  },
  {
    id: 'settings', mood: 'sleepy', title: 'Notifications, look and feel', lead: 'Make it yours.',
    body: <P><B>Notifications</B> decides what the bell tells you about. <B>Appearance</B> has light and dark, colours, text size, reduce motion and <B>Haptics</B>.</P>,
  },
]

export default function GuidePage() {
  const { profile } = useAuth()
  const teacher = profile?.role === 'teacher'
  const topics = teacher ? TEACHER : STUDENT
  const [open, setOpen] = useState<string | null>(topics[0].id)

  return (
    <SettingsScreen title="Guide" back={teacher ? '/teacher/settings' : '/student/settings'}>
      <div className="flex items-center gap-4 px-1">
        <Femata mood="happy" size={72} />
        <p className="text-[15px] leading-snug" style={{ color: 'var(--clay-ink)' }}>
          Everything Femata does, in one place. Tap a topic to open it.
        </p>
      </div>
      <Panel>
        {topics.map((t, i) => {
          const on = open === t.id
          return (
            <div key={t.id} style={i ? { borderTop: '1px solid var(--clay-line)' } : undefined}>
              <button
                type="button"
                aria-expanded={on}
                onClick={() => { haptic('select'); setOpen(on ? null : t.id) }}
                className="flex w-full items-center gap-3.5 px-5 py-4 text-left sm:px-6"
              >
                <span className="shrink-0"><Femata mood={t.mood} size={38} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold" style={{ color: 'var(--clay-ink)' }}>{t.title}</span>
                  <span className="block text-xs" style={{ color: 'var(--clay-dim)' }}>{t.lead}</span>
                </span>
                <ChevronDown size={18} className="shrink-0 transition-transform" style={{ color: 'var(--clay-faint)', transform: on ? 'rotate(180deg)' : undefined }} />
              </button>
              <AnimatePresence initial={false}>
                {on && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 px-5 pb-5 sm:px-6">{t.body}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </Panel>
    </SettingsScreen>
  )
}
