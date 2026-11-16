import { useState } from 'react'
import { addMinutes, differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import { ChevronDown, MapPin, Megaphone, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useStudentStudioStore, liveAnnouncement, dismissAnnouncement } from '@/stores/studentStudioStore'
import type { LessonSlot } from '@/types'

/**
 * The Studio page's three "what's happening" cards: the teacher's latest
 * announcement, the next lesson, and the notes from the last one. Each is
 * a section of the one Studio panel, split from the next by a hairline.
 */

const section = 'px-5 py-4'
const rule = { borderTop: '1px solid var(--clay-line)' }
const title = 'text-[15px] font-bold'

/** The newest announcement, until it is dismissed (on this device) or a month old. */
export function AnnouncementCard() {
  const { profile } = useAuth()
  const a = useStudentStudioStore((s) => liveAnnouncement(s.announcements, s.announcementSeen))
  if (!a || !profile) return null
  return (
    <div className={section} style={rule}>
      <div className="rounded-2xl p-4" style={{ background: 'var(--clay-accent-soft)' }}>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--clay-surface)', color: 'var(--clay-accent-ink)' }} aria-hidden="true">
            <Megaphone size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold" style={{ color: 'var(--clay-accent-ink)' }}>
              Announcement · {formatDistanceToNowStrict(parseISO(a.createdAt), { addSuffix: true })}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed" style={{ color: 'var(--clay-ink)' }}>{a.text}</p>
          </div>
          <button
            type="button"
            onClick={() => dismissAnnouncement(profile.uid, a.createdAt)}
            aria-label="Dismiss announcement"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ color: 'var(--clay-accent-ink)' }}
          >
            <X size={17} />
          </button>
        </div>
      </div>
    </div>
  )
}

/** When, how long, where — and whether it moved. */
export function NextLessonCard({ next }: { next?: { slot: LessonSlot; when: Date } }) {
  // nextOccurrence pushes a past one-off ten years out: that is "none".
  const real = next && next.when.getTime() - Date.now() < 365 * 864e5 ? next : undefined
  return (
    <div className={section} style={rule}>
      <h2 className={title} style={{ color: 'var(--clay-ink)' }}>Next lesson</h2>
      {!real ? (
        <p className="mt-1.5 text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>No lesson booked yet.</p>
      ) : (
        <div className="mt-2.5 flex items-center gap-3.5">
          <span
            className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl"
            style={{ background: 'var(--clay-accent-soft)', color: 'var(--clay-accent-ink)' }}
            aria-hidden="true"
          >
            <span className="text-[10.5px] font-bold uppercase tracking-wider">{format(real.when, 'MMM')}</span>
            <span className="text-[20px] font-bold leading-none">{format(real.when, 'd')}</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold" style={{ color: 'var(--clay-ink)' }}>{dayLabel(real.when)}</p>
            <p className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>
              {format(real.when, 'h:mm a')} – {format(addMinutes(real.when, real.slot.durationMinutes), 'h:mm a')} · {real.slot.durationMinutes} min
            </p>
            {(real.slot.where || real.slot.movedFrom) && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px]">
                {real.slot.where && (
                  <span className="inline-flex items-center gap-1" style={{ color: 'var(--clay-dim)' }}>
                    <MapPin size={13} aria-hidden="true" /> {real.slot.where}
                  </span>
                )}
                {real.slot.movedFrom && (
                  <span className="rounded-full px-2 py-0.5 text-[11.5px] font-bold" style={{ background: 'var(--clay-warning-bg)', color: 'color-mix(in srgb, var(--clay-warning-fg) 70%, var(--clay-ink))' }}>
                    Moved from {format(parseISO(real.slot.movedFrom), 'EEE, MMM d')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function dayLabel(when: Date): string {
  const days = differenceInCalendarDays(when, new Date())
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 7) return format(when, 'EEEE')
  return format(when, 'EEEE, MMMM d')
}

const EARLIER = 5

/** The newest shared lesson note in full; a few earlier ones on request. */
export function LastLessonNotes() {
  const { profile } = useAuth()
  const teacherId = profile?.teacherId
  const all = useStudentStudioStore((s) => s.sharedNotes)
  const notes = all.filter((n) => n.teacherId === teacherId).sort((a, b) => b.date.localeCompare(a.date))
  const [more, setMore] = useState(false)
  if (!notes.length) return null
  const [last, ...earlier] = notes
  return (
    <div className={section} style={rule}>
      <h2 className={title} style={{ color: 'var(--clay-ink)' }}>Notes from your last lesson</h2>
      <p className="mt-0.5 text-[12px] font-semibold" style={{ color: 'var(--clay-dim)' }}>{format(parseISO(last.date), 'EEEE, MMM d')}</p>
      <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed" style={{ color: 'var(--clay-ink)' }}>{last.text}</p>
      {earlier.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            aria-expanded={more}
            className="mt-2.5 inline-flex items-center gap-1 text-[12.5px] font-bold"
            style={{ color: 'var(--clay-accent-ink)' }}
          >
            {more ? 'Hide earlier notes' : `Earlier notes (${Math.min(earlier.length, EARLIER)})`}
            <ChevronDown size={15} style={{ transform: more ? 'rotate(180deg)' : undefined }} aria-hidden="true" />
          </button>
          {more && earlier.slice(0, EARLIER).map((n) => (
            <div key={n.id} className="mt-3 pl-3" style={{ borderLeft: '2px solid var(--clay-line)' }}>
              <p className="text-[12px] font-semibold" style={{ color: 'var(--clay-dim)' }}>{format(parseISO(n.date), 'EEE, MMM d')}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-[13.5px] leading-relaxed" style={{ color: 'var(--clay-ink)' }}>{n.text}</p>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
