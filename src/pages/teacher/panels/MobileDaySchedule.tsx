import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import { addDays, format, isSameDay, startOfWeek } from 'date-fns'
import InstrumentIcon from '@/components/icons/InstrumentIcon'
import { useTeacherStore } from '@/stores/teacherStore'
import type { InstrumentType, LessonSlot } from '@/types'

/**
 * The weekly grid as a phone sees it: one day at a time, on a real clock.
 *
 * Seven columns of cards works on a monitor and collapses into nonsense at
 * 390px — two columns of four days, with the time buried in body text. A
 * day view instead puts the hour back on the left and gives each lesson a
 * block whose height *is* its duration, which is the one thing a teacher
 * glancing at a phone actually wants to read: how the afternoon packs.
 *
 * Desktop never renders this; SchedulePage keeps its grid from `lg` up.
 */

const HOUR_PX = 64
const GUTTER = 52
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** Lightness differs as well as hue, so the blocks stay distinct to anyone
 *  who cannot separate them by colour alone. */
const TINTS = [
  { bg: 'var(--clay-accent-soft)', bar: 'var(--clay-accent)', ink: 'var(--clay-accent-ink)' },
  { bg: '#E7F7EF', bar: '#6BCB9B', ink: '#2F7A58' },
  { bg: '#FFF6D9', bar: '#FFC85C', ink: '#8A6410' },
  { bg: '#E8F0FD', bar: '#7CA9E8', ink: '#2E5C9A' },
]

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function clock(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24
  const m = totalMinutes % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

/** Stable per student, so a lesson keeps its colour between renders. */
function tintFor(studentId: string) {
  let sum = 0
  for (let i = 0; i < studentId.length; i++) sum = (sum + studentId.charCodeAt(i)) % 997
  return TINTS[sum % TINTS.length]
}

export default function MobileDaySchedule({
  schedule,
  onDelete,
}: {
  schedule: LessonSlot[]
  onDelete: (id: string) => void
}) {
  const { students } = useTeacherStore()
  const now = new Date()
  const [day, setDay] = useState<number>(now.getDay())

  const weekStart = startOfWeek(now, { weekStartsOn: 0 })
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const selectedDate = dates[day]

  const slots = schedule
    .filter((s) => s.dayOfWeek === day)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  // The visible window follows the day's lessons rather than showing a
  // dead 06:00–08:00 every time, but never collapses below six hours.
  let startHour = 8
  let endHour = 21
  if (slots.length > 0) {
    const first = Math.min(...slots.map((s) => minutesOf(s.startTime)))
    const last = Math.max(...slots.map((s) => minutesOf(s.startTime) + s.durationMinutes))
    startHour = Math.max(0, Math.floor(first / 60) - 1)
    endHour = Math.min(24, Math.ceil(last / 60) + 1)
  }
  if (endHour - startHour < 6) endHour = Math.min(24, startHour + 6)
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i)

  /* Two lessons at the same hour would otherwise draw on top of one
     another; give each overlapping run its own lane and share the width. */
  const laneEnds: number[] = []
  const placed = slots.map((slot) => {
    const start = minutesOf(slot.startTime)
    const end = start + slot.durationMinutes
    let lane = laneEnds.findIndex((e) => e <= start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end)
    } else {
      laneEnds[lane] = end
    }
    return { slot, start, end, lane }
  })
  const laneCount = Math.max(1, laneEnds.length)

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const showNow =
    isSameDay(selectedDate, now) && nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60
  const nowTop = (nowMinutes / 60 - startHour) * HOUR_PX

  return (
    <div>
      {/* week strip */}
      <div role="group" aria-label={`Week of ${format(weekStart, 'd MMMM')}`} className="mb-1 grid grid-cols-7 gap-1">
        {dates.map((date, i) => {
          const active = i === day
          const isToday = isSameDay(date, now)
          return (
            <button
              key={i}
              onClick={() => setDay(i)}
              aria-pressed={active}
              aria-label={format(date, 'EEEE d MMMM')}
              className="flex min-h-[48px] flex-col items-center gap-1 rounded-2xl py-1 transition-colors"
            >
              <span
                className="text-[11px] font-semibold"
                style={{ color: active ? 'var(--clay-accent-ink)' : 'var(--clay-dim)' }}
              >
                {DAY_LETTERS[i]}
              </span>
              <span
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-[16px] tabular-nums"
                style={
                  active
                    ? { background: 'var(--clay-accent)', color: 'var(--clay-on-accent)', fontWeight: 700, boxShadow: 'var(--clay-accent-shadow)' }
                    : { color: 'var(--clay-ink)', fontWeight: isToday ? 700 : 500 }
                }
              >
                {format(date, 'd')}
              </span>
            </button>
          )
        })}
      </div>

      <p
        className="border-b pb-2.5 text-center text-sm font-semibold"
        style={{ borderColor: 'var(--clay-line)', color: 'var(--clay-ink)' }}
      >
        {format(selectedDate, 'EEEE — MMM d, yyyy')}
      </p>

      {/* hour grid */}
      <div className="relative mt-4" style={{ height: (endHour - startHour) * HOUR_PX + 24 }}>
        {hours.map((h) => {
          const top = (h - startHour) * HOUR_PX
          // Near the hour, the "now" pill lands on top of the label and the
          // two read as one smudge. The pill carries the time anyway.
          const labelHidden = showNow && Math.abs(top - nowTop) < 12
          return (
            <div key={h} className="absolute inset-x-0" style={{ top, height: 1 }}>
              {!labelHidden && (
                <span
                  className="absolute -top-2 w-[42px] text-right text-[11px] tabular-nums"
                  style={{ left: 0, color: 'var(--clay-dim)' }}
                >
                  {String(h % 24).padStart(2, '0')}:00
                </span>
              )}
              <div className="absolute right-0 top-0 h-px" style={{ left: GUTTER, background: 'var(--clay-line)' }} />
            </div>
          )
        })}

        {placed.map(({ slot, start, end, lane }) => {
          const student = students.find((s) => s.uid === slot.studentId)
          const tint = tintFor(slot.studentId)
          const height = (slot.durationMinutes / 60) * HOUR_PX
          const tight = height < 54
          return (
            <motion.div
              key={slot.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute flex gap-2 overflow-hidden rounded-xl px-2 py-1.5"
              style={{
                top: (start / 60 - startHour) * HOUR_PX,
                height,
                background: tint.bg,
                left: `calc(${GUTTER}px + ${lane} * (100% - ${GUTTER}px) / ${laneCount})`,
                width: `calc((100% - ${GUTTER}px) / ${laneCount} - 6px)`,
              }}
            >
              <span className="w-1 shrink-0 rounded-full" style={{ background: tint.bar }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0" style={{ color: tint.ink }}>
                    <InstrumentIcon instrument={student?.instrument as InstrumentType | undefined} size={13} />
                  </span>
                  <p className="truncate text-[13px] font-semibold" style={{ color: tint.ink }}>
                    {slot.studentName}
                  </p>
                </div>
                {!tight && (
                  <p className="mt-0.5 truncate text-[10.5px] tabular-nums" style={{ color: tint.ink }}>
                    {clock(start)} – {clock(end)} · {slot.durationMinutes} min
                  </p>
                )}
              </div>
              {!tight && (
                <button
                  onClick={() => onDelete(slot.id)}
                  aria-label={`Delete ${slot.studentName}'s lesson at ${clock(start)}`}
                  className="h-7 w-7 shrink-0 self-start rounded-full transition-opacity hover:opacity-100"
                  style={{ color: tint.ink, opacity: 0.6 }}
                >
                  <Trash2 size={13} className="mx-auto" />
                </button>
              )}
            </motion.div>
          )
        })}

        {showNow && (
          <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowTop }}>
            <span
              className="absolute -top-[9px] rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
              style={{ left: 0, background: 'var(--clay-danger)', color: '#fff' }}
            >
              {format(now, 'HH:mm')}
            </span>
            <div className="absolute right-0 top-0 h-0.5 rounded-full" style={{ left: GUTTER, background: 'var(--clay-danger)' }} />
          </div>
        )}

        {slots.length === 0 && (
          <p className="absolute inset-x-0 top-1/2 text-center text-sm" style={{ color: 'var(--clay-faint)' }}>
            No lessons on {format(selectedDate, 'EEEE')}
          </p>
        )}
      </div>
    </div>
  )
}
