import { type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'
  size?: 'sm' | 'md'
  className?: string
}

export default function Badge({ children, variant = 'default', size = 'sm', className }: BadgeProps) {
  const variants = {
    default: 'bg-slate-100 text-slate-600 border-slate-200',
    success: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    warning: 'bg-amber-50 text-amber-600 border-amber-200',
    danger: 'bg-red-50 text-red-500 border-red-200',
    info: 'bg-sky-50 text-sky-600 border-sky-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
  }
  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 font-medium rounded-full border', variants[variant], sizes[size], className)}>
      {children}
    </span>
  )
}
