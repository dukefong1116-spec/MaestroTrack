import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-semibold" style={{ color: 'var(--clay-ink)' }}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full rounded-[var(--clay-r-sm)] px-4 py-2.5 text-sm outline-none transition-shadow appearance-none cursor-pointer',
            'shadow-[inset_0_1px_3px_rgba(58,48,84,.08)]',
            'focus:shadow-[inset_0_0_0_2px_var(--clay-accent)]',
            error && 'shadow-[inset_0_0_0_2px_var(--clay-danger)]',
            className
          )}
          style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs font-medium" style={{ color: 'var(--clay-danger)' }}>{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'
export default Select
