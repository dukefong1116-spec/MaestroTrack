import { useState } from 'react'
import { useTeacherStore } from '@/stores/teacherStore'
import { useCalendar, useStudioSettings, type Member } from '@/hooks/useStudioData'
import { addDays, clock, dayKey, parseDay } from '@/lib/studio/dates'
import { tagFor } from '@/lib/studio/settings'
import type { CalendarItem } from '@/lib/studio/calendar'
import LessonSheet from '@/components/teacher/LessonSheet'
import { ATTENDANCE } from '@/lib/studio/labels'
import { Pill, Empty } from '@/components/teacher/studio/ui'

/** Every lesson with this student — the next few, then the past — with attendance and notes. */
export default function Lessons({ m }: { m: Member }) {
  const settings = useStudioSettings()
  const notes = useTeacherStore((s) => s.notes)
  const today = dayKey(new Date())
  const items = useCalendar(addDays(today, -180), addDays(today, 21)).filter((i) => i.rosterIds.includes(m.id))
  const [open, setOpen] = useState<CalendarItem | null>(null)
  const upcoming = items.filter((i) => i.date >= today).slice(0, 3)
  const past = items.filter((i) => i.date < today).reverse()
  const first = m.name.split(' ')[0]

  const row = (it: CalendarItem) => {
    const mark = ATTENDANCE.find((a) => a.value === it.attendance[m.id])
    const mine = notes.filter((n) => n.occurrenceId === it.key && n.rosterId === m.id)
    const shared = mine.find((n) => n.visibility === 'shared')
    const priv = mine.find((n) => n.visibility === 'private')
    const carried = it.carried.filter((c) => c.state === 'carried')
    return (
      <button key={it.key} type="button" onClick={() => setOpen(it)} className="block w-full px-5 py-3.5 text-left hover:bg-[#FBFAFE] sm:px-6" style={{ borderBottom: '1px solid var(--clay-line)' }}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="h-3 w-3 rounded" style={{ background: tagFor(settings.tags, it.tagId).color }} aria-hidden="true" />
          <strong className="text-[14px]" style={{ color: 'var(--clay-ink)' }}>{parseDay(it.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {clock(it.startTime)}</strong>
          <span className="text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>{it.durationMinutes} min{it.rosterIds.length > 1 ? ` · ${it.title}` : ''}{it.makeupFor ? ' · make-up' : ''}</span>
          {it.cancelled ? <Pill>No lesson</Pill> : mark ? <Pill tone={mark.tone}>{mark.label}</Pill> : it.date < today ? <Pill tone="accent">Attendance not recorded</Pill> : null}
        </div>
        {shared && <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: '#4F4766' }}><span style={{ color: 'var(--clay-dim)' }}>Shared with {first}:</span> {shared.text}</p>}
        {priv && <p className="mt-0.5 text-[13.5px] leading-relaxed" style={{ color: '#4F4766' }}><span style={{ color: 'var(--clay-dim)' }}>Private:</span> {priv.text}</p>}
        {carried.length > 0 && <p className="mt-1 text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>Carried to the next lesson: {carried.map((c) => c.text).join('; ')}</p>}
      </button>
    )
  }

  return (
    <div>
      {upcoming.length > 0 && <p className="px-5 pb-1 pt-3 text-[12px] font-bold uppercase tracking-wide sm:px-6" style={{ color: 'var(--clay-dim)' }}>Coming up</p>}
      {upcoming.map(row)}
      <p className="px-5 pb-1 pt-3 text-[12px] font-bold uppercase tracking-wide sm:px-6" style={{ color: 'var(--clay-dim)' }}>Past lessons</p>
      {past.length ? past.map(row) : <Empty>No lessons yet.</Empty>}
      <LessonSheet item={open} onClose={() => setOpen(null)} />
    </div>
  )
}
