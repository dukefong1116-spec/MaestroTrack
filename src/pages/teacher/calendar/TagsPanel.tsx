import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStudioSettings } from '@/hooks/useStudioData'
import { saveStudioSettings } from '@/lib/firebase/studio'
import { TAG_SWATCHES } from '@/lib/studio/settings'
import { inputCls } from '@/components/teacher/studio/tokens'
import type { CalendarTag } from '@/types'

/**
 * The calendar's tags: what colour a lesson is drawn in. Rename one,
 * recolour it, add your own; a tag nothing uses can be deleted.
 */
export default function TagsPanel({ counts }: { counts: Record<string, number> }) {
  const { profile } = useAuth()
  const settings = useStudioSettings()
  const [editing, setEditing] = useState<string | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  async function save(tags: CalendarTag[]) {
    if (!profile) return
    setError('')
    try { await saveStudioSettings(profile.uid, { tags }) } catch { setError('Could not save the tags.') }
  }
  const update = (id: string, patch: Partial<CalendarTag>) => save(settings.tags.map((t) => (t.id === id ? { ...t, ...patch } : t)))

  function add() {
    const id = `tag-${Date.now().toString(36)}`
    void save([...settings.tags, { id, name: 'New tag', color: '#1F8A96' }])
    setEditing(id)
  }

  function commitName(id: string) {
    const v = names[id]
    if (v !== undefined && v.trim()) void update(id, { name: v.trim().slice(0, 40) })
  }

  return (
    <section className="px-5 pb-3 pt-4">
      <div className="mb-1.5 flex items-center">
        <h2 className="flex-1 text-[14px] font-bold" style={{ color: 'var(--clay-ink)' }}>Tags</h2>
        <button type="button" onClick={add} className="px-1 py-1.5 text-[13px] font-bold" style={{ color: 'var(--clay-accent-ink)' }}>+ New tag</button>
      </div>
      {error && <p className="text-[12.5px]" style={{ color: 'var(--clay-danger)' }}>{error}</p>}
      {settings.tags.map((t) => {
        const open = editing === t.id
        const used = counts[t.id] ?? 0
        return (
          <div key={t.id} style={{ borderTop: '1px solid var(--clay-line)' }}>
            <button
              type="button"
              aria-expanded={open}
              aria-label={`Edit the ${t.name} tag`}
              onClick={() => { if (open) commitName(t.id); setEditing(open ? null : t.id) }}
              className="flex w-full items-center gap-2.5 py-2.5 text-left"
            >
              <span className="h-3 w-3 shrink-0 rounded" style={{ background: t.color }} aria-hidden="true" />
              <span className="flex-1 truncate text-[13.5px] font-semibold" style={{ color: 'var(--clay-ink)' }}>{t.name}</span>
              <span className="text-[12px]" style={{ color: 'var(--clay-dim)' }}>{used}</span>
            </button>
            {open && (
              <div className="mb-2.5 space-y-2.5 rounded-xl p-2.5" style={{ background: 'var(--clay-bg)' }}>
                <label className="block text-[12px]" style={{ color: 'var(--clay-dim)' }}>
                  Name
                  <input
                    className={`${inputCls} mt-1`}
                    style={{ background: '#fff', color: 'var(--clay-ink)' }}
                    value={names[t.id] ?? t.name}
                    maxLength={40}
                    onChange={(e) => setNames({ ...names, [t.id]: e.target.value })}
                    onBlur={() => commitName(t.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { commitName(t.id); setEditing(null) } }}
                  />
                </label>
                <div role="group" aria-label="Tag colour" className="flex flex-wrap gap-1.5">
                  {TAG_SWATCHES.map((s) => {
                    const on = s.color.toLowerCase() === t.color.toLowerCase()
                    return (
                      <button
                        key={s.color}
                        type="button"
                        aria-label={`${s.name}${on ? ', chosen' : ''}`}
                        aria-pressed={on}
                        onClick={() => update(t.id, { color: s.color })}
                        className="h-[30px] w-[30px] rounded-full"
                        style={{ background: s.color, border: `3px solid ${on ? 'var(--clay-ink)' : '#fff'}`, boxShadow: '0 0 0 1px var(--clay-line)' }}
                      />
                    )
                  })}
                </div>
                <div className="flex items-center">
                  {used === 0 && settings.tags.length > 1 && (
                    <button type="button" onClick={() => { void save(settings.tags.filter((x) => x.id !== t.id)); setEditing(null) }} className="py-1 text-[12.5px] font-semibold" style={{ color: '#B3263C' }}>
                      Delete tag
                    </button>
                  )}
                  <span className="flex-1" />
                  <button type="button" onClick={() => { commitName(t.id); setEditing(null) }} className="rounded-[9px] bg-white px-3 py-1.5 text-[12.5px] font-bold" style={{ color: 'var(--clay-ink)' }}>Done</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
