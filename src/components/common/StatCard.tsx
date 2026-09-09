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
  accent = 'var(--clay-accent)',
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
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clay-dim)' }}>{label}</p>
          {icon && (
            <div className="p-2 rounded-xl" style={{ background: 'color-mix(in srgb, ' + accent + ' 16%, transparent)' }}>
              <div style={{ color: accent }}>{icon}</div>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-3xl font-bold tabular-nums" style={{ color: 'var(--clay-ink)' }}>{value}</p>
          {subtitle && <p className="text-xs" style={{ color: 'var(--clay-dim)' }}>{subtitle}</p>}
        </div>
        {trend && (
          <div
            className="text-xs font-semibold flex items-center gap-1"
            style={{ color: trend.value >= 0 ? '#2E8B62' : 'var(--clay-danger)' }}
          >
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
          </div>
        )}
        {children}
      </Card>
    </motion.div>
  )
}
