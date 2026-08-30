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
          <label htmlFor={selectId} className="text-sm font-medium" style={{ color: '#3D3A35' }}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all appearance-none cursor-pointer',
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
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'
export default Select
