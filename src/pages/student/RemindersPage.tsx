import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Bell, BellOff, Clock, Target, Music, Flame } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { updateUserProfile } from '@/lib/firebase/teacher'
import { getAnalyticsSummary } from '@/lib/utils/analytics'
import PageHeader from '@/components/common/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'

export default function RemindersPage() {
  const { profile } = useAuth()
  const { sessions, pieces } = usePracticeStore()
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(profile?.reminderEnabled ?? false)
  const [time, setTime] = useState(profile?.reminderTime ?? '18:00')

  const summary = useMemo(() => getAnalyticsSummary(sessions, profile?.weeklyGoalMinutes ?? 300), [sessions, profile])

  const smartReminders = useMemo(() => {
    const msgs: { icon: React.ReactNode; text: string; type: 'info' | 'warning' | 'success' }[] = []

    const minsLeft = (profile?.weeklyGoalMinutes ?? 300) - summary.totalMinutesThisWeek
    if (minsLeft > 0 && minsLeft <= 60) {
      msgs.push({ icon: <Target size={14} />, text: `You are only ${minsLeft} minutes away from reaching your weekly goal!`, type: 'success' })
    }

    if (summary.currentStreak > 0) {
      msgs.push({ icon: <Flame size={14} />, text: `Keep your ${summary.currentStreak}-day streak alive — practice today!`, type: 'warning' })
    }

    const neglectedPieces = pieces.filter((p) => {
      if (p.status !== 'active') return false
      const lastPracticed = sessions.filter((s) => s.pieceName?.toLowerCase() === p.title.toLowerCase())
        .sort((a, b) => b.date.localeCompare(a.date))[0]
      if (!lastPracticed) return true
      const days = Math.floor((Date.now() - new Date(lastPracticed.date).getTime()) / 86400000)
      return days >= 5
    })
    for (const piece of neglectedPieces.slice(0, 2)) {
      msgs.push({ icon: <Music size={14} />, text: `You have not practiced "${piece.title}" in 5+ days.`, type: 'info' })
    }

    return msgs
  }, [sessions, pieces, profile, summary])

  async function saveSettings() {
    if (!profile) return
    setSaving(true)
    try {
      await updateUserProfile(profile.uid, { reminderEnabled: enabled, reminderTime: time })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="Reminders" subtitle="Never miss a practice session." />

      {/* Settings card */}
      <Card className="p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="font-semibold text-white">Daily Practice Reminder</p>
            <p className="text-sm text-slate-400 mt-0.5">Get notified to practice every day at your chosen time</p>
          </div>
          <button
            onClick={() => setEnabled((e) => !e)}
            className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>

        {enabled && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4">
            <Input
              label="Reminder Time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="max-w-[200px]"
            />
            <p className="text-xs text-slate-500">Browser notifications must be enabled. MaestroTrack will remind you at {time} daily.</p>
          </motion.div>
        )}

        <Button onClick={saveSettings} loading={saving} className="mt-4" size="sm">Save Settings</Button>
      </Card>

      {/* Smart reminders */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Smart Reminders</p>
        {smartReminders.length === 0 ? (
          <Card className="p-8 text-center">
            <BellOff className="mx-auto text-slate-600 mb-3" size={32} />
            <p className="text-slate-400 text-sm">All caught up! No urgent reminders right now.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {smartReminders.map((r, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
                <Card className="p-4 flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl shrink-0 ${r.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : r.type === 'warning' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    {r.icon}
                  </div>
                  <p className="text-sm text-slate-300 flex-1">{r.text}</p>
                  <Badge variant={r.type === 'success' ? 'success' : r.type === 'warning' ? 'warning' : 'info'} size="sm">
                    {r.type}
                  </Badge>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
