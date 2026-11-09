import Sticker, { type StickerName } from '@/components/stickers/Sticker'
import { dueLabel, isDaily, normaliseStatus, awaitingStudent } from '@/lib/utils/assignments'
import type { StudentAssignment } from '@/hooks/useAssignments'

/**
 * One assignment as a row, built so two never look alike at a glance:
 * a tile saying what kind it is, a pill saying how pressing it is, and —
 * for a daily target — a bar showing today's progress.
 */

const KIND: Record<'daily' | 'record' | 'piece' | 'task', { sticker: StickerName; bg: string }> = {
  daily: { sticker: 'flame', bg: 'var(--clay-accent-soft)' },
  record: { sticker: 'mic', bg: 'var(--clay-purple-bg)' },
  piece: { sticker: 'note', bg: 'var(--clay-tint-mint)' },
  task: { sticker: 'clipboard', bg: 'var(--clay-tint-sky)' },
}

type Tone = 'danger' | 'warning' | 'success' | 'purple' | 'neutral'
const TONE: Record<Tone, { bg: string; fg: string }> = {
  danger: { bg: 'var(--clay-danger-bg)', fg: 'var(--clay-danger-fg)' },
  warning: { bg: 'var(--clay-warning-bg)', fg: 'var(--clay-warning-fg)' },
  success: { bg: 'var(--clay-success-bg)', fg: 'var(--clay-success-fg)' },
  purple: { bg: 'var(--clay-purple-bg)', fg: 'var(--clay-purple-fg)' },
  neutral: { bg: 'var(--clay-bg-deep)', fg: 'var(--clay-dim)' },
}

/** The pill: the one thing about this assignment worth knowing first. */
function pillFor(x: StudentAssignment): { text: string; tone: Tone } {
  const a = x.assignment
  const state = normaliseStatus(a.status)
  if (state === 'submitted') return { text: 'Handed in', tone: 'purple' }
  if (state === 'approved') return { text: 'Done ✓', tone: 'success' }
  if (state === 'returned') return { text: 'Another go', tone: 'warning' }
  if (isDaily(a) && awaitingStudent(a) && a.dailyTargetMinutes) {
    const today = x.daily.days.find((d) => d.isToday)?.minutes ?? 0
    const met = today >= a.dailyTargetMinutes
    return { text: `${today}/${a.dailyTargetMinutes} min today`, tone: met ? 'success' : 'warning' }
  }
  if (x.due === 'overdue') return { text: dueLabel(a).replace('Due yesterday', '1 day overdue'), tone: 'danger' }
  if (x.due === 'today') return { text: 'Due today', tone: 'warning' }
  if (a.dueDate) return { text: dueLabel(a), tone: 'neutral' }
  return { text: 'No due date', tone: 'neutral' }
}

function kindOf(x: StudentAssignment): keyof typeof KIND {
  const a = x.assignment
  if (isDaily(a)) return 'daily'
  if (a.requiresRecording) return 'record'
  if (a.pieceId) return 'piece'
  return 'task'
}

export default function AssignmentRow({ item, onOpen }: { item: StudentAssignment; onOpen: () => void }) {
  const a = item.assignment
  const kind = KIND[kindOf(item)]
  const pill = pillFor(item)
  const tone = TONE[pill.tone]
  const detail = a.requiresRecording ? 'Record a take' : a.category ?? ''
  const today = item.daily.days.find((d) => d.isToday)?.minutes ?? 0
  const showBar = isDaily(a) && awaitingStudent(a) && !!a.dailyTargetMinutes

  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 py-2.5 text-left">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center"
        style={{ background: kind.bg, borderRadius: 'var(--clay-r-sm)' }}
      >
        <Sticker name={kind.sticker} size={20} tone="accent" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold" style={{ color: 'var(--clay-ink)' }}>{a.title}</span>
        <span className="mt-1 flex items-center gap-1.5">
          <span
            className="shrink-0 px-2 py-0.5 text-[11px] font-bold"
            style={{ background: tone.bg, color: tone.fg, borderRadius: 999 }}
          >
            {pill.text}
          </span>
          {detail && <span className="truncate text-[11.5px]" style={{ color: 'var(--clay-dim)' }}>{detail}</span>}
        </span>
        {showBar && (
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full" style={{ background: 'var(--clay-bg-deep)' }}>
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.min(100, (today / a.dailyTargetMinutes!) * 100)}%`, background: 'var(--clay-accent)' }}
            />
          </span>
        )}
      </span>
    </button>
  )
}
