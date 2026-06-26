import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { getDailyData, getWeeklyData, getMonthlyData, getCategoryData, getHeatmapData, computeConsistencyScore } from '@/lib/utils/analytics'
import { getTheme } from '@/lib/utils/instruments'
import PageHeader from '@/components/common/PageHeader'
import Card from '@/components/ui/Card'
import PracticeBarChart from '@/components/charts/PracticeBarChart'
import TrendLineChart from '@/components/charts/TrendLineChart'
import CategoryPieChart from '@/components/charts/CategoryPieChart'
import PracticeHeatmap from '@/components/charts/PracticeHeatmap'
import type { InstrumentType } from '@/types'

export default function AnalyticsPage() {
  const { profile } = useAuth()
  const { sessions } = usePracticeStore()
  const theme = getTheme(profile?.instrument as InstrumentType | undefined)

  const daily30 = useMemo(() => getDailyData(sessions, 30), [sessions])
  const daily7 = useMemo(() => getDailyData(sessions, 7), [sessions])
  const weekly = useMemo(() => getWeeklyData(sessions, 12), [sessions])
  const monthly = useMemo(() => getMonthlyData(sessions, 6), [sessions])
  const categoryData = useMemo(() => getCategoryData(sessions), [sessions])
  const heatmap = useMemo(() => getHeatmapData(sessions), [sessions])
  const consistency = useMemo(() => computeConsistencyScore(sessions), [sessions])
  const totalMinutes = useMemo(() => sessions.reduce((s, p) => s + p.durationMinutes, 0), [sessions])
  const avgConfidence = useMemo(() => {
    if (!sessions.length) return 0
    return Math.round(sessions.reduce((s, p) => s + p.confidenceRating, 0) / sessions.length * 10) / 10
  }, [sessions])

  const charts = [
    { title: 'Daily Practice (Last 7 Days)', component: <PracticeBarChart data={daily7} color={theme.primary} /> },
    { title: 'Daily Practice (Last 30 Days)', component: <PracticeBarChart data={daily30} color={theme.secondary} /> },
    { title: 'Weekly Trend (12 Weeks)', component: <TrendLineChart data={weekly} color={theme.primary} /> },
    { title: 'Monthly Trend (6 Months)', component: <TrendLineChart data={monthly} color={theme.secondary} /> },
  ]

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Deep dive into your practice data." />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Sessions', value: sessions.length },
          { label: 'Total Hours', value: `${Math.round(totalMinutes / 60)}h` },
          { label: 'Avg Confidence', value: `${avgConfidence}/10` },
          { label: 'Consistency Score', value: `${consistency}%` },
        ].map((kpi, i) => (
          <Card key={i} className="p-4 text-center space-y-1">
            <p className="text-2xl font-bold text-white">{kpi.value}</p>
            <p className="text-xs text-slate-400">{kpi.label}</p>
          </Card>
        ))}
      </div>

      {/* Practice charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {charts.map((chart, i) => (
          <Card key={i} className="p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">{chart.title}</p>
            {chart.component}
          </Card>
        ))}
      </div>

      {/* Category distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Practice Category Distribution</p>
          <CategoryPieChart data={categoryData} />
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Category Breakdown</p>
          <div className="space-y-3 mt-2">
            {categoryData.sort((a, b) => b.minutes - a.minutes).map((cat, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>{cat.category}</span>
                  <span>{cat.minutes} min ({cat.percentage}%)</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${cat.percentage}%`, backgroundColor: theme.primary }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Heatmap */}
      <Card className="p-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Full Year Practice Heatmap</p>
        <PracticeHeatmap data={heatmap} color={theme.primary} />
      </Card>
    </div>
  )
}
