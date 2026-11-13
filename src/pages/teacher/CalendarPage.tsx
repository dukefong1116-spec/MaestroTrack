import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { useStudioSettings, useCalendar, saveItem, updateSeries } from '@/hooks/useStudioData'
import { monthGrid, endTime, type CalendarItem } from '@/lib/studio/calendar'
import { addDays, clock, dayKey, mondayOf, parseDay, toMinutes, weekday } from '@/lib/studio/dates'
import { tagFor } from '@/lib/studio/settings'
import LessonSheet from '@/components/teacher/LessonSheet'
import { StudioPage, Segmented, Btn } from '@/components/teacher/studio/ui'
import TimeGrid, { type DragResult } from './calendar/TimeGrid'
import MonthGrid from './calendar/MonthGrid'
import TagsPanel from './calendar/TagsPanel'
import MakeupsPanel from './calendar/MakeupsPanel'
import NewLessonSheet from './calendar/NewLessonSheet'

function useWide() {
  const q = '(min-width: 768px)'
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return wide
}

/** "November 9 – 15, 2026", or "Nov 30 – Dec 6, 2026" across a month end. */
function weekTitle(monday: string) {
  const a = parseDay(monday), b = parseDay(addDays(monday, 6))
  const same = a.getMonth() === b.getMonth()
  const m = (d: Date, len: 'long' | 'short') => d.toLocaleDateString('en-US', { month: len })
  return same
    ? `${m(a, 'long')} ${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}`
    : `${m(a, 'short')} ${a.getDate()} – ${m(b, 'short')} ${b.getDate()}, ${b.getFullYear()}`
}

interface Toast { text: string; action?: { label: string; run: () => void } }

export default function CalendarPage() {
  const { profile } = useAuth()
  const settings = useStudioSettings()
  const wide = useWide()
  const lessons = useTeacherStore((s) => s.lessons)
  const occurrences = useTeacherStore((s) => s.occurrences)
  const today = dayKey(new Date())
  const [view, setView] = useState<'week' | 'month'>('week')
  const [anchor, setAnchor] = useState(today)
  const [open, setOpen] = useState<CalendarItem | null>(null)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t) }, [])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), toast.action ? 7000 : 3000); return () => clearTimeout(t) }, [toast])

  const a = parseDay(anchor)
  const monday = mondayOf(anchor)
  const grid = useMemo(() => monthGrid(a.getFullYear(), a.getMonth()), [a.getFullYear(), a.getMonth()]) // eslint-disable-line react-hooks/exhaustive-deps
  const [from, to] = view === 'month' ? [grid[0], grid[grid.length - 1]] : [monday, addDays(monday, 6)]
  const items = useCalendar(from, to)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

  // Hours shown: the settings, widened to fit anything outside them.
  const visible = view === 'week' ? items : []
  const startHour = Math.min(settings.dayStart, ...visible.map((i) => Math.floor(toMinutes(i.startTime) / 60)))
  const endHour = Math.max(settings.dayEnd, ...visible.map((i) => Math.ceil(toMinutes(endTime(i)) / 60)))

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const l of lessons) c[l.tagId] = (c[l.tagId] ?? 0) + 1
    for (const o of occurrences) c[o.tagId] = (c[o.tagId] ?? 0) + 1
    return c
  }, [lessons, occurrences])

  async function onDrop(item: CalendarItem, to: DragResult, mode: 'move' | 'resize') {
    if (!profile) return
    try {
      await saveItem(profile.uid, item, { date: to.date, startTime: to.startTime, durationMinutes: to.durationMinutes })
      const when = `${parseDay(to.date).toLocaleDateString('en-US', { weekday: 'short' })} ${clock(to.startTime)}`
      setToast({
        text: mode === 'resize' ? `${item.title}: ${to.durationMinutes} min — this week only.` : `${item.title} moved to ${when} — this week only.`,
        action: item.lessonId ? {
          label: 'Every week',
          run: () => {
            void updateSeries({ ...item }, mode === 'resize' ? { minutes: to.durationMinutes } : { dayOfWeek: weekday(to.date), startTime: to.startTime })
              .then(() => setToast({ text: `Changed for every week from ${parseDay(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} on.` }))
              .catch(() => setToast({ text: 'Could not change the weekly lesson.' }))
          },
        } : undefined,
      })
    } catch (e) {
      console.error('[Calendar] could not move the lesson', e)
      setToast({ text: 'Could not move it. Check your connection — or the studio rules may not be published yet.' })
    }
  }

  const step = (n: number) => {
    if (view === 'month') { const d = new Date(a.getFullYear(), a.getMonth() + n, 1); setAnchor(dayKey(d)) }
    else setAnchor(addDays(anchor, n * (wide ? 7 : 1)))
  }
  const title = view === 'month'
    ? a.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : wide
      ? weekTitle(monday)
      : a.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const dayItems = items.filter((i) => i.date === anchor)

  return (
    <StudioPage
      title="Calendar & Attendance"
      subtitle="Lessons, make-ups and events"
      actions={<Btn kind="primary" onClick={() => setAdding(true)}>+ Lesson or event</Btn>}
    >
      <div className="flex flex-wrap">
        <aside className="order-2 w-full lg:order-1 lg:w-[260px] lg:shrink-0" style={{ borderRight: '1px solid var(--clay-line)' }}>
          <TagsPanel counts={counts} />
          <MakeupsPanel />
        </aside>
        <div className="order-1 w-full min-w-0 lg:order-2 lg:w-auto lg:flex-1">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--clay-line)' }}>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => step(-1)} aria-label="Previous" className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}><ChevronLeft size={18} /></button>
              <button type="button" onClick={() => setAnchor(today)} className="h-9 rounded-[10px] px-3 text-[13px] font-semibold" style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}>Today</button>
              <button type="button" onClick={() => step(1)} aria-label="Next" className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}><ChevronRight size={18} /></button>
            </div>
            <h2 className="min-w-0 flex-1 truncate text-[17px] font-bold" style={{ color: 'var(--clay-ink)' }}>{title}</h2>
            <Segmented label="View" value={view} onChange={setView} options={[{ value: 'week', label: wide ? 'Week' : 'Day' }, { value: 'month', label: 'Month' }]} />
          </div>

          {view === 'week' && (
            <>
              {!wide && (
                <div className="grid grid-cols-7 gap-1 px-3 pt-3">
                  {weekDays.map((d) => {
                    const on = d === anchor
                    const n = items.filter((i) => i.date === d).length
                    return (
                      <button key={d} type="button" aria-pressed={on} onClick={() => setAnchor(d)} className="flex h-[58px] flex-col items-center justify-center rounded-xl"
                        style={on ? { background: 'var(--clay-accent)', color: '#fff' } : { background: 'var(--clay-bg)', color: d === today ? 'var(--clay-accent-ink)' : 'var(--clay-ink)' }}>
                        <span className="text-[11px] font-semibold opacity-85">{parseDay(d).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                        <span className="text-[16px] font-bold">{parseDay(d).getDate()}</span>
                        <span className="h-[5px] w-[5px] rounded-full" style={{ background: n ? (on ? '#fff' : 'var(--clay-accent)') : 'transparent' }} />
                      </button>
                    )
                  })}
                </div>
              )}
              <p className="px-4 py-2 text-[12.5px]" style={{ color: 'var(--clay-dim)', borderBottom: wide ? '1px solid var(--clay-line)' : undefined }}>
                {wide ? 'Drag a lesson to move it. Drag its bottom edge to make it longer or shorter. Click it to open.' : 'Hold a lesson, then drag to move it or its bottom edge to change the length. Tap to open.'}
              </p>
              <div className={wide ? 'overflow-x-auto' : 'px-2 pb-3'}>
                <TimeGrid
                  days={wide ? weekDays : [anchor]}
                  items={wide ? items : dayItems}
                  tags={settings.tags}
                  startHour={startHour}
                  endHour={endHour}
                  pxPerHour={wide ? 56 : 60}
                  today={today}
                  nowMinutes={nowMinutes}
                  onOpen={setOpen}
                  onDrop={onDrop}
                  compact={!wide}
                />
              </div>
            </>
          )}

          {view === 'month' && (
            wide ? (
              <MonthGrid year={a.getFullYear()} month0={a.getMonth()} items={items} tags={settings.tags} today={today}
                onPick={(d) => { setAnchor(d); setView('week') }} />
            ) : (
              <div className="px-2 pb-3">
                <MonthGrid compact selected={anchor} year={a.getFullYear()} month0={a.getMonth()} items={items} tags={settings.tags} today={today} onPick={setAnchor} />
                <p className="px-2 pb-1.5 pt-4 text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--clay-dim)' }}>
                  {parseDay(anchor).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
                <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--clay-bg)' }}>
                  {dayItems.length === 0 && <p className="p-3.5 text-[14px]" style={{ color: 'var(--clay-dim)' }}>Nothing booked.</p>}
                  {dayItems.map((it) => (
                    <button key={it.key} type="button" onClick={() => setOpen(it)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left" style={{ borderTop: '1px solid var(--clay-line)', marginTop: -1 }}>
                      <span className="h-8 w-1 shrink-0 rounded" style={{ background: tagFor(settings.tags, it.tagId).color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold" style={{ color: 'var(--clay-ink)' }}>{it.title}</span>
                        <span className="block text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>{clock(it.startTime)}–{clock(endTime(it))}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      <LessonSheet item={open} onClose={() => setOpen(null)} />
      <NewLessonSheet open={adding} onClose={() => setAdding(false)} date={anchor} />

      {toast && (
        <div role="status" className="fixed bottom-24 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-xl py-2.5 pl-4 pr-2.5 text-[14px] text-white lg:bottom-8" style={{ background: 'var(--clay-ink)', boxShadow: '0 14px 30px -10px rgba(58,48,84,.45)' }}>
          <span>{toast.text}</span>
          {toast.action && (
            <button type="button" onClick={() => { const r = toast.action?.run; setToast(null); r?.() }} className="whitespace-nowrap rounded-[9px] px-3 py-1.5 font-bold" style={{ background: 'var(--clay-accent)' }}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </StudioPage>
  )
}
