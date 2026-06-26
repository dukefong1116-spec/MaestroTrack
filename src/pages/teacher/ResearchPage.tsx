import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Users, Music, TrendingUp } from 'lucide-react'
import { useTeacherStore } from '@/stores/teacherStore'
import { getCategoryData, computeConsistencyScore } from '@/lib/utils/analytics'
import { getTheme, INSTRUMENT_THEMES } from '@/lib/utils/instruments'
import PageHeader from '@/components/common/PageHeader'
import Card from '@/components/ui/Card'
import StatCard from '@/components/common/StatCard'
import CategoryPieChart from '@/components/charts/CategoryPieChart'
import type { InstrumentType } from '@/types'

export default function ResearchPage() {
  const { students, studentSessions } = useTeacherStore()

  const allSessions = useMemo(() =>
    Object.values(studentSessions).flat(),
    [studentSessions]
  )

  const byInstrument = useMemo(() => {
    const map: Record<string, { count: number; totalMinutes: number }> = {}
    for (const student of students) {
      const inst = student.instrument ?? 'Unknown'
      const sessions = studentSessions[student.uid] ?? []
      const minutes = sessions.reduce((s, p) => s + p.durationMinutes, 0)
      if (!map[inst]) map[inst] = { count: 0, totalMinutes: 0 }
      map[inst].count++
      map[inst].totalMinutes += minutes
    }
    return Object.entries(map).sort(([, a], [, b]) => b.totalMinutes - a.totalMinutes)
  }, [students, studentSessions])

  const byLevel = useMemo(() => {
    const map: Record<string, { count: number; totalMinutes: number }> = {}
    for (const student of students) {
      const level = student.experienceLevel ?? 'Unknown'
      const sessions = studentSessions[student.uid] ?? []
      const minutes = sessions.reduce((s, p) => s + p.durationMinutes, 0)
      if (!map[level]) map[level] = { count: 0, totalMinutes: 0 }
      map[level].count++
      map[level].totalMinutes += minutes
    }
    return Object.entries(map)
  }, [students, studentSessions])

  const totalMinutes = useMemo(() => allSessions.reduce((s, p) => s + p.durationMinutes, 0), [allSessions])
  const avgConsistency = useMemo(() => {
    if (!students.length) return 0
    const scores = students.map((s) => computeConsistencyScore(studentSessions[s.uid] ?? []))
    return Math.round(scores.reduce((a, s) => a + s, 0) / students.length)
  }, [students, studentSessions])

  const categoryData = useMemo(() => getCategoryData(allSessions), [allSessions])

  return (
    <div>
      <PageHeader
        title="Research Dashboard"
        subtitle="Anonymous aggregate analytics across your studio. All data anonymized."
      />

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-400 text-xs mb-6">
        📊 This dashboard shows anonymized aggregate data. No individual student can be identified from these metrics.
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Students" value={students.length} icon={<Users size={16} />} delay={0} />
        <StatCard label="Total Sessions" value={allSessions.length} icon={<BarChart3 size={16} />} delay={0.05} />
        <StatCard label="Total Hours" value={`${Math.round(totalMinutes / 60)}h`} icon={<TrendingUp size={16} />} delay={0.1} />
        <StatCard label="Avg Consistency" value={`${avgConsistency}%`} delay={0.15} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {/* By instrument */}
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            Average Practice by Instrument
          </p>
          <div className="space-y-3">
            {byInstrument.map(([inst, data]) => {
              const avgMin = data.count > 0 ? Math.round(data.totalMinutes / data.count) : 0
              const theme = getTheme(inst.toLowerCase() as InstrumentType)
              return (
                <div key={inst}>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>{INSTRUMENT_THEMES[inst.toLowerCase() as InstrumentType]?.emoji ?? '🎵'} {inst}</span>
                    <span>{avgMin} min avg · {data.count} students</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (avgMin / 600) * 100)}%`, backgroundColor: theme.primary }} />
                  </div>
                </div>
              )
            })}
            {byInstrument.length === 0 && <p className="text-slate-500 text-sm">No data yet.</p>}
          </div>
        </Card>

        {/* By level */}
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            Practice by Experience Level
          </p>
          <div className="space-y-4">
            {byLevel.map(([level, data]) => {
              const avgMin = data.count > 0 ? Math.round(data.totalMinutes / data.count) : 0
              return (
                <div key={level} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-slate-300 capitalize shrink-0">{level}</div>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, (avgMin / 600) * 100)}%` }} />
                  </div>
                  <div className="text-xs text-slate-400 shrink-0">{avgMin}m avg</div>
                </div>
              )
            })}
            {byLevel.length === 0 && <p className="text-slate-500 text-sm">No data yet.</p>}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
          Studio-wide Category Distribution
        </p>
        <CategoryPieChart data={categoryData} />
      </Card>
    </div>
  )
}
