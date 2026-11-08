import { useMemo, useState } from 'react'
import { UserPlus } from 'lucide-react'
import Sticker from '@/components/stickers/Sticker'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { getAnalyticsSummary } from '@/lib/utils/analytics'
import StreakFlame from '@/components/icons/StreakFlame'
import PageHeader from '@/components/common/PageHeader'
import NotificationBell from '@/components/notifications/NotificationBell'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import StatCard from '@/components/common/StatCard'
import SubmissionsWaiting from '@/components/assignments/SubmissionsWaiting'
import PendingRequests from '@/components/teacher/PendingRequests'
import InviteSheet from '@/components/teacher/InviteSheet'
import EmptyState from '@/components/common/EmptyState'
import Avatar from '@/components/profile/Avatar'
import type { UserProfile, InstrumentType } from '@/types'

function StudentRow({ student, sessions, onClick }: { student: UserProfile; sessions: ReturnType<typeof getAnalyticsSummary>; onClick: () => void }) {
  return (
    <Card hover className="p-4 flex items-center justify-between gap-4" onClick={onClick}>
      <div className="flex items-center gap-3 min-w-0">
        <Avatar
          src={student.avatar}
          name={student.displayName ?? student.email}
          instrument={student.instrument as InstrumentType | undefined}
          size={36}
          className="shrink-0"
        />
        <div className="min-w-0">
          <p className="font-semibold text-[var(--clay-ink)] text-sm truncate">{student.displayName}</p>
          <p className="text-xs text-[var(--clay-dim)]">{student.instrument ?? 'Unknown'} · {student.experienceLevel ?? '—'}</p>
        </div>
      </div>
      <div className="flex items-center gap-6 text-xs text-[var(--clay-dim)] shrink-0">
        <div className="text-center hidden sm:block">
          <p className="text-[var(--clay-ink)] font-semibold">{sessions.totalMinutesThisWeek}</p>
          <p>min/wk</p>
        </div>
        <div className="text-center hidden sm:block">
          <p className="text-[var(--clay-ink)] font-semibold">{sessions.consistencyScore}%</p>
          <p>consistency</p>
        </div>
        <div className="text-center hidden sm:block">
          <p className="text-[var(--clay-ink)] font-semibold">{sessions.weeklyGoalPercentage}%</p>
          <p>goal</p>
        </div>
        <Badge variant={sessions.currentStreak >= 7 ? 'success' : sessions.currentStreak >= 3 ? 'warning' : 'default'} size="sm">
          <StreakFlame streak={sessions.currentStreak} size={15} /> {sessions.currentStreak}d
        </Badge>
      </div>
    </Card>
  )
}

export default function TeacherDashboard() {
  const { profile } = useAuth()
  const { students, studentSessions } = useTeacherStore()
  const navigate = useNavigate()
  const [inviting, setInviting] = useState(false)

  const summaries = useMemo(() =>
    Object.fromEntries(students.map((s) => [
      s.uid,
      getAnalyticsSummary(studentSessions[s.uid] ?? [], s.weeklyGoalMinutes ?? 300)
    ])),
    [students, studentSessions]
  )

  const totalWeekMinutes = useMemo(() =>
    Object.values(summaries).reduce((a, s) => a + s.totalMinutesThisWeek, 0),
    [summaries]
  )
  const avgConsistency = useMemo(() => {
    const vals = Object.values(summaries)
    return vals.length ? Math.round(vals.reduce((a, s) => a + s.consistencyScore, 0) / vals.length) : 0
  }, [summaries])
  const studentsOnStreak = useMemo(() =>
    Object.values(summaries).filter((s) => s.currentStreak >= 3).length,
    [summaries]
  )

  return (
    <div>
      <PageHeader
        title={`${profile?.studioName ?? 'My Studio'}`}
        subtitle="Manage your students and monitor their progress."
        // The bell sits on the one screen notifications point at, inside
        // the header so it scrolls away. The sidebar carries it from lg up.
        actions={<div className="lg:hidden"><NotificationBell floating /></div>}
      />

      {/* Inviting somebody is an act, not a code sitting on the screen
          waiting to be read over a shoulder. */}
      <Card className="p-4 mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--clay-ink)]">Add a student</p>
          <p className="text-xs text-[var(--clay-dim)]">A link, a QR code or six characters — they join once you accept.</p>
        </div>
        <button
          type="button"
          onClick={() => setInviting(true)}
          className="flex shrink-0 items-center gap-2 px-3.5 py-2 text-sm font-bold transition-transform active:scale-95"
          style={{
            background: 'var(--clay-accent)',
            color: 'var(--clay-on-accent)',
            borderRadius: 'var(--clay-r-sm)',
          }}
        >
          <UserPlus size={15} /> Invite
        </button>
      </Card>

      {profile && (
        <InviteSheet open={inviting} onClose={() => setInviting(false)} profile={profile} />
      )}

      {/* Renders nothing when nobody is waiting. */}
      <PendingRequests />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Students" value={students.length} icon={<Sticker name="users" size={16} tone="accent" />} />
        <StatCard label="Studio Minutes" value={totalWeekMinutes} subtitle="this week" icon={<Sticker name="clock" size={16} tone="accent" />} />
        <StatCard label="Avg Consistency" value={`${avgConsistency}%`} icon={<Sticker name="trend" size={16} tone="accent" />} />
        <StatCard label="On Streak" value={studentsOnStreak} subtitle="3+ days" />
      </div>

      {/* Renders nothing when nobody is waiting, so it never costs space. */}
      <SubmissionsWaiting />

      {/* Student list */}
      {students.length === 0 ? (
        <EmptyState
          icon={<Sticker name="users" size={36} tone="accent" />}
          title="No students yet"
          description="Tap Invite above to send a student a link, or show them the code in person."
        />
      ) : (
        <div>
          <p className="text-xs font-semibold text-[var(--clay-dim)] uppercase tracking-widest mb-3">Students</p>
          <div className="space-y-2">
            {students.map((student) => (
              <div key={student.uid}>
                <StudentRow
                  student={student}
                  sessions={summaries[student.uid] ?? getAnalyticsSummary([], 300)}
                  onClick={() => navigate(`/teacher/students/${student.uid}`)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
