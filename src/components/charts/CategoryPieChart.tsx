import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { CategoryData } from '@/types'

/** A categorical Clay palette — distinguishable side by side, none of them the accent. */
const COLORS = ['#FF7A5C', '#6BCB9B', '#7A9AE0', '#FFC85C', '#B48CE0', '#5CC7C7', '#F291B0']

interface Props {
  data: CategoryData[]
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-2xl px-3.5 py-2.5 text-sm" style={{ background: 'var(--clay-surface)', boxShadow: 'var(--clay-deep)' }}>
      <p className="font-bold" style={{ color: 'var(--clay-ink)' }}>{payload[0].name}</p>
      <p style={{ color: 'var(--clay-dim)' }}>{payload[0].value} min</p>
    </div>
  )
}

export default function CategoryPieChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--clay-faint)' }}>
        No data yet
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="minutes" nameKey="category" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend formatter={(v) => <span className="text-xs" style={{ color: 'var(--clay-dim)' }}>{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}
