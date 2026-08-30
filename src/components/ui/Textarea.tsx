import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium" style={{ color: '#3D3A35' }}>{label}</label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={3}
          className={cn(
            'w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all resize-none',
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
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
export default Textarea
