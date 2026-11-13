import { useEffect, useRef, useState } from 'react'
import { endTime, movedStart, resizedLength, type CalendarItem } from '@/lib/studio/calendar'
import { clock, parseDay, toMinutes } from '@/lib/studio/dates'
import { tagFor } from '@/lib/studio/settings'
import type { CalendarTag } from '@/types'

export interface DragResult { date: string; startTime: string; durationMinutes: number }

interface Drag {
  item: CalendarItem
  mode: 'move' | 'resize'
  x0: number
  y0: number
  moved: boolean
  armed: boolean
  timer?: ReturnType<typeof setTimeout>
  cols: (DOMRect | undefined)[]
}

/**
 * Lessons on a clock, one column per day. Drag a lesson to move it
 * (15-minute steps, and across days), drag its bottom edge to change its
 * length, click it to open it. With a finger, hold for a moment first —
 * so a quick swipe is never mistaken for a drag.
 */
export default function TimeGrid({
  days, items, tags, startHour, endHour, pxPerHour, today, nowMinutes, onOpen, onDrop, compact,
}: {
  days: string[]
  items: CalendarItem[]
  tags: CalendarTag[]
  startHour: number
  endHour: number
  pxPerHour: number
  today: string
  nowMinutes: number
  onOpen: (item: CalendarItem) => void
  onDrop: (item: CalendarItem, to: DragResult, mode: 'move' | 'resize') => void
  /** One column: no day headers (the phone's day view has its own). */
  compact?: boolean
}) {
  const cols = useRef<(HTMLDivElement | null)[]>([])
  const drag = useRef<Drag | null>(null)
  const [preview, setPreview] = useState<(DragResult & { key: string }) | null>(null)
  const noClickUntil = useRef(0)
  const height = (endHour - startHour) * pxPerHour

  // The drag listens on the window, not the block: a block dragged into
  // another day is re-mounted in that day's column, and would lose the
  // pointer (and the drop) with it.
  const last = useRef<(DragResult & { key: string }) | null>(null)
  useEffect(() => () => { stop.current?.() }, [])
  const stop = useRef<(() => void) | null>(null)

  function begin(e: React.PointerEvent, item: CalendarItem, mode: 'move' | 'resize') {
    if (e.button !== 0) return
    e.stopPropagation()
    stop.current?.()
    const d: Drag = {
      item, mode, x0: e.clientX, y0: e.clientY, moved: false,
      armed: e.pointerType !== 'touch',
      cols: cols.current.map((c) => c?.getBoundingClientRect()),
    }
    if (!d.armed) d.timer = setTimeout(() => { d.armed = true; navigator.vibrate?.(8) }, 220)
    drag.current = d
    last.current = null
    const onMove = (ev: PointerEvent) => move(ev)
    const onUp = () => end()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    stop.current = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      stop.current = null
    }
  }

  function move(e: PointerEvent) {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x0
    const dy = e.clientY - d.y0
    if (!d.armed) {
      // Moved before the hold finished: a swipe, not a drag.
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) { clearTimeout(d.timer); drag.current = null; stop.current?.() }
      return
    }
    if (!d.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return
    if (e.cancelable) e.preventDefault()
    d.moved = true
    const it = d.item
    const next = d.mode === 'move'
      ? (() => {
          const i = d.cols.findIndex((r) => r && e.clientX >= r.left && e.clientX < r.right)
          return { key: it.key, date: i >= 0 ? days[i] : it.date, startTime: movedStart(it.startTime, dy, pxPerHour, it.durationMinutes, startHour, endHour), durationMinutes: it.durationMinutes }
        })()
      : { key: it.key, date: it.date, startTime: it.startTime, durationMinutes: resizedLength(it.startTime, it.durationMinutes, dy, pxPerHour, endHour) }
    last.current = next
    setPreview(next)
  }

  function end() {
    stop.current?.()
    const d = drag.current
    drag.current = null
    if (!d) return
    clearTimeout(d.timer)
    const p = last.current
    last.current = null
    setPreview(null)
    if (!d.moved || !p) return
    noClickUntil.current = Date.now() + 400
    const it = d.item
    if (p.date === it.date && p.startTime === it.startTime && p.durationMinutes === it.durationMinutes) return
    onDrop(it, { date: p.date, startTime: p.startTime, durationMinutes: p.durationMinutes }, d.mode)
  }

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)

  return (
    <div className="flex" style={{ minWidth: compact ? undefined : 760 }}>
      <div className="w-[52px] shrink-0" style={{ paddingTop: compact ? 0 : 52 }}>
        {hours.map((h, i) => (
          <div key={h} className="pr-2 text-right text-[11px]" style={{ height: pxPerHour, color: 'var(--clay-dim)', marginTop: i ? 0 : -6 }}>
            {i === 0 ? '' : clock(h * 60).replace(':00', '')}
          </div>
        ))}
      </div>
      {days.map((date, ci) => {
        const isToday = date === today
        const d = parseDay(date)
        const mine = items
          .map((it) => (preview && preview.key === it.key ? { ...it, ...preview, dragging: true } : { ...it, dragging: false }))
          .filter((it) => it.date === date)
        return (
          <div key={date} className="min-w-0 flex-1" style={{ borderLeft: '1px solid var(--clay-line)' }}>
            {!compact && (
              <div className="flex h-[52px] flex-col items-center justify-center gap-0.5" style={{ borderBottom: '1px solid var(--clay-line)' }}>
                <span className="text-[11.5px] font-semibold" style={{ color: 'var(--clay-dim)' }}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span
                  className="flex h-[26px] min-w-[26px] items-center justify-center rounded-full px-1 text-[14px] font-bold"
                  style={isToday ? { background: 'var(--clay-accent)', color: '#fff' } : { color: 'var(--clay-ink)' }}
                >
                  {d.getDate()}
                </span>
              </div>
            )}
            <div
              ref={(el) => { cols.current[ci] = el }}
              className="relative"
              style={{ height, backgroundImage: 'linear-gradient(var(--clay-line) 1px, transparent 1px)', backgroundSize: `100% ${pxPerHour}px` }}
            >
              {isToday && nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60 && (
                <div className="pointer-events-none absolute inset-x-0 z-[4] h-0.5" style={{ top: ((nowMinutes - startHour * 60) / 60) * pxPerHour, background: 'var(--clay-accent-ink)' }} />
              )}
              {mine.map((it) => {
                const tag = tagFor(tags, it.tagId)
                const allCancelled = it.cancelled || (it.rosterIds.length > 0 && it.rosterIds.every((r) => it.attendance[r] === 'teacher_cancel' || it.attendance[r] === 'student_cancel'))
                const top = ((toMinutes(it.startTime) - startHour * 60) / 60) * pxPerHour + 1
                const h = Math.max(24, (it.durationMinutes / 60) * pxPerHour - 3)
                return (
                  <button
                    key={it.key}
                    type="button"
                    aria-label={`${it.title}, ${clock(it.startTime)} to ${clock(endTime(it))}${allCancelled ? ', cancelled' : ''}. Open.`}
                    onPointerDown={(e) => begin(e, it, 'move')}
                    onClick={() => { if (Date.now() >= noClickUntil.current) onOpen(it) }}
                    className="absolute left-[3px] right-[3px] overflow-hidden rounded-lg text-left text-[11.5px] leading-tight"
                    style={{
                      top, height: h,
                      padding: h >= 40 ? '3px 7px 10px' : '2px 7px',
                      border: `1px solid ${tag.color}`,
                      background: `${tag.color}${it.dragging ? '55' : '29'}`,
                      color: allCancelled ? 'var(--clay-dim)' : 'var(--clay-ink)',
                      textDecoration: allCancelled ? 'line-through' : 'none',
                      cursor: it.dragging ? 'grabbing' : 'grab',
                      touchAction: 'none',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      zIndex: it.dragging ? 6 : 2,
                      boxShadow: it.dragging ? '0 12px 24px -8px rgba(58,48,84,.45)' : 'none',
                    }}
                  >
                    {h >= 40 ? (
                      <>
                        <span className="block truncate font-bold">{it.title}</span>
                        <span className="block truncate" style={{ color: '#4F4766' }}>{clock(it.startTime)}–{clock(endTime(it))}</span>
                      </>
                    ) : (
                      <span className="block truncate"><strong>{it.title}</strong> <span style={{ color: '#4F4766' }}>{clock(it.startTime)}</span></span>
                    )}
                    <span
                      aria-hidden="true"
                      onPointerDown={(e) => begin(e, it, 'resize')}
                      className="absolute inset-x-0 bottom-0 flex h-[11px] cursor-ns-resize items-center justify-center"
                    >
                      <span className="h-[3px] w-[18px] rounded" style={{ background: 'rgba(58,48,84,.3)' }} />
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
