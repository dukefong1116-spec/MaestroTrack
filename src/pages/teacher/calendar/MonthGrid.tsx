import { monthGrid, sameMonth, type CalendarItem } from '@/lib/studio/calendar'
import { parseDay } from '@/lib/studio/dates'
import { tagFor } from '@/lib/studio/settings'
import type { CalendarTag } from '@/types'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * A month the way a calendar app shows one: each day lists its lessons, a
 * short bar in the tag's colour beside each, three at most and then
 * "+N more". Picking a day opens it.
 */
export default function MonthGrid({
  year, month0, items, tags, today, onPick, compact, selected,
}: {
  year: number
  month0: number
  items: CalendarItem[]
  tags: CalendarTag[]
  today: string
  onPick: (date: string) => void
  /** Dots instead of names (a phone), with the chosen day ringed. */
  compact?: boolean
  selected?: string
}) {
  const cells = monthGrid(year, month0)
  return (
    <div className="grid grid-cols-7">
      {DAYS.map((d) => (
        <div key={d} className={compact ? 'py-1.5 text-center text-[11px] font-semibold' : 'px-2.5 py-2 text-right text-[12px] font-semibold'} style={{ color: 'var(--clay-dim)', borderBottom: compact ? undefined : '1px solid var(--clay-line)' }}>
          {compact ? d[0] : d}
        </div>
      ))}
      {cells.map((date, i) => {
        const inMonth = sameMonth(date, year, month0)
        const list = items.filter((it) => it.date === date)
        const d = parseDay(date)
        const isToday = date === today
        const label = `${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}: ${list.length} item${list.length === 1 ? '' : 's'}`
        if (compact) {
          const on = selected === date
          const dots = [...new Set(list.map((it) => tagFor(tags, it.tagId).color))].slice(0, 3)
          return (
            <button key={date} type="button" aria-label={label} aria-pressed={on} onClick={() => onPick(date)} className="flex h-12 flex-col items-center gap-0.5 pt-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-[14px]"
                style={on ? { background: 'var(--clay-ink)', color: '#fff', fontWeight: 700 } : isToday ? { background: 'var(--clay-accent)', color: '#fff', fontWeight: 700 } : { color: inMonth ? 'var(--clay-ink)' : 'var(--clay-faint)' }}>
                {d.getDate()}
              </span>
              <span className="flex gap-0.5">{dots.map((c) => <span key={c} className="h-[5px] w-[5px] rounded-full" style={{ background: c }} />)}</span>
            </button>
          )
        }
        return (
          <button
            key={date}
            type="button"
            aria-label={label}
            onClick={() => onPick(date)}
            className="flex min-h-[118px] min-w-0 flex-col gap-[3px] px-2 pb-2 pt-1.5 text-left"
            style={{ borderTop: '1px solid var(--clay-line)', borderLeft: i % 7 ? '1px solid var(--clay-line)' : 'none', background: inMonth ? 'var(--clay-surface)' : '#FBFAFE' }}
          >
            <span className="flex justify-end">
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px]"
                style={isToday ? { background: 'var(--clay-accent)', color: '#fff', fontWeight: 700 } : { color: inMonth ? 'var(--clay-ink)' : 'var(--clay-faint)', fontWeight: 600 }}>
                {d.getDate() === 1 ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : d.getDate()}
              </span>
            </span>
            {list.slice(0, 3).map((it) => {
              const tag = tagFor(tags, it.tagId)
              const off = it.cancelled || (it.rosterIds.length > 0 && it.rosterIds.every((r) => it.attendance[r] === 'teacher_cancel' || it.attendance[r] === 'student_cancel'))
              return (
                <span key={it.key} className="flex min-w-0 items-center gap-1.5 text-[12px]" title={it.title}>
                  <span className="h-[13px] w-[3px] shrink-0 rounded-sm" style={{ background: tag.color }} />
                  <span className="truncate" style={{ color: off ? 'var(--clay-dim)' : 'var(--clay-ink)', textDecoration: off ? 'line-through' : 'none' }}>{it.title}</span>
                </span>
              )
            })}
            {list.length > 3 && <span className="pl-2 text-[11.5px]" style={{ color: 'var(--clay-dim)' }}>+{list.length - 3} more</span>}
          </button>
        )
      })}
    </div>
  )
}
