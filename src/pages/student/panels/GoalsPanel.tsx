import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Target } from 'lucide-react'
import Sticker from '@/components/stickers/Sticker'
import BadgeArt from '@/components/badges/BadgeArt'
import { format, startOfWeek, startOfMonth, parseISO } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { getAnalyticsSummary, computeStreak } from '@/lib/utils/analytics'
import type { BadgeFamily } from '@/lib/utils/progression'
import { useGamification } from '@/hooks/useGamification'
import { getTheme } from '@/lib/utils/instruments'
import { updateUserProfile } from '@/lib/firebase/teacher'
import BadgeSheet from '@/components/badges/BadgeSheet'
import { usePinnedBadges } from '@/hooks/usePinnedBadges'
import { Block, Legend } from '@/components/ui/Panel'
import ProgressRing from '@/components/ui/ProgressRing'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import type { InstrumentType } from '@/types'

/** Minutes read as hours once there are enough of them to bother. */
function amountShort(value: number, unit: string): string {
  if (unit !== 'minutes') return String(Math.round(value))
  const h = value / 60
  return h >= 1 ? `${Math.round(h * 10) / 10}h` : `${Math.round(value)}m`
}

/**
 * The goals half of Progress.
 *
 * Renders blocks rather than a page: the caller supplies the one panel
 * they all sit in, so goals, patterns and totals read as one surface
 * instead of three stacks of floating cards.
 */
export default function GoalsPanel() {
  const { profile } = useAuth()
  const { sessions } = usePracticeStore()
  const game = useGamification()
  const theme = getTheme(profile?.instrument as InstrumentType | undefined)
  const [editGoals, setEditGoals] = useState(false)
  const [weeklyGoal, setWeeklyGoal] = useState(profile?.weeklyGoalMinutes ?? 300)
  const [saving, setSaving] = useState(false)
  const [openFamily, setOpenFamily] = useState<BadgeFamily | null>(null)
  const { pinned, togglePin } = usePinnedBadges()
  const { families, badgeCtx } = game
  const earnedAt = profile?.badgeEarnedAt ?? {}

  const summary = useMemo(() => getAnalyticsSummary(sessions, profile?.weeklyGoalMinutes ?? 300), [sessions, profile])
  const { current: streak } = useMemo(() => computeStreak(sessions), [sessions])

  const weekTotal = useMemo(() => {
    const ws = startOfWeek(new Date())
    return sessions.filter((s) => parseISO(s.date) >= ws).reduce((a, s) => a + s.durationMinutes, 0)
  }, [sessions])

  const monthTotal = useMemo(() => {
    const ms = startOfMonth(new Date())
    return sessions.filter((s) => parseISO(s.date) >= ms).reduce((a, s) => a + s.durationMinutes, 0)
  }, [sessions])

  const dailyGoal = Math.round(weeklyGoal / 7)
  const monthGoal = weeklyGoal * 4

  const todaySessions = sessions.filter((s) => s.date.startsWith(format(new Date(), 'yyyy-MM-dd')))
  const todayMinutes = todaySessions.reduce((a, s) => a + s.durationMinutes, 0)
  const todayPct = Math.min(100, Math.round((todayMinutes / dailyGoal) * 100))
  const weekPct = Math.min(100, Math.round((weekTotal / weeklyGoal) * 100))
  const monthPct = Math.min(100, Math.round((monthTotal / monthGoal) * 100))

  async function saveGoals() {
    if (!profile) return
    setSaving(true)
    try {
      await updateUserProfile(profile.uid, { weeklyGoalMinutes: weeklyGoal, dailyGoalMinutes: dailyGoal, monthlyGoalMinutes: monthGoal })
    } finally {
      setSaving(false)
      setEditGoals(false)
    }
  }

  const earnedIds = new Set(game.badges.map((b) => b.id))

  // Sized for a phone first: at 92/120/92 the three columns plus their
  // labels ran past the panel edge and "This Month" was cut in half.
  const rings = [
    { label: 'Today', pct: todayPct, value: todayMinutes, goal: dailyGoal, size: 72 },
    { label: 'This Week', pct: weekPct, value: weekTotal, goal: weeklyGoal, size: 96 },
    { label: 'This Month', pct: monthPct, value: monthTotal, goal: monthGoal, size: 72 },
  ]

  const streakStats = [
    { sticker: 'bolt' as const, value: streak, label: 'Current streak' },
    { sticker: 'star' as const, value: summary.longestStreak, label: 'Longest streak' },
    { sticker: 'trophy' as const, value: earnedIds.size, label: 'Badges earned' },
  ]

  return (
    <>
      <Block first>
        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clay-dim)' }}>
            Your week
          </p>
          <Button size="sm" variant="outline" onClick={() => setEditGoals(!editGoals)}>
            <Target size={14} /> {editGoals ? 'Cancel' : 'Edit goal'}
          </Button>
        </div>

        {editGoals && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div
              className="mb-6 space-y-4 p-4"
              style={{ background: 'var(--clay-bg)', borderRadius: 'var(--clay-r-sm)' }}
            >
              <p className="text-sm font-semibold" style={{ color: 'var(--clay-ink)' }}>Weekly practice goal</p>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  value={weeklyGoal}
                  onChange={(e) => setWeeklyGoal(Number(e.target.value))}
                  className="max-w-[160px]"
                  hint={`~${Math.round(weeklyGoal / 7)} min/day`}
                />
                <Button onClick={saveGoals} loading={saving}>Save</Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* A grid, not a flex row: columns keep a long label from pushing
            its neighbour off the edge, and min-w-0 lets it wrap inside its
            own column instead. The middle column sizes to its ring — at an
            equal third the 96px ring was 3px wider than the 91px column it
            had to live in. */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-1">
          {rings.map((ring, i) => (
            <motion.div
              key={ring.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="flex min-w-0 flex-col items-center gap-2.5"
            >
              <ProgressRing percentage={ring.pct} size={ring.size} strokeWidth={ring.size === 96 ? 9 : 7} color={theme.primary}>
                <p className="text-sm font-bold" style={{ color: 'var(--clay-ink)' }}>{ring.pct}%</p>
              </ProgressRing>
              <div className="min-w-0 text-center">
                <p className="text-[12.5px] font-semibold leading-tight" style={{ color: 'var(--clay-ink)' }}>{ring.label}</p>
                <p className="text-[10.5px] tabular-nums leading-tight" style={{ color: 'var(--clay-dim)' }}>{ring.value}/{ring.goal} min</p>
              </div>
            </motion.div>
          ))}
        </div>
      </Block>

      {/* Three numbers, divided by hairlines rather than floated apart. */}
      <Block>
        <div className="grid grid-cols-3">
          {streakStats.map((s, i) => (
            <div
              key={s.label}
              className="flex flex-col items-center gap-1.5 px-1 text-center"
              style={i === 0 ? undefined : { borderLeft: '1px solid var(--clay-line)' }}
            >
              <Sticker name={s.sticker} size={24} tone="accent" />
              <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--clay-ink)' }}>{s.value}</p>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--clay-dim)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </Block>

      <Block>
        <Legend title="Achievement badges" />
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
          {families.map((fam, i) => {
            const got = !!fam.highest
            const pct = Math.round(fam.progress * 100)
            return (
              <motion.button
                key={fam.family}
                type="button"
                onClick={() => setOpenFamily(fam.family)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex flex-col items-center text-center transition-transform active:scale-[.97]"
              >
                {/* Art-forward: the badge IS the tile. Locked state is drawn,
                    not filtered, so unlocking reads as colour arriving. */}
                <BadgeArt name={fam.display.id} size={68} locked={!got} />
                <p
                  className="mt-2 text-sm font-semibold"
                  style={{ color: got ? 'var(--clay-ink)' : 'var(--clay-dim)' }}
                >
                  {fam.display.label}
                </p>

                {fam.next ? (
                  <>
                    <p className="mt-0.5 text-[11px] leading-snug" style={{ color: 'var(--clay-faint)' }}>
                      {amountShort(fam.next.current(badgeCtx), fam.next.unit)} of {amountShort(fam.next.target, fam.next.unit)}
                      {fam.next.unit === 'sessions' ? ' sessions' : fam.next.unit === 'days' ? ' days' : ''}
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--clay-bg-deep)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: 'var(--clay-accent)' }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="mt-0.5 text-[11px] leading-snug" style={{ color: 'var(--clay-faint)' }}>
                    All tiers earned
                  </p>
                )}
              </motion.button>
            )
          })}
        </div>
      </Block>

      <BadgeSheet
        family={families.find((f) => f.family === openFamily) ?? null}
        ctx={badgeCtx}
        pinned={pinned}
        earnedAt={earnedAt}
        onClose={() => setOpenFamily(null)}
        onTogglePin={togglePin}
        onShare={(id) => console.log('share badge', id)}
      />
    </>
  )
}
