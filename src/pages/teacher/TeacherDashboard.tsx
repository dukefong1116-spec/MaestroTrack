import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { MessageCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { useMembers, useStudioSettings, useCalendar, saveItem } from '@/hooks/useStudioData'
import { useOpenMessages, useUnreadThreads } from '@/hooks/useTeacherMessages'
import { needsReview, awaitingStudent, dueness } from '@/lib/utils/assignments'
import { getAnalyticsSummary } from '@/lib/utils/analytics'
import { creditsFor, balanceCents } from '@/lib/studio/billing'
import { endTime, type CalendarItem } from '@/lib/studio/calendar'
import { addDays, clock, dayKey, money, parseDay } from '@/lib/studio/dates'
import { tagFor } from '@/lib/studio/settings'
import NotificationBell from '@/components/notifications/NotificationBell'
import LessonSheet from '@/components/teacher/LessonSheet'
import { ATTENDANCE } from '@/lib/studio/labels'
import { StudioPage, Btn, Avatar } from '@/components/teacher/studio/ui'
import { colorFor, toneColors } from '@/components/teacher/studio/tokens'
import type { AttendanceMark } from '@/types'

/** "Ms Harper" stays whole; "Laura Harper" is Laura. */
function callName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/)
  return /^(mr|mrs|ms|miss|mx|dr|prof)\.?$/i.test(first) && rest.length ? name.trim() : first
}

function greeting(d: Date) {
  const h = d.getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function TeacherDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const openMessages = useOpenMessages()
  const unread = useUnreadThreads()
  const members = useMembers()
  const settings = useStudioSettings()
  const assignments = useTeacherStore((s) => s.assignments)
  const sessions = useTeacherStore((s) => s.studentSessions)
  const invoices = useTeacherStore((s) => s.invoices)
  const notes = useTeacherStore((s) => s.notes)
  const requests = useTeacherStore((s) => s.requests)
  const now = new Date()
  const today = dayKey(now)
  const items = useCalendar(addDays(today, -(settings.policy.creditExpiryDays ?? 120)), addDays(today, 7))
  const todays = items.filter((i) => i.date === today && !i.cancelled)
  const [open, setOpen] = useState<CalendarItem | null>(null)

  const toReview = assignments.filter(needsReview)
  const outstanding = invoices.reduce((a, i) => a + balanceCents(i), 0)
  const weekMinutes = useMemo(() => members.reduce((a, m) => a + (m.uid ? getAnalyticsSummary(sessions[m.uid] ?? [], 300).totalMinutesThisWeek : 0), 0), [members, sessions])
  const recorded = todays.filter((i) => i.rosterIds.length && i.rosterIds.every((r) => i.attendance[r])).length
  const nameOf = (uidOrRoster: string) => members.find((m) => m.uid === uidOrRoster || m.id === uidOrRoster)?.name ?? 'Student'

  const owed = members.filter((m) => creditsFor(m.id, items, settings, m.roster.creditAdjust ?? 0, today) > 0)
  const overdue = assignments.filter((a) => awaitingStudent(a) && dueness(a) === 'overdue')
  const quiet = members.filter((m) => {
    if (!m.uid) return false
    const s = sessions[m.uid] ?? []
    return s.length > 0 && !s.some((x) => x.date.slice(0, 10) >= addDays(today, -5))
  })
  const attention: { head: string; text: string; color: string; go: () => void }[] = [
    ...(requests.length ? [{ head: `${requests.length} waiting to join`, text: requests.map((r) => r.studentName).join(', '), color: '#E05539', go: () => navigate('/teacher/students') }] : []),
    ...(toReview.length ? [{ head: `${toReview.length} assignment${toReview.length === 1 ? '' : 's'} to review`, text: [...new Set(toReview.map((a) => nameOf(a.studentId || a.rosterId || '')))].join(', '), color: '#7A5AC4', go: () => navigate('/teacher/review') }] : []),
    ...(owed.length ? [{ head: `Make-up${owed.length === 1 ? '' : 's'} to book`, text: owed.map((m) => m.name).join(', '), color: '#2E8B62', go: () => navigate('/teacher/calendar') }] : []),
    ...overdue.slice(0, 3).map((a) => ({ head: 'Assignment overdue', text: `${nameOf(a.studentId || a.rosterId || '')} · ${a.title}`, color: '#D64257', go: () => navigate(`/teacher/students/${encodeURIComponent(a.rosterId ?? a.studentId)}?tab=assignments`) })),
    ...quiet.slice(0, 3).map((m) => ({ head: 'Gone quiet', text: `${m.name} hasn’t practised in 5 days`, color: '#C98A12', go: () => navigate(`/teacher/students/${encodeURIComponent(m.id)}?tab=practice`) })),
    ...[...unread].slice(0, 3).map((uid) => ({ head: `Message from ${nameOf(uid).split(' ')[0]}`, text: 'Unread', color: '#3B7DD8', go: () => openMessages(uid) })),
  ]

  const recent = useMemo(() => members.flatMap((m) => {
    if (!m.uid) return []
    const byDay = new Map<string, number>()
    for (const s of sessions[m.uid] ?? []) byDay.set(s.date.slice(0, 10), (byDay.get(s.date.slice(0, 10)) ?? 0) + s.durationMinutes)
    return [...byDay].filter(([d]) => d >= addDays(today, -3)).map(([d, mins]) => ({ m, d, mins }))
  }).sort((a, b) => b.d.localeCompare(a.d)).slice(0, 6), [members, sessions, today])
  const dueSoon = assignments.filter((a) => awaitingStudent(a) && a.dueDate && a.dueDate.slice(0, 10) >= today && a.dueDate.slice(0, 10) <= addDays(today, 7)).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')).slice(0, 5)
  const recentNotes = [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3)

  async function setMark(item: CalendarItem, rosterId: string, v: string) {
    if (!profile) return
    const attendance = { ...item.attendance }
    if (v) attendance[rosterId] = v as AttendanceMark
    else delete attendance[rosterId]
    await saveItem(profile.uid, item, { attendance }).catch((e) => console.error('[Dashboard] attendance', e))
  }
  async function allPresent() {
    if (!profile) return
    for (const i of todays) {
      if (!i.rosterIds.length || i.rosterIds.every((r) => i.attendance[r])) continue
      const attendance = { ...i.attendance }
      for (const r of i.rosterIds) attendance[r] ??= 'present'
      await saveItem(profile.uid, i, { attendance }).catch(() => {})
    }
  }

  const stat = (glyph: string, bg: string, fg: string, value: string, label: string, go?: () => void) => (
    <button type="button" onClick={go} className="flex items-center gap-3.5 px-5 py-4 text-left sm:px-6" style={{ boxShadow: '-1px 0 0 var(--clay-line), 0 -1px 0 var(--clay-line)' }}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[17px] font-extrabold" style={{ background: bg, color: fg }} aria-hidden="true">{glyph}</span>
      <span className="min-w-0"><span className="block text-[19px] font-bold leading-tight" style={{ color: 'var(--clay-ink)' }}>{value}</span><span className="block text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>{label}</span></span>
    </button>
  )

  return (
    <StudioPage
      title={`${greeting(now)}${profile?.displayName ? `, ${callName(profile.displayName)}` : ''}`}
      subtitle={`${format(now, 'EEEE, MMMM d')} · ${todays.length} lesson${todays.length === 1 ? '' : 's'} today`}
      actions={
        <div className="flex items-center gap-2 lg:hidden">
          <button type="button" onClick={() => openMessages(null)} aria-label={`Messages${unread.size ? `, ${unread.size} unread` : ''}`} className="relative flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}>
            <MessageCircle size={19} />
            {unread.size > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10.5px] font-bold text-white" style={{ background: 'var(--clay-accent-ink)' }}>{unread.size}</span>}
          </button>
          <NotificationBell floating />
        </div>
      }
    >
      <div className="grid grid-cols-2 xl:grid-cols-4" style={{ borderBottom: '1px solid var(--clay-line)' }}>
        {stat('♪', 'var(--clay-accent-soft)', '#C2452B', `${todays.length} lesson${todays.length === 1 ? '' : 's'}`, `today · ${recorded} of ${todays.length} recorded`, () => navigate('/teacher/calendar'))}
        {stat('✓', 'var(--clay-purple-bg)', '#5B3FA8', `${toReview.length}`, 'to review', () => navigate('/teacher/review'))}
        {stat('↑', 'var(--clay-success-bg)', '#1F6B4A', `${weekMinutes} min`, 'studio practice this week')}
        {stat('$', 'var(--clay-warning-bg)', '#7A4F05', money(outstanding), 'outstanding', () => navigate('/teacher/families'))}
      </div>

      <div className="flex flex-wrap">
        <div className="min-w-0 flex-[999_1_520px]" style={{ boxShadow: '1px 0 0 var(--clay-line)' }}>
          <div className="flex items-center gap-2 px-5 pb-2 pt-4 sm:px-6">
            <h2 className="flex-1 text-[15px] font-bold" style={{ color: 'var(--clay-ink)' }}>Today’s lessons</h2>
            {todays.some((i) => i.rosterIds.length && !i.rosterIds.every((r) => i.attendance[r])) && <Btn kind="soft" onClick={allPresent}>Mark all present</Btn>}
          </div>
          {todays.length === 0 && <p className="px-6 pb-4 text-[14px]" style={{ color: 'var(--clay-dim)' }}>No lessons today. <button type="button" className="font-semibold" style={{ color: 'var(--clay-accent-ink)' }} onClick={() => navigate('/teacher/calendar')}>Open the calendar</button></p>}
          {todays.map((i) => {
            const tag = tagFor(settings.tags, i.tagId)
            const solo = i.rosterIds.length === 1 ? i.rosterIds[0] : null
            const mark = solo ? ATTENDANCE.find((a) => a.value === i.attendance[solo]) : undefined
            const [bg, fg] = mark ? toneColors(mark.tone) : ['var(--clay-bg)', 'var(--clay-ink)']
            const noted = notes.some((n) => n.occurrenceId === i.key)
            return (
              <div key={i.key} className="flex flex-wrap items-center gap-3 px-5 py-2.5 sm:px-6" style={{ borderTop: '1px solid var(--clay-line)' }}>
                <div className="w-[66px] shrink-0"><div className="text-[14px] font-bold" style={{ color: 'var(--clay-ink)' }}>{clock(i.startTime)}</div><div className="text-[12px]" style={{ color: 'var(--clay-dim)' }}>{i.durationMinutes} min</div></div>
                <span className="w-1 self-stretch rounded" style={{ background: tag.color, minHeight: 36 }} aria-hidden="true" />
                <div className="min-w-[150px] flex-1">
                  <button type="button" className="text-left text-[14.5px] font-bold" style={{ color: 'var(--clay-ink)' }} onClick={() => solo ? navigate(`/teacher/students/${encodeURIComponent(solo)}`) : setOpen(i)}>{i.title}</button>
                  <div className="text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>{tag.name}{i.where ? ` · ${i.where}` : ''} · until {clock(endTime(i))}</div>
                </div>
                {solo && (
                  <select aria-label={`Attendance for ${i.title}`} value={i.attendance[solo] ?? ''} onChange={(e) => void setMark(i, solo, e.target.value)}
                    className="min-h-[36px] rounded-[9px] border-0 px-2.5 text-[13px] font-bold" style={{ background: bg, color: fg }}>
                    <option value="">Attendance…</option>
                    {ATTENDANCE.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                )}
                <Btn kind={noted ? 'soft' : 'quiet'} onClick={() => setOpen(i)}>{noted ? 'Notes ✓' : 'Open lesson'}</Btn>
              </div>
            )
          })}

          <h2 className="px-5 pb-2 pt-5 text-[15px] font-bold sm:px-6" style={{ color: 'var(--clay-ink)', borderTop: '1px solid var(--clay-line)' }}>Recent practice</h2>
          {recent.length === 0 && <p className="px-6 pb-4 text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>Nothing in the last few days.</p>}
          {recent.map(({ m, d, mins }) => (
            <button key={`${m.id}${d}`} type="button" onClick={() => navigate(`/teacher/students/${encodeURIComponent(m.id)}?tab=practice`)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left sm:px-6" style={{ borderTop: '1px solid var(--clay-line)' }}>
              <Avatar name={m.name} color={colorFor(m.id)} size={30} />
              <span className="flex-1 text-[13.5px]"><strong style={{ color: 'var(--clay-ink)' }}>{m.name}</strong><span style={{ color: 'var(--clay-dim)' }}> · {mins} min</span></span>
              <span className="text-[12px]" style={{ color: 'var(--clay-dim)' }}>{d === today ? 'Today' : d === addDays(today, -1) ? 'Yesterday' : parseDay(d).toLocaleDateString('en-US', { weekday: 'short' })}</span>
            </button>
          ))}
        </div>

        <div className="min-w-0 flex-[1_1_320px]">
          <h2 className="px-5 pb-2 pt-4 text-[15px] font-bold sm:px-6" style={{ color: 'var(--clay-ink)' }}>Needs attention</h2>
          {attention.length === 0 && <p className="px-6 pb-4 text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>All caught up.</p>}
          {attention.map((a, i) => (
            <button key={i} type="button" onClick={a.go} className="flex w-full items-center gap-3 px-5 py-2.5 text-left sm:px-6" style={{ borderTop: '1px solid var(--clay-line)' }}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.color }} aria-hidden="true" />
              <span className="flex-1 text-[13.5px] leading-snug"><strong style={{ color: 'var(--clay-ink)' }}>{a.head}</strong><span className="block text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>{a.text}</span></span>
              <span style={{ color: 'var(--clay-dim)' }} aria-hidden="true">›</span>
            </button>
          ))}
          <h2 className="px-5 pb-2 pt-5 text-[15px] font-bold sm:px-6" style={{ color: 'var(--clay-ink)', borderTop: '1px solid var(--clay-line)' }}>Due this week</h2>
          {dueSoon.length === 0 && <p className="px-6 pb-4 text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>Nothing due.</p>}
          {dueSoon.map((a) => (
            <div key={a.id} className="px-5 py-2.5 sm:px-6" style={{ borderTop: '1px solid var(--clay-line)' }}>
              <div className="flex justify-between gap-2"><span className="text-[13.5px] font-semibold" style={{ color: 'var(--clay-ink)' }}>{a.title}</span><span className="whitespace-nowrap text-[12px]" style={{ color: 'var(--clay-dim)' }}>{format(parseISO(a.dueDate as string), 'EEE')}</span></div>
              <div className="text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>{nameOf(a.studentId || a.rosterId || '')}</div>
            </div>
          ))}
          <h2 className="px-5 pb-2 pt-5 text-[15px] font-bold sm:px-6" style={{ color: 'var(--clay-ink)', borderTop: '1px solid var(--clay-line)' }}>Recent lesson notes</h2>
          {recentNotes.length === 0 && <p className="px-6 pb-4 text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>Notes you write in a lesson appear here.</p>}
          {recentNotes.map((n) => (
            <div key={n.id} className="px-5 py-2.5 text-[13px] sm:px-6" style={{ borderTop: '1px solid var(--clay-line)' }}>
              <div className="font-bold" style={{ color: 'var(--clay-ink)' }}>{nameOf(n.rosterId)} <span className="font-normal" style={{ color: 'var(--clay-dim)' }}>· {parseDay(n.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}{n.visibility === 'private' ? ' · private' : ''}</span></div>
              <div className="mt-0.5 leading-relaxed" style={{ color: '#4F4766' }}>{n.text}</div>
            </div>
          ))}
        </div>
      </div>
      <LessonSheet item={open} onClose={() => setOpen(null)} />
    </StudioPage>
  )
}
