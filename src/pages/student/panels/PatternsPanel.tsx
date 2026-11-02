import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, AlertTriangle, Info } from 'lucide-react'
import Sticker from '@/components/stickers/Sticker'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { generateInsights, getCategoryData } from '@/lib/utils/analytics'
import { getTheme } from '@/lib/utils/instruments'
import { Block, Legend } from '@/components/ui/Panel'
import CategoryPieChart from '@/components/charts/CategoryPieChart'
import TrendLineChart from '@/components/charts/TrendLineChart'
import { getWeeklyData } from '@/lib/utils/analytics'
import type { InstrumentType } from '@/types'

/** The insight tones, as tokens — they used to be literal emerald/amber/
 *  blue Tailwind classes, which stayed pale after dark. */
const TONE = {
  positive: { fg: 'var(--clay-success-fg)', bg: 'var(--clay-success-bg)' },
  warning: { fg: 'var(--clay-warning-fg)', bg: 'var(--clay-warning-bg)' },
  info: { fg: 'var(--clay-purple-fg)', bg: 'var(--clay-purple-bg)' },
} as const

/**
 * The patterns half of Progress. Renders blocks, not a page — see the note
 * on GoalsPanel.
 */
export default function PatternsPanel() {
  const { profile } = useAuth()
  const { sessions, pieces } = usePracticeStore()
  const theme = getTheme(profile?.instrument as InstrumentType | undefined)

  const insights = useMemo(() => generateInsights(sessions, pieces), [sessions, pieces])
  const categories = useMemo(() => getCategoryData(sessions), [sessions])
  const weeklyTrend = useMemo(() => getWeeklyData(sessions, 8), [sessions])

  const iconMap = { positive: TrendingUp, warning: AlertTriangle, info: Info }

  return (
    <>
      <Block>
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clay-dim)' }}>
            Patterns
          </p>
          <p className="text-xs" style={{ color: 'var(--clay-faint)' }}>
            from {sessions.length} logged session{sessions.length === 1 ? '' : 's'}
          </p>
        </div>

        {insights.length > 0 ? (
          <div className="space-y-4">
            {insights.map((insight, i) => {
              const Icon = iconMap[insight.type]
              const tone = TONE[insight.type]
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex gap-3.5"
                >
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center"
                    style={{ background: tone.bg, color: tone.fg, borderRadius: 'var(--clay-r-sm)' }}
                  >
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold" style={{ color: 'var(--clay-ink)' }}>{insight.title}</p>
                    <p className="text-sm" style={{ color: 'var(--clay-dim)' }}>{insight.description}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="py-4 text-center">
            <div className="mb-3 flex justify-center"><Sticker name="brain" size={36} tone="ink" /></div>
            <p style={{ color: 'var(--clay-dim)' }}>Log more practice sessions to generate personalized insights.</p>
          </div>
        )}
      </Block>

      <Block>
        <Legend title="Weekly practice trend" />
        <TrendLineChart data={weeklyTrend} color={theme.primary} />
      </Block>

      <Block>
        <Legend title="Practice distribution" />
        <CategoryPieChart data={categories} />
      </Block>
    </>
  )
}
