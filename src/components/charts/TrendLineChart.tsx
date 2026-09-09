import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'

interface Props {
  data: { week?: string; month?: string; minutes: number }[]
  dataKey?: string
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

export default function TrendLineChart({ data, color = 'var(--clay-accent)' }: Props) {
  const xKey = data[0]?.week !== undefined ? 'week' : 'month'
  const gradId = `grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.35} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--clay-line)" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: 'var(--clay-faint)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: 'var(--clay-faint)' }} tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="minutes" stroke={color} strokeWidth={2.75} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 4, fill: color }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
