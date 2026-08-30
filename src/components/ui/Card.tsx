import { type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
  style?: React.CSSProperties
}

export default function Card({ children, className, hover, onClick, style }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl',
        hover && 'transition-all duration-200 cursor-pointer hover:-translate-y-0.5',
        onClick && 'cursor-pointer',
        className
      )}
      style={{
        background: '#F8F6F2',
        border: '1px solid #DEDAD2',
        ...(hover ? { ['--hover-border' as string]: '#E8503A' } : {}),
        ...style,
      }}
      onMouseEnter={hover ? (e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#E8503A'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px -4px rgba(232,80,58,.15)'
      } : undefined}
      onMouseLeave={hover ? (e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#DEDAD2'
        ;(e.currentTarget as HTMLElement).style.boxShadow = ''
      } : undefined}
    >
      {children}
    </div>
  )
}
