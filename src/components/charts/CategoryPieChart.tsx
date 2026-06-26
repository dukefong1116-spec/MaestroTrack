import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { CategoryData } from '@/types'

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#818cf8', '#4f46e5']

interface Props {
  data: CategoryData[]
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm shadow-xl">
      <p className="text-white font-semibold">{payload[0].name}</p>
      <p className="text-slate-400">{payload[0].value} min</p>
    </div>
  )
}

export default function CategoryPieChart({ data }: Props) {
  if (!data.length) return <div className="flex items-center justify-center h-48 text-slate-500 text-sm">No data yet</div>
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="minutes" nameKey="category" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend formatter={(v) => <span className="text-slate-300 text-xs">{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}
