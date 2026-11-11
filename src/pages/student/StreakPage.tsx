import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Snowflake, Music, RotateCcw } from 'lucide-react'
import { Panel, Block, Legend } from '@/components/ui/Panel'
import StreakFlame, { type FlameState } from '@/components/icons/StreakFlame'
import StreakRulesEditor from '@/components/streak/StreakRulesEditor'
import { useAuth } from '@/hooks/useAuth'
import { useStreak } from '@/hooks/useStreak'
import { FLAME_LOOKS, lookFor } from '@/lib/streak/looks'
import {
  addDays, dowOf, ruleOn, cleanRules, freezesToSpend, MAX_FREEZES, DAYS_PER_FREEZE, type StreakDay,
} from '@/lib/streak/engine'
import { currentRules, type RuleChoice } from '@/lib/streak/plan'
import { saveRuleChoice } from '@/lib/streak/save'

/**
 * Your streak, all of it: the flame, the month, your freezes, the looks
 * still to unlock, and the rules you set for yourself.
 *
 * Reads only, apart from the rules — freezes and comebacks are decided by
 * the app (useStreakUpkeep), never by a tap here.
 */

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_NAMES = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays']
const ICE = '#2F6FA8'

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function StreakPage() {
  const { profile } = useAuth()
  const live = useStreak()
  const today = live.today
  const [month, setMonth] = useState(today.slice(0, 7))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const byDate = useMemo(() => new Map(live.days.map((d) => [d.date, d])), [live.days])
  const firstMonth = (live.days[0]?.date ?? today).slice(0, 7)
  const plan = useMemo(() => cleanRules(profile?.streakRules), [profile?.streakRules])
  const ruleState = useMemo(() => currentRules(profile?.streakRules, today), [profile?.streakRules, today])
  const chosen = ruleState.next ?? ruleState.now
  const pending = chosen.min !== ruleState.now.min || chosen.lessonDay !== ruleState.now.lessonDay

  const state: FlameState = live.todayLit ? 'lit' : live.flameFrozen ? 'frozen' : 'unlit'
  const look = lookFor(Math.max(1, live.current))
  const min = live.todayRule.min
  const amount = min <= 0 ? 'today' : live.todayMinutes > 0 ? `${Math.max(1, min - live.todayMinutes)} more min` : `${min} min`
  const lessonToday = live.todayRule.lessonDay === dowOf(today)
  const comeback = live.comeback && !live.comeback.complete && freezesToSpend(live).length === 0 ? live.comeback : null

  const sub = live.todayLit
    ? "Today's lit. See you tomorrow."
    : live.flameFrozen
      ? `Frozen. Practise ${amount} to thaw it.`
      : lessonToday
        ? 'Lesson day: your streak holds today. Practice still counts.'
        : live.current > 0
          ? `Practise ${amount} to light today.`
          : 'Practise today to start a streak.'

  async function choose(next: RuleChoice) {
    setSaving(true)
    setSaveError('')
    try {
      await saveRuleChoice(next)
    } catch {
      setSaveError("Couldn't save that. Try again.")
    } finally {
      setSaving(false)
    }
  }

  // The month grid, Monday first.
  const cells = useMemo(() => {
    const first = `${month}-01`
    const lead = dowOf(first)
    const out: (string | null)[] = Array.from({ length: lead }, () => null)
    for (let d = first; d.slice(0, 7) === month; d = addDays(d, 1)) out.push(d)
    return out
  }, [month])

  return (
    <div className="space-y-4">
      <Link to="/student" className="inline-flex items-center gap-1 px-1 text-[13px] font-semibold" style={{ color: 'var(--clay-accent-ink)' }}>
        <ChevronLeft size={16} /> Today
      </Link>

      <Panel>
        <Block first>
          <div className="flex flex-col items-center py-2 text-center">
            <div className="flex h-[108px] items-center justify-center">
              <StreakFlame streak={live.current} size={88} state={state} />
            </div>
            <p className="mt-3 text-[44px] font-bold leading-none tabular-nums" style={{ color: state === 'frozen' ? ICE : 'var(--clay-ink)' }}>
              {live.current}
            </p>
            <p className="mt-1 text-[13px]" style={{ color: 'var(--clay-dim)' }}>
              day streak · best {Math.max(live.longest, live.current)}
            </p>
            {live.current > 0 && (
              <span className="mt-2 rounded-full px-3 py-1 text-[11.5px] font-semibold" style={{ background: 'var(--clay-bg-deep)', color: 'var(--clay-ink)' }}>
                {look.name} flame
              </span>
            )}
            <p className="mt-3 max-w-xs text-[13.5px]" style={{ color: state === 'frozen' ? ICE : 'var(--clay-dim)' }}>{sub}</p>
          </div>
          {comeback && (
            <div className="mt-3 rounded-2xl px-4 py-3" style={{ background: 'rgba(242,163,58,.14)', color: '#9A5A0C' }}>
              <p className="flex items-center gap-1.5 text-[13.5px] font-semibold"><RotateCcw size={14} /> Bring back your {comeback.restore}-day streak</p>
              <p className="mt-0.5 text-[12.5px]">{comeback.done === 0 ? "Practise today and tomorrow, and it's back." : "Practise today and it's back. 1 of 2 done."} One comeback a month.</p>
            </div>
          )}
        </Block>

        <Block>
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              disabled={month <= firstMonth}
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              className="rounded-full p-1.5 disabled:opacity-25"
              style={{ color: 'var(--clay-ink)' }}
            >
              <ChevronLeft size={18} />
            </button>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--clay-ink)' }}>{monthLabel(month)}</p>
            <button
              type="button"
              aria-label="Next month"
              disabled={month >= today.slice(0, 7)}
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              className="rounded-full p-1.5 disabled:opacity-25"
              style={{ color: 'var(--clay-ink)' }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-y-1.5 text-center">
            {LETTERS.map((l, i) => (
              <span key={i} className="text-[10.5px] font-bold" style={{ color: 'var(--clay-faint)' }}>{l}</span>
            ))}
            {cells.map((date, i) => (
              <div key={date ?? `x${i}`} className="flex justify-center">
                {date && (
                  <DayCell
                    date={date}
                    day={byDate.get(date)}
                    today={today}
                    lesson={ruleOn(plan, date).lessonDay === dowOf(date)}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11.5px]" style={{ color: 'var(--clay-dim)' }}>
            <span className="flex items-center gap-1"><StreakFlame streak={9} size={12} still /> practised</span>
            <span className="flex items-center gap-1" style={{ color: ICE }}><Snowflake size={12} /> frozen</span>
            <span className="flex items-center gap-1"><Music size={12} /> lesson day</span>
          </div>
        </Block>

        <Block>
          <Legend title="Freezes" />
          <div className="flex items-center gap-2">
            {Array.from({ length: MAX_FREEZES }, (_, i) => (
              <span
                key={i}
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={i < live.held
                  ? { background: 'rgba(120,180,240,.22)', color: ICE }
                  : { border: '1.5px dashed rgba(58,48,84,.2)', color: 'var(--clay-faint)' }}
              >
                <Snowflake size={18} />
              </span>
            ))}
            <span className="ml-1 text-[14px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
              {live.held} of {MAX_FREEZES}
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--clay-bg-deep)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${live.nextFreezeIn === null ? 100 : Math.round(((DAYS_PER_FREEZE - live.nextFreezeIn) / DAYS_PER_FREEZE) * 100)}%`,
                background: '#7DB4EA',
              }}
            />
          </div>
          <p className="mt-2 text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>
            {live.nextFreezeIn === null
              ? 'Freezes full.'
              : `Next freeze in ${live.nextFreezeIn} day${live.nextFreezeIn === 1 ? '' : 's'}.`}
            {' '}You earn one for every {DAYS_PER_FREEZE} days in a row. Miss a day and one freezes your flame, keeping the streak safe.
          </p>
        </Block>

        <Block>
          <Legend title="Your flame grows with your streak" />
          <div className="flex justify-between px-1">
            {FLAME_LOOKS.map((l) => {
              const reached = live.current >= l.at
              const current = reached && look.id === l.id && live.current > 0
              return (
                <div key={l.id} className="flex flex-col items-center gap-1">
                  <StreakFlame streak={reached ? l.at : 0} size={30} still />
                  <span className="text-[11px] font-semibold" style={{ color: current ? 'var(--clay-ink)' : 'var(--clay-faint)' }}>
                    {l.name}
                  </span>
                  <span className="text-[10.5px]" style={{ color: 'var(--clay-faint)' }}>{l.at}+</span>
                </div>
              )
            })}
          </div>
        </Block>

        <Block>
          <Legend title="Your streak rules" />
          <StreakRulesEditor value={chosen} onChange={(v) => void choose(v)} pending={pending} />
          {(saving || saveError) && (
            <p className="mt-2 text-[12px]" style={{ color: saveError ? 'var(--clay-danger-fg)' : 'var(--clay-dim)' }}>
              {saveError || 'Saving…'}
            </p>
          )}
          <p className="mt-3 text-[12px]" style={{ color: 'var(--clay-dim)' }}>
            {ruleState.now.lessonDay !== null ? `Lesson day: ${DAY_NAMES[ruleState.now.lessonDay]}. ` : ''}
            Miss a day with no freezes left and you get one comeback a month: practise the next two days and the streak comes back.
          </p>
        </Block>
      </Panel>
    </div>
  )
}

function DayCell({ date, day, today, lesson }: { date: string; day?: StreakDay; today: string; lesson: boolean }) {
  const n = Number(date.slice(8))
  const isToday = date === today
  const base = 'flex h-9 w-9 items-center justify-center rounded-full text-[12px] tabular-nums'
  const status = day?.status

  if (status === 'done') {
    return (
      <span className={base} title={`${date} · practised`} style={isToday ? { boxShadow: '0 0 0 1.5px var(--clay-accent)' } : undefined}>
        <StreakFlame streak={Math.max(1, day!.streak)} size={20} still />
      </span>
    )
  }
  if (status === 'frozen') {
    return <span className={base} title={`${date} · frozen`} style={{ background: 'rgba(120,180,240,.22)', color: ICE }}><Snowflake size={15} /></span>
  }
  if (status === 'repaired') {
    return (
      <span className={base} title={`${date} · brought back`} style={{ border: '1.5px dashed rgba(242,163,58,.7)' }}>
        <RotateCcw size={13} style={{ color: '#C07A1A' }} />
      </span>
    )
  }
  if (status === 'lesson' || (lesson && date > today)) {
    return (
      <span className={base} title={`${date} · lesson day`} style={{ border: '1.5px dashed rgba(58,48,84,.2)', color: date > today ? 'var(--clay-faint)' : 'var(--clay-dim)' }}>
        <Music size={13} />
      </span>
    )
  }
  if (isToday) {
    return <span className={`${base} font-bold`} style={{ boxShadow: '0 0 0 1.5px var(--clay-accent)', color: 'var(--clay-ink)' }}>{n}</span>
  }
  if (status === 'missed' && day!.minutes > 0) {
    return <span className={base} title={`${date} · under your minimum`} style={{ border: '1.5px dotted rgba(58,48,84,.3)', color: 'var(--clay-dim)' }}>{n}</span>
  }
  return <span className={base} style={{ color: 'var(--clay-faint)' }}>{n}</span>
}
