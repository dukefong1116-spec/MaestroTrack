import { type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Soft pills — tinted fills, no borders. Clay reads as moulded shapes,
 * and an outline flattens them back into stickers-on-glass.
 */
const VARIANTS: Record<NonNullable<BadgeProps['variant']>, React.CSSProperties> = {
  default: { background: 'var(--clay-bg-deep)', color: 'var(--clay-dim)' },
  success: { background: 'var(--clay-success-bg)', color: 'var(--clay-success-fg)' },
  warning: { background: 'var(--clay-warning-bg)', color: 'var(--clay-warning-fg)' },
  danger: { background: 'var(--clay-danger-bg)', color: 'var(--clay-danger-fg)' },
  info: { background: 'var(--clay-accent-soft)', color: 'var(--clay-accent-ink)' },
  purple: { background: 'var(--clay-purple-bg)', color: 'var(--clay-purple-fg)' },
}

export default function Badge({ children, variant = 'default', size = 'sm', className }: BadgeProps) {
  const sizes = {
    sm: 'text-xs px-2.5 py-1',
    md: 'text-sm px-3.5 py-1.5',
  }
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 font-semibold rounded-full', sizes[size], className)}
      style={VARIANTS[variant]}
    >
      {children}
    </span>
  )
}
