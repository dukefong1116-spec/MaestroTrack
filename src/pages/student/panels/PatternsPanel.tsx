import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, AlertTriangle, Info } from 'lucide-react'
import Sticker from '@/components/stickers/Sticker'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { generateInsights, getCategoryData } from '@/lib/utils/analytics'
import { getTheme } from '@/lib/utils/instruments'
import Card from '@/components/ui/Card'
import CategoryPieChart from '@/components/charts/CategoryPieChart'
import TrendLineChart from '@/components/charts/TrendLineChart'
import { getWeeklyData } from '@/lib/utils/analytics'
import type { InstrumentType } from '@/types'

export default function PatternsPanel() {
  const { profile } = useAuth()
  const { sessions, pieces } = usePracticeStore()
  const theme = getTheme(profile?.instrument as InstrumentType | undefined)

  const insights = useMemo(() => generateInsights(sessions, pieces), [sessions, pieces])
  const categories = useMemo(() => getCategoryData(sessions), [sessions])
  const weeklyTrend = useMemo(() => getWeeklyData(sessions, 8), [sessions])

  const iconMap = { positive: TrendingUp, warning: AlertTriangle, info: Info }
  const colorMap = { positive: 'text-emerald-600 bg-emerald-50', warning: 'text-amber-600 bg-amber-50', info: 'text-blue-600 bg-blue-50' }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clay-dim)' }}>
          Patterns
        </p>
        <p className="text-xs" style={{ color: 'var(--clay-faint)' }}>
          from {sessions.length} logged session{sessions.length === 1 ? '' : 's'}
        </p>
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
                  <p className="font-semibold text-[var(--clay-ink)]">{insight.title}</p>
                  <p className="text-sm text-[var(--clay-dim)]">{insight.description}</p>
                </Card>
              </motion.div>
            )
          })}
        </div>
      ) : (
        <Card className="p-8 text-center mb-8">
          <div className="mb-3 flex justify-center"><Sticker name="brain" size={36} tone="ink" /></div>
          <p className="text-[var(--clay-dim)]">Log more practice sessions to generate personalized insights.</p>
        </Card>
      )}

      {/* Trend + Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-xs font-semibold text-[var(--clay-dim)] uppercase tracking-widest mb-4">Weekly Practice Trend</p>
          <TrendLineChart data={weeklyTrend} color={theme.primary} />
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-[var(--clay-dim)] uppercase tracking-widest mb-4">Practice Distribution</p>
          <CategoryPieChart data={categories} />
        </Card>
      </div>
    </div>
  )
}
