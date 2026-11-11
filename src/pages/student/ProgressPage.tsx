import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { getHeatmapData } from '@/lib/utils/analytics'
import { getTheme } from '@/lib/utils/instruments'
import PageHeader from '@/components/common/PageHeader'
import { Panel, Block, Legend } from '@/components/ui/Panel'
import PracticeHeatmap from '@/components/charts/PracticeHeatmap'
import GoalsPanel from './panels/GoalsPanel'
import PatternsPanel from './panels/PatternsPanel'
import type { InstrumentType } from '@/types'

/**
 * Everything about how you're doing, in one place — goals, patterns and
 * lifetime totals. Previously spread across Goals, Insights and an
 * Analytics page that was never reachable from the UI.
 *
 * And in one panel: these are all answers to the same question, so they
 * are divided by hairlines rather than floated apart as separate cards.
 */
export default function ProgressPage({ embedded }: { embedded?: boolean } = {}) {
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
      {/* Inside Practice the page's own title would repeat the tab's. */}
      {!embedded && <PageHeader title="Progress" subtitle="How you're doing against your week." />}

      <Panel>
        <GoalsPanel />

        <Block>
          <Legend title="All time" />
          <div className="grid grid-cols-3">
            {lifetime.map((s, i) => (
              <div
                key={s.label}
                className="px-1 text-center"
                style={i === 0 ? undefined : { borderLeft: '1px solid var(--clay-line)' }}
              >
                <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--clay-ink)' }}>{s.value}</p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--clay-dim)' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </Block>

        <PatternsPanel />

        <Block>
          <Legend title="Every day you've practised" />
          <PracticeHeatmap data={heatmap} color={theme.primary} />
        </Block>
      </Panel>
    </div>
  )
}
