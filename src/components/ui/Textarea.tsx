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
          <label htmlFor={inputId} className="text-sm font-semibold" style={{ color: 'var(--clay-ink)' }}>{label}</label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={3}
          className={cn(
            'w-full rounded-[var(--clay-r-sm)] px-4 py-2.5 text-sm outline-none transition-shadow resize-none',
            'shadow-[inset_0_1px_3px_rgba(58,48,84,.08)]',
            'focus:shadow-[inset_0_0_0_2px_var(--clay-accent)]',
            error && 'shadow-[inset_0_0_0_2px_var(--clay-danger)]',
            className
          )}
          style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}
          {...props}
        />
        {error && <p className="text-xs font-medium" style={{ color: 'var(--clay-danger)' }}>{error}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
export default Textarea
