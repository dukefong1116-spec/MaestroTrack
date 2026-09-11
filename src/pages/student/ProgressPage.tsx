import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { getHeatmapData } from '@/lib/utils/analytics'
import { getTheme } from '@/lib/utils/instruments'
import PageHeader from '@/components/common/PageHeader'
import Card from '@/components/ui/Card'
import PracticeHeatmap from '@/components/charts/PracticeHeatmap'
import GoalsPanel from './panels/GoalsPanel'
import PatternsPanel from './panels/PatternsPanel'
import type { InstrumentType } from '@/types'

/**
 * Everything about how you're doing, in one place — goals, patterns and
 * lifetime totals. Previously spread across Goals, Insights and an
 * Analytics page that was never reachable from the UI.
 */
export default function ProgressPage() {
  const { profile } = useAuth()
  const { sessions } = usePracticeStore()
  const theme = getTheme(profile?.instrument as InstrumentType | undefined)

  const heatmap = useMemo(() => getHeatmapData(sessions), [sessions])

  const totalMinutes = useMemo(
    () => sessions.reduce((s, p) => s + p.durationMinutes, 0),
    [sessions]
  )

  // Salvaged from the retired Analytics page — the one metric that asks
  // "do you feel better about your playing?", which nothing else surfaced.
  const avgConfidence = useMemo(() => {
    if (!sessions.length) return 0
    return Math.round((sessions.reduce((s, p) => s + p.confidenceRating, 0) / sessions.length) * 10) / 10
  }, [sessions])

  const lifetime = [
    { label: 'Sessions', value: sessions.length },
    { label: 'Hours', value: `${Math.round(totalMinutes / 60)}h` },
    { label: 'Avg confidence', value: sessions.length ? `${avgConfidence}/10` : '—' },
  ]

  return (
    <div>
      <PageHeader title="Progress" subtitle="How you're doing against your week." />

      <GoalsPanel />

      {/* Lifetime totals */}
      <div className="mb-8 mt-2 grid grid-cols-3 gap-4">
        {lifetime.map((s) => (
          <Card key={s.label} className="p-4 text-center">
            <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--clay-ink)' }}>{s.value}</p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--clay-dim)' }}>{s.label}</p>
          </Card>
        ))}
      </div>

      <PatternsPanel />

      <Card className="mt-8 p-5">
        <p className="mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clay-dim)' }}>
          Every day you've practised
        </p>
        <PracticeHeatmap data={heatmap} color={theme.primary} />
      </Card>
    </div>
  )
}
