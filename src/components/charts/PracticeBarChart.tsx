import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { DailyPracticeData } from '@/types'

interface Props {
  data: DailyPracticeData[]
  color?: string
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-2xl px-3.5 py-2.5 text-sm" style={{ background: 'var(--clay-surface)', boxShadow: 'var(--clay-deep)' }}>
      <p style={{ color: 'var(--clay-dim)' }}>{label}</p>
      <p className="font-bold" style={{ color: 'var(--clay-ink)' }}>{payload[0].value} min</p>
    </div>
  )
}

export default function PracticeBarChart({ data, color = 'var(--clay-accent)' }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--clay-line)" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--clay-faint)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: 'var(--clay-faint)' }} tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--clay-bg-deep)' }} />
        <Bar dataKey="minutes" fill={color} radius={[8, 8, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}
