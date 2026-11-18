import type { RuleChoice } from '@/lib/streak/plan'

const MINUTES = [0, 5, 10, 15, 20, 30, 45, 60]
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const selectCls = 'min-h-[40px] min-w-[132px] rounded-[10px] border-0 px-3 text-[14px] font-semibold outline-none focus:ring-2'
const selectStyle = { background: 'var(--clay-bg)', color: 'var(--clay-ink)' }

/**
 * Your daily minimum and lesson day: one drop-down each.
 *
 * Controlled: the caller decides when to save. Choices start tomorrow, so
 * today — already under way — keeps the rules it began with.
 *
 * In a studio the lesson day is not yours to pick: it follows the weekly
 * lesson in your teacher's calendar (useLessonDaySync), so it is shown,
 * not offered.
 */
export default function StreakRulesEditor({
  value,
  onChange,
  inStudio,
}: {
  value: RuleChoice
  onChange: (next: RuleChoice) => void
  /** In a studio: the lesson day comes from the teacher's calendar. */
  inStudio?: boolean
}) {
  return (
    <div>
      <label className="flex items-center gap-3 py-2.5">
        <span className="flex-1 text-[15px] font-semibold" style={{ color: 'var(--clay-ink)' }}>Daily minimum</span>
        <select className={selectCls} style={selectStyle} value={value.min} onChange={(e) => onChange({ ...value, min: Number(e.target.value) })}>
          {MINUTES.map((m) => <option key={m} value={m}>{m === 0 ? 'Any' : `${m} min`}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-3 py-2.5" style={{ borderTop: '1px solid var(--clay-line)' }}>
        <span className="flex-1 text-[15px] font-semibold" style={{ color: 'var(--clay-ink)' }}>Lesson day</span>
        {inStudio ? (
          <span className="text-[14px] font-semibold" style={{ color: 'var(--clay-dim)' }}>
            {value.lessonDay === null ? 'Set by your teacher' : DAYS[value.lessonDay]}
          </span>
        ) : (
          <select
            aria-label="Lesson day"
            className={selectCls}
            style={selectStyle}
            value={value.lessonDay ?? ''}
            onChange={(e) => onChange({ ...value, lessonDay: e.target.value === '' ? null : Number(e.target.value) })}
          >
            <option value="">None</option>
            {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        )}
      </div>
    </div>
  )
}
