import { type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
  style?: React.CSSProperties
}

/**
 * Soft Clay surface: no border, a puffy drop shadow and an inner top
 * highlight that reads as a lit edge. Hover lifts it rather than
 * recolouring an outline.
 */
export default function Card({ children, className, hover, onClick, style }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-[var(--clay-r-md)]',
        hover && 'transition-transform duration-200 cursor-pointer hover:-translate-y-1',
        onClick && 'cursor-pointer',
        className
      )}
      style={{
        background: 'var(--clay-surface)',
        boxShadow: 'var(--clay-raised)',
        ...style,
      }}
      onMouseEnter={hover ? (e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--clay-deep)'
      } : undefined}
      onMouseLeave={hover ? (e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--clay-raised)'
      } : undefined}
    >
      {children}
    </div>
  )
}
