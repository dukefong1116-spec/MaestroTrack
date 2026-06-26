import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { DailyPracticeData } from '@/types'

interface Props {
  data: DailyPracticeData[]
  color?: string
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm shadow-xl">
      <p className="text-slate-400">{label}</p>
      <p className="text-white font-semibold">{payload[0].value} min</p>
    </div>
  )
}

export default function PracticeBarChart({ data, color = '#6366f1' }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
        <Bar dataKey="minutes" fill={color} radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  )
}
