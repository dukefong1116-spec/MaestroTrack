import { useMemo } from 'react'
import { format, subDays, eachDayOfInterval, getDay } from 'date-fns'

interface Props {
  data: Record<string, number>
  color?: string
}

function getIntensity(minutes: number): number {
  if (minutes === 0) return 0
  if (minutes < 20) return 1
  if (minutes < 45) return 2
  if (minutes < 90) return 3
  return 4
}

export default function PracticeHeatmap({ data, color = '#6366f1' }: Props) {
  const weeks = useMemo(() => {
    const end = new Date()
    const start = subDays(end, 364)
    const days = eachDayOfInterval({ start, end })

    const grid: (typeof days[number] | null)[][] = []
    let week: (typeof days[number] | null)[] = new Array(getDay(days[0])).fill(null)
    for (const day of days) {
      week.push(day)
      if (week.length === 7) {
        grid.push(week)
        week = []
      }
    }
    if (week.length) {
      while (week.length < 7) week.push(null)
      grid.push(week)
    }
    return grid
  }, [])

  const intensityColors = [
    '#1e293b',
    `${color}40`,
    `${color}70`,
    `${color}a0`,
    color,
  ]

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day, di) => {
              if (!day) return <div key={di} className="w-3 h-3" />
              const key = format(day, 'yyyy-MM-dd')
              const minutes = data[key] ?? 0
              const intensity = getIntensity(minutes)
              return (
                <div
                  key={di}
                  title={`${format(day, 'MMM dd')}: ${minutes} min`}
                  className="w-3 h-3 rounded-sm cursor-default transition-transform hover:scale-125"
                  style={{ backgroundColor: intensityColors[intensity] }}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-500">
        <span>Less</span>
        {intensityColors.map((c, i) => (
          <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
