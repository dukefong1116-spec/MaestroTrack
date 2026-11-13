import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { useMembers } from '@/hooks/useStudioData'
import { useOpenMessages } from '@/hooks/useTeacherMessages'
import { subscribePracticeSummary } from '@/lib/firebase/summary'
import { subscribeSharedRecordings, recordingAudio } from '@/lib/firebase/recordings'
import { removeStudentFromStudio } from '@/lib/firebase/teacher'
import { updateRosterStudent } from '@/lib/firebase/studio'
import { sessionsFromSummary } from '@/lib/utils/summary'
import { takeLabel, takeNamesByDay } from '@/lib/utils/takeNames'
import ProfileAvatar from '@/components/profile/Avatar'
import ReviewSheet from '@/components/assignments/ReviewSheet'
import InviteSheet from '@/components/teacher/InviteSheet'
import TakePlayer from '@/components/recordings/TakePlayer'
import { StudioPage, Btn, Pill, Avatar, Empty } from '@/components/teacher/studio/ui'
import { colorFor } from '@/components/teacher/studio/tokens'
import Overview from './record/Overview'
import Lessons from './record/Lessons'
import Assignments from './record/Assignments'
import Repertoire from './record/Repertoire'
import Practice from './record/Practice'
import Report from './record/Report'
import type { Assignment, PracticeSummary, Recording } from '@/types'

const TABS = [
  ['overview', 'Overview'], ['lessons', 'Lessons & notes'], ['assignments', 'Assignments'], ['repertoire', 'Repertoire'],
  ['practice', 'Practice'], ['recordings', 'Recordings'], ['report', 'Report'],
] as const
type Tab = typeof TABS[number][0]

/**
 * One student, everything about them: who they are and their lesson,
 * the lessons and notes, their work, repertoire, practice, recordings,
 * and a progress report. Found by their studio record or, for links made
 * before studio records existed, by their account.
 */
export default function StudentDetailPage() {
  const { studentId = '' } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const members = useMembers()
  const assignments = useTeacherStore((s) => s.assignments)
  const families = useTeacherStore((s) => s.families)
  const setStudentSessions = useTeacherStore((s) => s.setStudentSessions)
  const openMessages = useOpenMessages()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find(([t]) => t === params.get('tab'))?.[0] ?? 'overview') as Tab
  const m = members.find((x) => x.id === studentId || x.uid === studentId)
  const sessions = useTeacherStore((s) => (m?.uid ? s.studentSessions[m.uid] : undefined)) ?? NONE
  const [summary, setSummary] = useState<PracticeSummary | null | undefined>(undefined)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [reviewing, setReviewing] = useState<Assignment | null>(null)
  const [inviting, setInviting] = useState(false)
  const uid = m?.uid ?? null

  useEffect(() => {
    if (!uid) { setSummary(null); return }
    return subscribePracticeSummary(uid, (s) => { setSummary(s); setStudentSessions(uid, sessionsFromSummary(s)) })
  }, [uid, setStudentSessions])
  useEffect(() => {
    if (!uid) { setRecordings([]); return }
    return subscribeSharedRecordings(uid, setRecordings)
  }, [uid])

  // Opened from the bell: straight to the review.
  const wanted = params.get('review')
  useEffect(() => {
    if (!wanted) return
    const found = assignments.find((a) => a.id === wanted)
    if (!found) return
    setReviewing(found)
    const next = new URLSearchParams(params)
    next.delete('review')
    setParams(next, { replace: true })
  }, [wanted, assignments, params, setParams])

  const takeNames = useMemo(() => takeNamesByDay(recordings), [recordings])

  if (!m) {
    return (
      <StudioPage title="Student" back={{ to: '/teacher/students', label: 'All students' }}>
        <Empty>{members.length ? 'This student isn’t in your studio.' : 'Loading…'}</Empty>
      </StudioPage>
    )
  }

  const family = families.find((f) => f.id === m.roster.familyId)
  const emails = [m.roster.email, ...(family?.contacts ?? []).map((c) => c.email)].filter((e): e is string => !!e)
  const first = m.name.split(' ')[0]

  async function remove() {
    if (!m || !window.confirm(`Remove ${m.name} from your studio?${m.onApp ? ' They keep their own practice; they just leave your studio.' : ''}`)) return
    if (m.uid && m.profile?.teacherId === profile?.uid) await removeStudentFromStudio(m.uid)
    if (m.roster.createdAt) await updateRosterStudent(m.id, { status: 'left' }).catch(() => {})
    navigate('/teacher/students')
  }

  return (
    <StudioPage
      back={{ to: '/teacher/students', label: 'All students' }}
      title={
        <span className="flex items-center gap-3">
          {m.profile?.avatar
            ? <ProfileAvatar src={m.profile.avatar} name={m.name} size={44} />
            : <Avatar name={m.name} color={colorFor(m.id)} size={44} />}
          <span className="min-w-0 truncate">{m.name}</span>
          {m.onApp ? <Pill tone="success">On the app</Pill> : <Pill>Not on the app</Pill>}
        </span>
      }
      subtitle={`${m.instrument ? `${m.instrument} · ` : ''}${family?.name ?? 'Not in a family'}${m.profile?.experienceLevel ? ` · ${m.profile.experienceLevel}` : ''}`}
      actions={
        <>
          {!m.onApp && <Btn kind="primary" onClick={() => setInviting(true)}>Invite to the app</Btn>}
          {m.onApp
            ? <Btn kind="quiet" onClick={() => openMessages(m.uid)}>Message</Btn>
            : emails.length > 0 && <a className="inline-flex min-h-[36px] items-center rounded-[10px] px-3.5 text-[13.5px] font-bold" style={{ background: 'var(--clay-accent-soft)', color: '#C2452B' }} href={`mailto:${encodeURIComponent(emails.join(','))}?subject=${encodeURIComponent(`${first}’s lessons`)}`}>Email family</a>}
          <Btn kind="link" onClick={remove}>Remove</Btn>
        </>
      }
    >
      <div role="tablist" aria-label="Student record" className="no-scrollbar flex gap-0.5 overflow-x-auto px-3 sm:px-4" style={{ borderBottom: '1px solid var(--clay-line)' }}>
        {TABS.map(([id, label]) => {
          const on = tab === id
          return (
            <button key={id} type="button" role="tab" aria-selected={on} onClick={() => setParams({ tab: id }, { replace: true })}
              className="-mb-px shrink-0 whitespace-nowrap px-3 py-3 text-[13.5px]"
              style={{ color: on ? 'var(--clay-ink)' : 'var(--clay-dim)', fontWeight: on ? 700 : 600, borderBottom: `2px solid ${on ? 'var(--clay-accent)' : 'transparent'}` }}>
              {label}
            </button>
          )
        })}
      </div>

      {tab === 'overview' && <Overview m={m} />}
      {tab === 'lessons' && <Lessons m={m} />}
      {tab === 'assignments' && <Assignments m={m} sessions={sessions} onReview={setReviewing} />}
      {tab === 'repertoire' && <Repertoire m={m} />}
      {tab === 'practice' && <Practice m={m} sessions={sessions} summary={summary} />}
      {tab === 'recordings' && (
        recordings.length === 0
          ? <Empty>{m.onApp ? `${first} hasn’t handed in any recordings yet.` : `${first} isn’t on the app, so there are no recordings.`}</Empty>
          : (
            <div>
              {[...recordings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((r, i) => (
                <div key={r.id} className="px-5 py-3 sm:px-6" style={{ borderBottom: '1px solid var(--clay-line)' }}>
                  <p className="mb-1.5 text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>{format(parseISO(r.createdAt), 'EEE, MMM d · h:mm a')}{r.pieceName ? ` · ${r.pieceName}` : ''}</p>
                  <TakePlayer load={() => recordingAudio(r)} label={r.title?.trim() || takeNames.get(r.id) || takeLabel(r.date, i + 1)} storedDuration={r.duration} />
                </div>
              ))}
            </div>
          )
      )}
      {tab === 'report' && <Report m={m} sessions={sessions} studio={profile?.studioName || profile?.displayName || ''} />}

      <ReviewSheet assignment={reviewing} studentName={m.name} recordings={recordings} open={!!reviewing} onClose={() => setReviewing(null)} />
      {profile && <InviteSheet open={inviting} onClose={() => setInviting(false)} profile={profile} />}
    </StudioPage>
  )
}

const NONE: never[] = []
