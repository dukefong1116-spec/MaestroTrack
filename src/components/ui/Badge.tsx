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
    default: 'bg-[#E5E2DB] text-[#6B6860] border-[#DEDAD2]',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-600 border-red-200',
    info: 'bg-[#FEF0EE] text-[#E8503A] border-[#FDDDD9]',
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
