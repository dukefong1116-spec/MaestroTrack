import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium" style={{ color: '#3D3A35' }}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all',
            error && 'border-red-400 focus:ring-red-400',
            className
          )}
          style={{
            background: '#F8F6F2',
            border: `1px solid ${error ? '#F87171' : '#DEDAD2'}`,
            color: '#22201C',
            '--tw-ring-color': '#E8503A',
          } as React.CSSProperties}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs" style={{ color: '#A09C95' }}>{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
