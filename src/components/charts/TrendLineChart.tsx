import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'

interface Props {
  data: { week?: string; month?: string; minutes: number }[]
  dataKey?: string
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

export default function TrendLineChart({ data, color = '#6366f1' }: Props) {
  const xKey = data[0]?.week !== undefined ? 'week' : 'month'
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="minutes" stroke={color} strokeWidth={2.5} fill={`url(#grad-${color.replace('#', '')})`} dot={false} activeDot={{ r: 4, fill: color }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
