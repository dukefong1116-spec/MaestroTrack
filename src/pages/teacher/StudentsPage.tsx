import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, Search, ChevronRight } from 'lucide-react'
import { useTeacherStore } from '@/stores/teacherStore'
import { useMembers, useAllLessons, useStudioSettings, type Member } from '@/hooks/useStudioData'
import { useOpenMessages } from '@/hooks/useTeacherMessages'
import { getAnalyticsSummary } from '@/lib/utils/analytics'
import { hasOwnLength, hasOwnPrice, lessonMinutes, lessonPriceCents } from '@/lib/studio/settings'
import { clock, money } from '@/lib/studio/dates'
import AddStudentSheet from '@/components/teacher/AddStudentSheet'
import WaitingToJoin from '@/components/teacher/WaitingToJoin'
import { StudioPage, Segmented, Pill, Btn, Avatar, Empty } from '@/components/teacher/studio/ui'
import { colorFor, inputStyle } from '@/components/teacher/studio/tokens'

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function StudentsPage() {
  const navigate = useNavigate()
  const members = useMembers()
  const lessons = useAllLessons()
  const settings = useStudioSettings()
  const sessions = useTeacherStore((s) => s.studentSessions)
  const families = useTeacherStore((s) => s.families)
  const requests = useTeacherStore((s) => s.requests)
  const openMessages = useOpenMessages()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'app' | 'none'>('all')
  const [adding, setAdding] = useState(false)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return members
      .filter((m) => (filter === 'all' || (filter === 'app' ? m.onApp : !m.onApp)))
      .filter((m) => !q || m.name.toLowerCase().includes(q) || (m.instrument ?? '').toLowerCase().includes(q))
      .map((m) => {
        const weekly = lessons.find((l) => l.rosterIds.includes(m.id) && l.rosterIds.length === 1)
        const week = m.uid ? getAnalyticsSummary(sessions[m.uid] ?? [], m.profile?.weeklyGoalMinutes ?? 300).totalMinutesThisWeek : null
        return {
          m,
          family: families.find((f) => f.id === m.roster.familyId)?.name ?? '—',
          lesson: weekly ? `${DAY[weekly.dayOfWeek]} ${clock(weekly.startTime)}${weekly.where ? ` · ${weekly.where}` : ''}` : 'Not scheduled',
          // The weekly lesson's real length; the student's own (or the
          // default) when they have none yet.
          minutes: weekly?.durationMinutes ?? lessonMinutes(m.roster, settings),
          ownLength: hasOwnLength(m.roster) || (!!weekly && weekly.durationMinutes !== settings.defaultLessonMinutes),
          price: lessonPriceCents(m.roster, settings),
          ownPrice: hasOwnPrice(m.roster),
          week,
        }
      })
  }, [members, lessons, sessions, families, settings, search, filter])

  const open = (m: Member) => navigate(`/teacher/students/${encodeURIComponent(m.id)}`)

  return (
    <StudioPage
      title="Students"
      subtitle={`${members.length} student${members.length === 1 ? '' : 's'}${requests.length ? ` · ${requests.length} waiting to join` : ''}`}
      actions={<Btn kind="primary" onClick={() => setAdding(true)}>+ Add student</Btn>}
    >
      <WaitingToJoin />
      <div className="flex flex-wrap items-center gap-2.5 px-5 py-3 sm:px-6" style={{ borderBottom: '1px solid var(--clay-line)' }}>
        <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-[10px] px-3" style={inputStyle}>
          <Search size={16} style={{ color: 'var(--clay-dim)' }} aria-hidden="true" />
          <input type="search" aria-label="Search students" placeholder="Search students" value={search} onChange={(e) => setSearch(e.target.value)} className="min-h-[38px] flex-1 border-0 bg-transparent text-[14px] outline-none" />
        </label>
        <Segmented label="Show" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'app', label: 'On the app' }, { value: 'none', label: 'Not on the app' }]} />
      </div>

      {rows.length === 0 ? (
        <Empty>{members.length ? 'Nobody matches.' : 'No students yet. Add one with the button above — an invitation, or a record for someone not on the app.'}</Empty>
      ) : (
        <>
          {/* Phone: one row each. */}
          <div className="md:hidden">
            {rows.map((r) => (
              <button key={r.m.id} type="button" onClick={() => open(r.m)} className="flex w-full items-center gap-3 px-4 py-3 text-left" style={{ borderTop: '1px solid var(--clay-line)' }}>
                <Avatar name={r.m.name} color={colorFor(r.m.id)} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold" style={{ color: 'var(--clay-ink)' }}>{r.m.name}</span>
                  <span className="block truncate text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>{r.m.instrument ?? '—'} · {r.lesson} · {r.minutes} min</span>
                </span>
                {!r.m.onApp && <Pill>No app</Pill>}
                <ChevronRight size={16} style={{ color: 'var(--clay-faint)' }} aria-hidden="true" />
              </button>
            ))}
          </div>
          {/* Wider: a table. */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="text-[12px]" style={{ color: 'var(--clay-dim)', background: '#FBFAFE' }}>
                  <th className="px-6 py-2 font-semibold">Student</th>
                  <th className="px-2 py-2 font-semibold">Family</th>
                  <th className="px-2 py-2 font-semibold">Weekly lesson</th>
                  <th className="px-2 py-2 font-semibold">Length</th>
                  <th className="px-2 py-2 font-semibold">Price</th>
                  <th className="px-2 py-2 font-semibold">Practice this week</th>
                  <th className="px-2 py-2 font-semibold">App</th>
                  <th className="px-6 py-2"><span className="sr-only">Message</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.m.id} className="text-[13.5px]" style={{ borderTop: '1px solid var(--clay-line)', color: '#4F4766' }}>
                    <td className="px-6 py-2.5">
                      <button type="button" onClick={() => open(r.m)} className="flex items-center gap-3 text-left">
                        <Avatar name={r.m.name} color={colorFor(r.m.id)} size={36} />
                        <span>
                          <span className="block font-bold" style={{ color: 'var(--clay-ink)' }}>{r.m.name}</span>
                          <span className="block text-[12px] capitalize" style={{ color: 'var(--clay-dim)' }}>{r.m.instrument ?? '—'}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-2 py-2.5">{r.family}</td>
                    <td className="px-2 py-2.5">{r.lesson}</td>
                    <td className="whitespace-nowrap px-2 py-2.5">{r.minutes} min {r.ownLength && <Pill tone="purple">Own length</Pill>}</td>
                    <td className="whitespace-nowrap px-2 py-2.5">{money(r.price)}{r.ownPrice ? ' · own price' : ''}</td>
                    <td className="px-2 py-2.5">{r.week == null ? '—' : `${r.week} min`}</td>
                    <td className="px-2 py-2.5">{r.m.onApp ? <Pill tone="success">On the app</Pill> : <Pill>Not on the app</Pill>}</td>
                    <td className="px-6 py-2.5 text-right">
                      {r.m.onApp && (
                        <button type="button" onClick={() => openMessages(r.m.uid)} aria-label={`Message ${r.m.name}`} className="inline-flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: 'var(--clay-accent-soft)', color: '#C2452B' }}>
                          <MessageCircle size={17} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <AddStudentSheet open={adding} onClose={() => setAdding(false)} onAdded={(id) => navigate(`/teacher/students/${encodeURIComponent(id)}`)} />
    </StudioPage>
  )
}
