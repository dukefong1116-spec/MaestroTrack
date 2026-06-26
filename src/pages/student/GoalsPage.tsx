import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Target, Trophy, Zap, Star, CheckCircle2 } from 'lucide-react'
import { format, startOfWeek, startOfMonth } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { getAnalyticsSummary, computeStreak } from '@/lib/utils/analytics'
import { getTheme } from '@/lib/utils/instruments'
import { updateUserProfile } from '@/lib/firebase/teacher'
import PageHeader from '@/components/common/PageHeader'
import Card from '@/components/ui/Card'
import ProgressRing from '@/components/ui/ProgressRing'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useState } from 'react'
import type { InstrumentType } from '@/types'

const BADGES = [
  { id: 'first_session', label: 'First Note', icon: '🎵', description: 'Logged your first practice session', condition: (sessions: number) => sessions >= 1 },
  { id: 'week_warrior', label: 'Week Warrior', icon: '⚔️', description: 'Practiced every day for a week', condition: (_s: number, streak: number) => streak >= 7 },
  { id: 'century', label: 'Century Club', icon: '💯', description: 'Logged 100 practice sessions', condition: (sessions: number) => sessions >= 100 },
  { id: 'marathon', label: 'Marathon', icon: '🏃', description: 'Practiced for 60+ minutes in one session', condition: (_s: number, _st: number, maxSession: number) => maxSession >= 60 },
  { id: 'consistency', label: 'Iron Discipline', icon: '🎯', description: '30-day streak', condition: (_s: number, streak: number) => streak >= 30 },
  { id: 'ten_hours', label: '10 Hours Strong', icon: '⏰', description: 'Accumulated 600 minutes of practice', condition: (_s: number, _st: number, _m: number, totalMinutes: number) => totalMinutes >= 600 },
]

export default function GoalsPage() {
  const { profile } = useAuth()
  const { sessions } = usePracticeStore()
  const theme = getTheme(profile?.instrument as InstrumentType | undefined)
  const [editGoals, setEditGoals] = useState(false)
  const [weeklyGoal, setWeeklyGoal] = useState(profile?.weeklyGoalMinutes ?? 300)
  const [saving, setSaving] = useState(false)

  const summary = useMemo(() => getAnalyticsSummary(sessions, profile?.weeklyGoalMinutes ?? 300), [sessions, profile])
  const { current: streak } = useMemo(() => computeStreak(sessions), [sessions])
  const totalMinutes = useMemo(() => sessions.reduce((s, p) => s + p.durationMinutes, 0), [sessions])
  const maxSession = useMemo(() => sessions.reduce((m, s) => Math.max(m, s.durationMinutes), 0), [sessions])

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

  const earnedBadges = BADGES.filter((b) => b.condition(sessions.length, streak, maxSession, totalMinutes))

  const rings = [
    { label: 'Today', pct: todayPct, value: todayMinutes, goal: dailyGoal, size: 100 },
    { label: 'This Week', pct: weekPct, value: weekTotal, goal: weeklyGoal, size: 130 },
    { label: 'This Month', pct: monthPct, value: monthTotal, goal: monthGoal, size: 100 },
  ]

  return (
    <div>
      <PageHeader
        title="Goals & Achievements"
        subtitle="Set targets, track progress, earn badges."
        actions={<Button size="sm" variant="outline" onClick={() => setEditGoals(!editGoals)}><Target size={14} /> {editGoals ? 'Cancel' : 'Edit Goals'}</Button>}
      />

      {editGoals && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <Card className="p-5 mb-6 space-y-4">
            <p className="text-sm font-semibold text-white">Weekly Practice Goal</p>
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
      <div className="flex items-center justify-around py-8 bg-slate-900/40 rounded-2xl border border-slate-800/60 mb-8">
        {rings.map((ring, i) => (
          <motion.div key={ring.label} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }} className="flex flex-col items-center gap-3">
            <ProgressRing percentage={ring.pct} size={ring.size} strokeWidth={ring.size === 130 ? 12 : 9} color={theme.primary}>
              <div className="text-center">
                <p className="text-base font-bold text-white">{ring.pct}%</p>
              </div>
            </ProgressRing>
            <div className="text-center">
              <p className="text-sm font-semibold text-white">{ring.label}</p>
              <p className="text-xs text-slate-400">{ring.value}/{ring.goal} min</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Streak */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="p-5 text-center space-y-2">
          <Zap className="mx-auto text-amber-400" size={28} />
          <p className="text-3xl font-bold text-white">{streak}</p>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Current Streak</p>
        </Card>
        <Card className="p-5 text-center space-y-2">
          <Star className="mx-auto text-indigo-400" size={28} />
          <p className="text-3xl font-bold text-white">{summary.longestStreak}</p>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Longest Streak</p>
        </Card>
        <Card className="p-5 text-center space-y-2">
          <Trophy className="mx-auto text-emerald-400" size={28} />
          <p className="text-3xl font-bold text-white">{earnedBadges.length}</p>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Badges Earned</p>
        </Card>
      </div>

      {/* Badges */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Achievement Badges</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {BADGES.map((badge, i) => {
            const earned = badge.condition(sessions.length, streak, maxSession, totalMinutes)
            return (
              <motion.div key={badge.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className={`p-4 space-y-2 transition-all ${earned ? '' : 'opacity-40 grayscale'}`}>
                  <div className="flex items-start justify-between">
                    <span className="text-3xl">{badge.icon}</span>
                    {earned && <CheckCircle2 size={16} className="text-emerald-400" />}
                  </div>
                  <p className="font-semibold text-white text-sm">{badge.label}</p>
                  <p className="text-xs text-slate-400">{badge.description}</p>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
