import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Target } from 'lucide-react'
import Sticker from '@/components/stickers/Sticker'
import BadgeArt from '@/components/badges/BadgeArt'
import { format, startOfWeek, startOfMonth } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { getAnalyticsSummary, computeStreak } from '@/lib/utils/analytics'
import { BADGES } from '@/lib/utils/progression'
import { useGamification } from '@/hooks/useGamification'
import { getTheme } from '@/lib/utils/instruments'
import { updateUserProfile } from '@/lib/firebase/teacher'
import Card from '@/components/ui/Card'
import ProgressRing from '@/components/ui/ProgressRing'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useState } from 'react'
import type { InstrumentType } from '@/types'


export default function GoalsPanel() {
  const { profile } = useAuth()
  const { sessions } = usePracticeStore()
  const game = useGamification()
  const theme = getTheme(profile?.instrument as InstrumentType | undefined)
  const [editGoals, setEditGoals] = useState(false)
  const [weeklyGoal, setWeeklyGoal] = useState(profile?.weeklyGoalMinutes ?? 300)
  const [saving, setSaving] = useState(false)

  const summary = useMemo(() => getAnalyticsSummary(sessions, profile?.weeklyGoalMinutes ?? 300), [sessions, profile])
  const { current: streak } = useMemo(() => computeStreak(sessions), [sessions])

  const weekTotal = useMemo(() => {
    const ws = startOfWeek(new Date())
    return sessions.filter((s) => new Date(s.date) >= ws).reduce((a, s) => a + s.durationMinutes, 0)
  }, [sessions])

  const monthTotal = useMemo(() => {
    const ms = startOfMonth(new Date())
    return sessions.filter((s) => new Date(s.date) >= ms).reduce((a, s) => a + s.durationMinutes, 0)
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

  const rings = [
    { label: 'Today', pct: todayPct, value: todayMinutes, goal: dailyGoal, size: 100 },
    { label: 'This Week', pct: weekPct, value: weekTotal, goal: weeklyGoal, size: 130 },
    { label: 'This Month', pct: monthPct, value: monthTotal, goal: monthGoal, size: 100 },
  ]

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clay-dim)' }}>
          Your week
        </p>
        <Button size="sm" variant="outline" onClick={() => setEditGoals(!editGoals)}>
          <Target size={14} /> {editGoals ? 'Cancel' : 'Edit goal'}
        </Button>
      </div>

      {editGoals && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <Card className="p-5 mb-6 space-y-4">
            <p className="text-sm font-semibold text-[var(--clay-ink)]">Weekly Practice Goal</p>
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
          </Card>
        </motion.div>
      )}

      {/* Progress rings */}
      <div className="flex items-center justify-around py-8 bg-[var(--clay-bg)] rounded-2xl border border-[var(--clay-line)] mb-8">
        {rings.map((ring, i) => (
          <motion.div key={ring.label} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }} className="flex flex-col items-center gap-3">
            <ProgressRing percentage={ring.pct} size={ring.size} strokeWidth={ring.size === 130 ? 12 : 9} color={theme.primary}>
              <div className="text-center">
                <p className="text-base font-bold text-[var(--clay-ink)]">{ring.pct}%</p>
              </div>
            </ProgressRing>
            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--clay-ink)]">{ring.label}</p>
              <p className="text-xs text-[var(--clay-dim)]">{ring.value}/{ring.goal} min</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Streak */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="p-5 text-center space-y-2">
          <div className="flex justify-center"><Sticker name="bolt" size={28} tone="accent" /></div>
          <p className="text-3xl font-bold text-[var(--clay-ink)]">{streak}</p>
          <p className="text-xs text-[var(--clay-dim)] uppercase tracking-wide">Current Streak</p>
        </Card>
        <Card className="p-5 text-center space-y-2">
          <div className="flex justify-center"><Sticker name="star" size={28} tone="accent" /></div>
          <p className="text-3xl font-bold text-[var(--clay-ink)]">{summary.longestStreak}</p>
          <p className="text-xs text-[var(--clay-dim)] uppercase tracking-wide">Longest Streak</p>
        </Card>
        <Card className="p-5 text-center space-y-2">
          <div className="flex justify-center"><Sticker name="trophy" size={28} tone="accent" /></div>
          <p className="text-3xl font-bold text-[var(--clay-ink)]">{earnedIds.size}</p>
          <p className="text-xs text-[var(--clay-dim)] uppercase tracking-wide">Badges Earned</p>
        </Card>
      </div>

      {/* Badges */}
      <div>
        <p className="text-xs font-semibold text-[var(--clay-dim)] uppercase tracking-widest mb-4">Achievement Badges</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {BADGES.map((badge, i) => {
            const earned = earnedIds.has(badge.id)
            return (
              <motion.div key={badge.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                {/* Art-forward: the badge IS the tile. Locked state is drawn,
                    not filtered, so unlocking reads as colour arriving. */}
                <Card className="relative p-4 pt-5 text-center">
                  {earned && (
                    <Sticker name="check" size={18} tone="accent" className="absolute right-3 top-3" />
                  )}
                  <div className="flex justify-center">
                    <BadgeArt name={badge.id} size={76} locked={!earned} />
                  </div>
                  <p
                    className="mt-2.5 text-sm font-semibold"
                    style={{ color: earned ? 'var(--clay-ink)' : 'var(--clay-dim)' }}
                  >
                    {badge.label}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--clay-faint)]">
                    {badge.description}
                  </p>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
