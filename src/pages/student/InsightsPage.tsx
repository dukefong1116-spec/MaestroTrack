import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Brain, TrendingUp, AlertTriangle, Info } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { generateInsights, getAnalyticsSummary, getCategoryData } from '@/lib/utils/analytics'
import { getTheme } from '@/lib/utils/instruments'
import PageHeader from '@/components/common/PageHeader'
import Card from '@/components/ui/Card'
import CategoryPieChart from '@/components/charts/CategoryPieChart'
import TrendLineChart from '@/components/charts/TrendLineChart'
import { getWeeklyData } from '@/lib/utils/analytics'
import type { InstrumentType } from '@/types'

export default function InsightsPage() {
  const { profile } = useAuth()
  const { sessions, pieces } = usePracticeStore()
  const theme = getTheme(profile?.instrument as InstrumentType | undefined)

  const insights = useMemo(() => generateInsights(sessions, pieces), [sessions, pieces])
  const summary = useMemo(() => getAnalyticsSummary(sessions, profile?.weeklyGoalMinutes ?? 300), [sessions, profile])
  const categories = useMemo(() => getCategoryData(sessions), [sessions])
  const weeklyTrend = useMemo(() => getWeeklyData(sessions, 8), [sessions])

  const iconMap = { positive: TrendingUp, warning: AlertTriangle, info: Info }
  const colorMap = { positive: 'text-emerald-400 bg-emerald-500/10', warning: 'text-amber-400 bg-amber-500/10', info: 'text-blue-400 bg-blue-500/10' }

  return (
    <div>
      <PageHeader title="AI Insights" subtitle="Intelligent analysis of your practice patterns." />

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl p-6 mb-8" style={{ background: `linear-gradient(135deg, ${theme.primary}20, #1e1b4b)`, border: `1px solid ${theme.primary}20` }}>
        <Brain className="absolute right-6 top-6 opacity-10" size={80} style={{ color: theme.primary }} />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">AI Practice Intelligence</p>
        <p className="text-white text-lg font-semibold mb-1">Your practice is {summary.consistencyScore >= 70 ? 'excellent' : summary.consistencyScore >= 40 ? 'developing well' : 'just getting started'}.</p>
        <p className="text-slate-400 text-sm">Based on {sessions.length} sessions and {Math.round(sessions.reduce((s, p) => s + p.durationMinutes, 0) / 60)} total hours of practice.</p>
        <p className="text-xs text-slate-500 mt-3">Insights are computed from your real practice data. Connect an OpenAI API key in settings to enable GPT-powered coaching.</p>
      </div>

      {/* Insight cards */}
      {insights.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {insights.map((insight, i) => {
            const Icon = iconMap[insight.type]
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <Card className="p-5 space-y-3">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${colorMap[insight.type]}`}>
                    <Icon size={14} />
                    <span className="text-xs font-semibold capitalize">{insight.type}</span>
                  </div>
                  <p className="font-semibold text-white">{insight.title}</p>
                  <p className="text-sm text-slate-400">{insight.description}</p>
                </Card>
              </motion.div>
            )
          })}
        </div>
      ) : (
        <Card className="p-8 text-center mb-8">
          <Brain className="mx-auto text-slate-600 mb-3" size={36} />
          <p className="text-slate-400">Log more practice sessions to generate personalized insights.</p>
        </Card>
      )}

      {/* Trend + Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Weekly Practice Trend</p>
          <TrendLineChart data={weeklyTrend} color={theme.primary} />
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Practice Distribution</p>
          <CategoryPieChart data={categories} />
        </Card>
      </div>
    </div>
  )
}
