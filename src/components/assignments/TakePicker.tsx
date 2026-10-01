import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import Sticker from '@/components/stickers/Sticker'
import { usePracticeStore } from '@/stores/practiceStore'
import type { Recording } from '@/types'

/**
 * Choose recordings to hand in.
 *
 * Picks from takes already captured during practice rather than offering a
 * second recorder. A musician records several attempts and submits the one
 * that went best — asking them to perform again, into a different button,
 * for the teacher's benefit, produces a worse take and more anxiety.
 */
export default function TakePicker({
  selected, onChange, limit = 12,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
  limit?: number
}) {
  const recordings = usePracticeStore((s) => s.recordings)

  const recent = useMemo<Recording[]>(
    () => [...recordings]
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      .slice(0, limit),
    [recordings, limit]
  )

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  if (recent.length === 0) {
    return (
      <p className="text-[12.5px]" style={{ color: 'var(--clay-faint)' }}>
        No recordings yet. You can hand this in without one — record a take during a
        session if you'd like your teacher to hear it.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {recent.map((r) => {
        const on = selected.includes(r.id)
        return (
          <button
            key={r.id}
            onClick={() => toggle(r.id)}
            aria-pressed={on}
            className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors"
            style={{
              background: on ? 'var(--clay-accent-soft)' : 'var(--clay-bg)',
              borderRadius: 'var(--clay-r-sm)',
            }}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{
                background: on ? 'var(--clay-accent)' : 'var(--clay-bg-deep)',
                color: on ? 'var(--clay-on-accent)' : 'var(--clay-dim)',
              }}
            >
              <Sticker name={on ? 'check' : 'mic'} size={14} tone={on ? 'onAccent' : 'ink'} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
                {r.pieceName}
              </span>
              <span className="block text-[11px]" style={{ color: 'var(--clay-dim)' }}>
                {r.date ? format(parseISO(r.date.substring(0, 10)), 'MMM d') : ''}
                {r.duration != null && ` · ${Math.floor(r.duration / 60)}:${String(r.duration % 60).padStart(2, '0')}`}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
