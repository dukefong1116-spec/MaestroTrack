import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useMembers, useStudioSettings, useCalendar } from '@/hooks/useStudioData'
import { saveOccurrence } from '@/lib/firebase/studio'
import { creditsFor } from '@/lib/studio/billing'
import { freeTimes } from '@/lib/studio/calendar'
import { addDays, clock, dayKey, parseDay } from '@/lib/studio/dates'
import { lessonMinutes } from '@/lib/studio/settings'
import { Pill } from '@/components/teacher/studio/ui'

/**
 * Students with a make-up credit, and times you are free in the next week
 * that fit their lesson — offered as choices, never drawn on the calendar.
 */
export default function MakeupsPanel() {
  const { profile } = useAuth()
  const members = useMembers()
  const settings = useStudioSettings()
  const today = dayKey(new Date())
  const items = useCalendar(addDays(today, -(settings.policy.creditExpiryDays ?? 180)), addDays(today, 14))
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, string>>({})

  const owed = useMemo(() => members
    .map((m) => ({ m, credits: creditsFor(m.id, items, settings, m.roster.creditAdjust ?? 0, today) }))
    .filter((x) => x.credits > 0), [members, items, settings, today])

  const upcomingMakeups = items.filter((i) => i.makeupFor && i.date >= today && !i.cancelled)

  async function book(memberId: string, date: string, time: string) {
    const m = members.find((x) => x.id === memberId)
    if (!profile || !m) return
    setBusy(memberId)
    try {
      await saveOccurrence(null, {
        teacherId: profile.uid,
        rosterIds: [m.id],
        studentUids: m.uid ? [m.uid] : [],
        title: `${m.name} · make-up`,
        tagId: 'makeup',
        date,
        startTime: time,
        durationMinutes: lessonMinutes(m.roster, settings),
        makeupFor: m.id,
      })
      setDone({ ...done, [memberId]: `${parseDay(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${clock(time)}` })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="px-5 py-4" style={{ borderTop: '1px solid var(--clay-line)' }}>
      <h2 className="mb-1 text-[14px] font-bold" style={{ color: 'var(--clay-ink)' }}>Make-ups to book</h2>
      {owed.length === 0 && <p className="py-1 text-[13px]" style={{ color: 'var(--clay-dim)' }}>Nobody is owed a lesson.</p>}
      {owed.map(({ m, credits }) => {
        const len = lessonMinutes(m.roster, settings)
        const options: { date: string; time: string }[] = []
        for (let i = 1; i <= 7 && options.length < 4; i++) {
          const date = addDays(today, i)
          for (const t of freeTimes(date, items, len, Math.max(settings.dayStart, 14), settings.dayEnd, 60).slice(0, 2)) {
            if (options.length < 4) options.push({ date, time: t })
          }
        }
        return (
          <div key={m.id} className="py-2.5" style={{ borderTop: '1px solid var(--clay-line)' }}>
            <p className="text-[13.5px] font-bold" style={{ color: 'var(--clay-ink)' }}>{m.name}</p>
            <p className="text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>{credits} credit{credits === 1 ? '' : 's'} · {len} min</p>
            {done[m.id] ? (
              <div className="mt-1.5"><Pill tone="success">Booked · {done[m.id]}</Pill></div>
            ) : (
              <>
                <p className="mb-1 mt-2 text-[12px]" style={{ color: 'var(--clay-dim)' }}>Times you’re free:</p>
                <div className="flex flex-wrap gap-1.5">
                  {options.map((o) => (
                    <button key={`${o.date}${o.time}`} type="button" disabled={busy === m.id} onClick={() => book(m.id, o.date, o.time)}
                      className="min-h-[32px] rounded-[9px] px-2.5 text-[12.5px] font-bold disabled:opacity-50" style={{ background: 'var(--clay-accent-soft)', color: '#C2452B' }}>
                      {parseDay(o.date).toLocaleDateString('en-US', { weekday: 'short' })} {clock(o.time)}
                    </button>
                  ))}
                  {options.length === 0 && <span className="text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>No free time this week — add one from the calendar.</span>}
                </div>
              </>
            )}
          </div>
        )
      })}
      {upcomingMakeups.length > 0 && (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--clay-dim)' }}>
          Booked: {upcomingMakeups.map((i) => `${i.title.replace(' · make-up', '')} ${parseDay(i.date).toLocaleDateString('en-US', { weekday: 'short' })} ${clock(i.startTime)}`).join(' · ')}
        </p>
      )}
    </section>
  )
}
