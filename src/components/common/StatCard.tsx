import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import Card from '@/components/ui/Card'

interface StatCardProps {
  label: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  accent?: string
  trend?: { value: number; label: string }
  children?: ReactNode
  className?: string
  delay?: number
}

export default function StatCard({
  label,
  value,
  subtitle,
  icon,
  accent = '#6366f1',
  trend,
  children,
  className,
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <Card className={cn('p-5 space-y-3', className)}>
        <div className="flex items-start justify-between">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
          {icon && (
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${accent}20` }}>
              <div style={{ color: accent }}>{icon}</div>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        {trend && (
          <div className={cn('text-xs font-medium flex items-center gap-1', trend.value >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
          </div>
        )}
        {children}
      </Card>
    </motion.div>
  )
}
