import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react'
import { cn } from '@/lib/utils/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

/**
 * Clay buttons compress on press rather than shifting into a shadow —
 * squash-and-stretch is what makes the surface read as soft.
 */
const VARIANTS: Record<NonNullable<ButtonProps['variant']>, CSSProperties> = {
  primary: {
    background: 'var(--clay-accent)',
    color: 'var(--clay-on-accent)',
    boxShadow: 'var(--clay-accent-shadow)',
  },
  secondary: {
    background: 'var(--clay-surface)',
    color: 'var(--clay-ink)',
    boxShadow: 'var(--clay-raised)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--clay-dim)',
  },
  danger: {
    background: 'var(--clay-danger)',
    color: '#FFFFFF',
    boxShadow: '0 10px 22px -6px rgba(255,92,110,.45), inset 0 2px 0 rgba(255,255,255,.4)',
  },
  outline: {
    background: 'var(--clay-bg-deep)',
    color: 'var(--clay-ink)',
  },
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className, children, disabled, style, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-semibold rounded-[var(--clay-r-sm)] ' +
      'transition-transform duration-150 active:scale-[.94] focus:outline-none ' +
      'focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

    const sizes = {
      sm: 'px-3.5 py-2 text-sm gap-1.5',
      md: 'px-4 py-2.5 text-sm gap-2',
      lg: 'px-6 py-3.5 text-base gap-2',
    }

    return (
      <button
        ref={ref}
        className={cn(base, sizes[size], className)}
        disabled={disabled || loading}
        style={{
          ...VARIANTS[variant],
          // @ts-expect-error -- CSS custom property for the focus ring colour
          '--tw-ring-color': 'var(--clay-accent)',
          '--tw-ring-offset-color': 'var(--clay-bg)',
          ...style,
        }}
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
