import { type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}

export default function Card({ children, className, hover, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-slate-900/80 border border-slate-800/60 rounded-2xl backdrop-blur-sm',
        hover && 'transition-all duration-200 hover:border-slate-700 hover:shadow-xl hover:shadow-black/30 cursor-pointer hover:-translate-y-0.5',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  )
}
