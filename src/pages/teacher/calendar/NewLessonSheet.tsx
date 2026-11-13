import { useEffect, useMemo, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { useAuth } from '@/hooks/useAuth'
import { useMembers, useStudioSettings } from '@/hooks/useStudioData'
import { createStudioLesson, saveOccurrence } from '@/lib/firebase/studio'
import { LENGTH_CHOICES, lessonMinutes } from '@/lib/studio/settings'
import { dayKey, weekday } from '@/lib/studio/dates'
import { Btn, Field, Segmented } from '@/components/teacher/studio/ui'
import { inputCls, inputStyle } from '@/components/teacher/studio/tokens'

/**
 * A new lesson, class or event. A private lesson starts at the student's
 * own length (or the studio default); a weekly one repeats from its date.
 */
export default function NewLessonSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date?: string }) {
  const { profile } = useAuth()
  const members = useMembers()
  const settings = useStudioSettings()
  const [repeat, setRepeat] = useState<'weekly' | 'once'>('weekly')
  const [who, setWho] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [day, setDay] = useState(date ?? dayKey(new Date()))
  const [time, setTime] = useState('16:00')
  const [minutes, setMinutes] = useState<number | null>(null)
  const [tagId, setTagId] = useState('private')
  const [where, setWhere] = useState('Studio')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (open) { setDay(date ?? dayKey(new Date())); setWho([]); setTitle(''); setMinutes(null); setError(''); setTagId('private') } }, [open, date])

  const chosen = members.filter((m) => who.includes(m.id))
  const autoMinutes = chosen.length === 1 ? lessonMinutes(chosen[0].roster, settings) : settings.defaultLessonMinutes
  const length = minutes ?? autoMinutes
  const autoTitle = chosen.length === 0 ? '' : chosen.length === 1 ? chosen[0].name : `Group · ${chosen.map((m) => m.name.split(' ')[0]).join(', ')}`
  const effTag = useMemo(() => (tagId === 'private' && chosen.length > 1 ? 'group' : tagId === 'private' && chosen.length === 0 ? 'event' : tagId), [tagId, chosen.length])

  async function save() {
    if (!profile) return
    const name = (title.trim() || autoTitle).slice(0, 120)
    if (!name) { setError('Choose a student, or give the event a name.'); return }
    setBusy(true)
    setError('')
    try {
      const common = {
        rosterIds: chosen.map((m) => m.id),
        studentUids: chosen.map((m) => m.uid).filter((u): u is string => !!u),
        title: name,
        tagId: effTag,
        startTime: time,
        durationMinutes: length,
        where: where.trim() || undefined,
      }
      if (repeat === 'weekly') {
        await createStudioLesson(profile.uid, {
          ...common,
          dayOfWeek: weekday(day),
          fixedMinutes: chosen.length === 1 && minutes == null ? null : length,
          startsOn: day,
        })
      } else {
        await saveOccurrence(null, { ...common, teacherId: profile.uid, date: day })
      }
      onClose()
    } catch (e) {
      console.error('[NewLesson] could not save', e)
      setError('Could not save. Check your connection — or the studio rules may not be published yet.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New lesson or event" size="lg">
      <div className="space-y-4">
        <Segmented label="Repeats" value={repeat} onChange={setRepeat} options={[{ value: 'weekly', label: 'Every week' }, { value: 'once', label: 'Just once' }]} className="w-fit" />
        <div>
          <p className="mb-1.5 text-[12.5px] font-medium" style={{ color: 'var(--clay-dim)' }}>Who · choose several for a group class, none for an event</p>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {members.map((m) => {
              const on = who.includes(m.id)
              return (
                <button key={m.id} type="button" aria-pressed={on} onClick={() => setWho(on ? who.filter((x) => x !== m.id) : [...who, m.id])}
                  className="min-h-[34px] rounded-full px-3 text-[13px] font-semibold"
                  style={on ? { background: 'var(--clay-ink)', color: '#fff' } : { background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}>
                  {m.name}
                </button>
              )
            })}
            {members.length === 0 && <p className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>No students yet — you can still add an event.</p>}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={chosen.length ? 'Name (optional)' : 'Name'}><input className={inputCls} style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={autoTitle || 'Winter recital rehearsal'} /></Field>
          <Field label={repeat === 'weekly' ? 'First lesson' : 'Date'}><input type="date" className={inputCls} style={inputStyle} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} /></Field>
          <Field label="Starts"><input type="time" step={900} className={inputCls} style={inputStyle} value={time} onChange={(e) => e.target.value && setTime(e.target.value)} /></Field>
          <Field label="Length">
            <select className={inputCls} style={inputStyle} value={minutes ?? 'auto'} onChange={(e) => setMinutes(e.target.value === 'auto' ? null : Number(e.target.value))}>
              <option value="auto">{chosen.length === 1 ? `${chosen[0].name.split(' ')[0]}’s length (${autoMinutes} min)` : `Studio default (${settings.defaultLessonMinutes} min)`}</option>
              {LENGTH_CHOICES.map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
          </Field>
          <Field label="Tag">
            <select className={inputCls} style={inputStyle} value={effTag} onChange={(e) => setTagId(e.target.value)}>
              {settings.tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Where"><input className={inputCls} style={inputStyle} value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Studio, online, the hall…" /></Field>
        </div>
        {error && <p className="text-[13px]" style={{ color: 'var(--clay-danger)' }}>{error}</p>}
        <div className="flex justify-end"><Btn kind="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Add to calendar'}</Btn></div>
      </div>
    </Modal>
  )
}
