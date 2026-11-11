import type { RuleChoice } from '@/lib/streak/plan'

const MINUTES = [0, 5, 10, 15, 20, 30, 45, 60]
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-transform active:scale-95"
      style={{
        background: on ? 'var(--clay-accent)' : 'var(--clay-bg-deep)',
        color: on ? 'var(--clay-on-accent)' : 'var(--clay-ink)',
      }}
    >
      {label}
    </button>
  )
}

/**
 * Your daily minimum and lesson day.
 *
 * Controlled: the caller decides when to save. Choices start tomorrow, so
 * today — already under way — keeps the rules it began with.
 */
export default function StreakRulesEditor({
  value,
  onChange,
  pending,
}: {
  value: RuleChoice
  onChange: (next: RuleChoice) => void
  /** A change is chosen that has not started yet. */
  pending?: boolean
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--clay-ink)' }}>Daily minimum</p>
        <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>
          A day counts toward your streak once you practise this much.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MINUTES.map((m) => (
            <Chip
              key={m}
              on={value.min === m}
              label={m === 0 ? 'Any' : `${m} min`}
              onClick={() => onChange({ ...value, min: m })}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--clay-ink)' }}>Lesson day</p>
        <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>
          Skip practice on your lesson day and your streak holds. Practise anyway and it counts.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip on={value.lessonDay === null} label="None" onClick={() => onChange({ ...value, lessonDay: null })} />
          {DAYS.map((d, i) => (
            <Chip key={d} on={value.lessonDay === i} label={d} onClick={() => onChange({ ...value, lessonDay: i })} />
          ))}
        </div>
      </div>
      {pending && (
        <p className="text-[12.5px] font-semibold" style={{ color: 'var(--clay-dim)' }}>
          Starts tomorrow, so today and past days keep the rules they had.
        </p>
      )}
    </div>
  )
}
