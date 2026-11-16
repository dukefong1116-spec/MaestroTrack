import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '@/components/ui/Modal'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { useMembers, useStudioSettings, useAllLessons, saveItem, updateSeries } from '@/hooks/useStudioData'
import { saveLessonNote, deleteOccurrence } from '@/lib/firebase/studio'
import { expandRange, endTime, type CalendarItem } from '@/lib/studio/calendar'
import { addDays, clock, parseDay, toMinutes, weekday } from '@/lib/studio/dates'
import { LENGTH_CHOICES, lessonMinutes, tagFor } from '@/lib/studio/settings'
import { Btn, Field, Pill } from '@/components/teacher/studio/ui'
import { inputCls, inputStyle, toneColors } from '@/components/teacher/studio/tokens'
import type { AttendanceMark } from '@/types'
import { ATTENDANCE } from '@/lib/studio/labels'

/**
 * One lesson: when and how long, its tag, who came, what carried over
 * from last time, and the notes — one shared with the student, one only
 * for you. Changes apply to this date; "every week" changes the weekly
 * lesson from now on.
 */
export default function LessonSheet({ item, onClose }: { item: CalendarItem | null; onClose: () => void }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const settings = useStudioSettings()
  const members = useMembers()
  const notes = useTeacherStore((s) => s.notes)
  const lessons = useAllLessons()
  const occurrences = useTeacherStore((s) => s.occurrences)

  const [start, setStart] = useState('')
  const [minutes, setMinutes] = useState(30)
  const [tagId, setTagId] = useState('private')
  const [everyWeek, setEveryWeek] = useState(false)
  const [att, setAtt] = useState<Record<string, AttendanceMark>>({})
  const [carried, setCarried] = useState<Record<number, 'covered' | 'carried'>>({})
  const [nextTopic, setNextTopic] = useState('')
  /** Topics added in this lesson for the next one. */
  const [own, setOwn] = useState<string[]>([])
  const [shared, setShared] = useState('')
  const [priv, setPriv] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const people = useMemo(() => (item ? item.rosterIds.map((id) => members.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m) : []), [item, members])
  const noteKey = item?.key ?? ''
  const existing = useMemo(() => notes.filter((n) => n.occurrenceId === noteKey), [notes, noteKey])

  // What was carried over from the last time this lesson happened.
  const previous = useMemo(() => {
    if (!item?.lessonId) return null
    const past = expandRange(addDays(item.date, -70), addDays(item.date, -1), lessons, occurrences)
      .filter((i) => i.lessonId === item.lessonId && i.carried.length)
    return past.at(-1) ?? null
  }, [item, lessons, occurrences])
  const toCarry = previous?.carried.filter((c) => c.state !== 'covered') ?? []

  useEffect(() => {
    if (!item) return
    setStart(item.startTime)
    setMinutes(item.durationMinutes)
    setTagId(item.tagId)
    setEveryWeek(false)
    setAtt(item.attendance)
    setCarried(Object.fromEntries(toCarry.map((t, i) => [i, item.carried.find((c) => c.text === t.text)?.state === 'covered' ? 'covered' : 'carried'])) as Record<number, 'covered' | 'carried'>)
    setOwn(item.carried.filter((c) => !toCarry.some((t) => t.text === c.text)).map((c) => c.text))
    setNextTopic('')
    setShared(existing.find((n) => n.visibility === 'shared')?.text ?? '')
    setPriv(existing.find((n) => n.visibility === 'private')?.text ?? '')
    setError('')
    // Only when a different lesson is opened, not on every snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.key])

  if (!item || !profile) return null
  const solo = people.length === 1 ? people[0] : undefined
  const usual = solo ? lessonMinutes(solo.roster, settings) : null
  const isEvent = tagId === 'event'
  const dateLabel = parseDay(item.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  async function save() {
    if (!item || !profile) return
    setBusy(true)
    setError('')
    try {
      const topics = [
        ...toCarry.map((c, i) => ({ text: c.text, state: carried[i] ?? 'carried' })),
        ...own.map((text) => ({ text, state: 'carried' as const })),
        ...(nextTopic.trim() ? [{ text: nextTopic.trim(), state: 'carried' as const }] : []),
      ]
      if (everyWeek && item.lessonId) {
        await updateSeries(item, { startTime: start, minutes, tagId, dayOfWeek: weekday(item.date) })
      }
      const changed = start !== item.startTime || minutes !== item.durationMinutes || tagId !== item.tagId
      const hasAtt = Object.keys(att).length > 0
      const needDoc = (!everyWeek && changed) || hasAtt || topics.length > 0 || !!item.occurrenceId || !!shared.trim() || !!priv.trim()
      let key = item.key
      if (needDoc) {
        key = await saveItem(profile.uid, item, {
          startTime: everyWeek ? item.startTime : start,
          durationMinutes: everyWeek ? item.durationMinutes : minutes,
          tagId: everyWeek ? item.tagId : tagId,
          attendance: att,
          carried: topics,
        })
      }
      for (const m of people) {
        for (const [visibility, text] of [['shared', shared], ['private', priv]] as const) {
          const was = existing.find((n) => n.rosterId === m.id && n.visibility === visibility)
          if (!was && !text.trim()) continue
          if (was && was.text === text.trim()) continue
          await saveLessonNote({ id: was?.id, teacherId: profile.uid, rosterId: m.id, studentUid: m.uid ?? '', date: item.date, occurrenceId: key, visibility, text: text.trim(), createdAt: was?.createdAt })
        }
      }
      onClose()
    } catch (e) {
      console.error('[LessonSheet] could not save', e)
      setError('Could not save. Check your connection — or the studio rules may not be published yet.')
    } finally {
      setBusy(false)
    }
  }

  async function skip() {
    if (!item || !profile) return
    setBusy(true)
    try {
      if (!item.lessonId && item.occurrenceId) await deleteOccurrence(item.occurrenceId)
      else await saveItem(profile.uid, item, { cancelled: !item.cancelled })
      onClose()
    } finally { setBusy(false) }
  }

  const tag = tagFor(settings.tags, tagId)
  return (
    <Modal open={!!item} onClose={onClose} title={item.title} size="lg">
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--clay-dim)' }}>
          <span className="h-3 w-3 rounded" style={{ background: tag.color }} aria-hidden="true" />
          {dateLabel} · {clock(item.startTime)}–{clock(endTime(item))}{item.where ? ` · ${item.where}` : ''}
          {item.cancelled && <Pill tone="neutral">No lesson this week</Pill>}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Starts"><input type="time" step={900} className={inputCls} style={inputStyle} value={start} onChange={(e) => e.target.value && setStart(e.target.value)} /></Field>
          <Field label="Length">
            <select className={inputCls} style={inputStyle} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {[...new Set([...LENGTH_CHOICES, minutes])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
          </Field>
          <Field label="Tag">
            <select className={inputCls} style={inputStyle} value={tagId} onChange={(e) => setTagId(e.target.value)}>
              {settings.tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <p className="text-[12.5px] sm:col-span-3" style={{ color: 'var(--clay-dim)' }}>
            {solo
              ? minutes === usual
                ? `${minutes} min — ${solo.name.split(' ')[0]}’s usual length${solo.roster.lessonMinutes == null ? ' (the studio default)' : ''}.`
                : `This lesson only: ${minutes} min. ${solo.name.split(' ')[0]}’s usual is ${usual} min; the studio default is ${settings.defaultLessonMinutes} min.`
              : `The studio default lesson is ${settings.defaultLessonMinutes} min.`}
          </p>
          {item.lessonId && (
            <label className="flex items-center gap-2 text-[13px] sm:col-span-3" style={{ color: 'var(--clay-ink)' }}>
              <input type="checkbox" checked={everyWeek} onChange={(e) => setEveryWeek(e.target.checked)} style={{ accentColor: 'var(--clay-accent-ink)' }} className="h-[18px] w-[18px]" />
              Change every week from {dateLabel.split(',')[0]}s on, not just this one
            </label>
          )}
        </div>

        {!isEvent && people.length > 0 && (
          <div>
            <p className="mb-2 text-[13px] font-bold" style={{ color: 'var(--clay-ink)' }}>Attendance</p>
            <div className="space-y-2">
              {people.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-1.5">
                  {people.length > 1 && <span className="w-32 truncate text-[13.5px] font-semibold" style={{ color: 'var(--clay-ink)' }}>{m.name}</span>}
                  {ATTENDANCE.map((a) => {
                    const on = att[m.id] === a.value
                    const [bg, fg] = toneColors(a.tone)
                    return (
                      <button
                        key={a.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setAtt((cur) => { const n = { ...cur }; if (on) delete n[m.id]; else n[m.id] = a.value; return n })}
                        className="min-h-[34px] rounded-full px-3 text-[13px] font-semibold"
                        style={on ? { background: bg, color: fg, boxShadow: `inset 0 0 0 2px ${fg}` } : { background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}
                      >
                        {a.label}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
            {Object.values(att).some((v) => v === 'teacher_cancel' || v === 'student_cancel') && (
              <p className="mt-2 rounded-lg px-3 py-2 text-[12.5px]" style={{ background: '#FFF6E3', color: '#6B4605' }}>
                {settings.policy.teacherCancelCredit || settings.policy.noticeCredit
                  ? 'Cancelled: a make-up credit is added if your policy gives one for this (Settings › Cancellations).'
                  : 'Your policy gives no make-up credit for cancellations.'}
              </p>
            )}
          </div>
        )}

        {!isEvent && (
          <div>
            <p className="mb-1 text-[13px] font-bold" style={{ color: 'var(--clay-ink)' }}>From last lesson</p>
            {toCarry.length === 0 && <p className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>Nothing carried over.</p>}
            {toCarry.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 py-1.5" style={{ borderTop: '1px solid var(--clay-line)' }}>
                <span className="min-w-[180px] flex-1 text-[13.5px]" style={{ color: 'var(--clay-ink)' }}>{c.text}</span>
                {(['covered', 'carried'] as const).map((st) => {
                  const on = (carried[i] ?? 'carried') === st
                  return (
                    <button key={st} type="button" aria-pressed={on} onClick={() => setCarried({ ...carried, [i]: st })}
                      className="min-h-[30px] rounded-full px-3 text-[12px] font-semibold"
                      style={on ? { background: st === 'covered' ? 'var(--clay-success-bg)' : 'var(--clay-warning-bg)', color: st === 'covered' ? '#1F6B4A' : '#7A4F05' } : { background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}>
                      {st === 'covered' ? 'Covered' : 'Carry to next lesson'}
                    </button>
                  )
                })}
              </div>
            ))}
            {own.map((t) => (
              <div key={t} className="flex items-center gap-2 py-1.5 text-[13.5px]" style={{ borderTop: '1px solid var(--clay-line)', color: 'var(--clay-ink)' }}>
                <span className="flex-1">Next time: {t}</span>
                <button type="button" aria-label={`Remove ${t}`} onClick={() => setOwn(own.filter((x) => x !== t))} className="px-2" style={{ color: 'var(--clay-dim)' }}>✕</button>
              </div>
            ))}
            <input className={`${inputCls} mt-2 font-normal`} style={inputStyle} value={nextTopic} onChange={(e) => setNextTopic(e.target.value)} placeholder="Something to pick up next time…" aria-label="Topic for next lesson" />
          </div>
        )}

        {people.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`What we worked on · shared with ${people.length > 1 ? 'the group' : people[0].name.split(' ')[0]}`}>
              <textarea rows={4} className="w-full rounded-xl border-0 p-3 text-[14px] outline-none" style={inputStyle} value={shared} onChange={(e) => setShared(e.target.value)} placeholder="Steady pulse in the A section. Started the B section at 72." />
            </Field>
            <Field label="Private note · only you">
              <textarea rows={4} className="w-full rounded-xl border-0 p-3 text-[14px] outline-none" style={inputStyle} value={priv} onChange={(e) => setPriv(e.target.value)} placeholder="Seemed tired; ask about the practice routine." />
            </Field>
          </div>
        )}

        {error && <p className="text-[13px]" style={{ color: 'var(--clay-danger)' }}>{error}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Btn kind="soft" onClick={skip} disabled={busy}>{item.lessonId ? (item.cancelled ? 'Restore this week' : 'No lesson this week') : 'Delete'}</Btn>
          {solo && <Btn kind="link" onClick={() => { onClose(); navigate(`/teacher/students/${encodeURIComponent(solo.id)}?tab=assignments&new=1`) }}>+ Turn into an assignment</Btn>}
          <span className="flex-1" />
          <Btn kind="primary" onClick={save} disabled={busy || toMinutes(start) + minutes > 24 * 60}>{busy ? 'Saving…' : 'Save'}</Btn>
        </div>
      </div>
    </Modal>
  )
}
