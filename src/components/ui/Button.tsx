import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react'
import { cn } from '@/lib/utils/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className, children, disabled, style, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#EDEAE4] disabled:opacity-50 disabled:cursor-not-allowed active:scale-95'
    const variants = {
      primary: 'text-white shadow-md',
      secondary: 'bg-[#E5E2DB] hover:bg-[#DEDAD2] text-[#22201C] focus:ring-[#DEDAD2]',
      ghost: 'hover:bg-[#E5E2DB] text-[#6B6860] hover:text-[#22201C] focus:ring-[#DEDAD2]',
      danger: 'bg-red-500 hover:bg-red-400 text-white focus:ring-red-400',
      outline: 'border border-[#DEDAD2] hover:border-[#E8503A] text-[#6B6860] hover:text-[#22201C] focus:ring-[#E8503A]',
    }
    const sizes = {
      sm: 'px-3 py-1.5 text-sm gap-1.5',
      md: 'px-4 py-2 text-sm gap-2',
      lg: 'px-6 py-3 text-base gap-2',
    }

    const primaryStyle: CSSProperties = variant === 'primary' ? {
      background: '#E8503A',
      boxShadow: '0 4px 12px rgba(232,80,58,.25)',
    } : {}

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        style={{ ...primaryStyle, ...style }}
        onMouseEnter={variant === 'primary' ? (e) => {
          if (!disabled && !loading) (e.currentTarget as HTMLElement).style.background = '#D44430'
        } : undefined}
        onMouseLeave={variant === 'primary' ? (e) => {
          if (!disabled && !loading) (e.currentTarget as HTMLElement).style.background = '#E8503A'
        } : undefined}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
export default Button
