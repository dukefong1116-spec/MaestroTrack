import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { TONES, type Tone } from './tokens'

/**
 * The teacher pages' building blocks: one connected sheet per page, split
 * by hairlines rather than stacked cards, with the page's title and its
 * actions in the sheet's own header.
 */

export function StudioPage({
  title, subtitle, actions, back, children, flush,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** Where the back arrow goes, with its label. */
  back?: { to: string; label: string }
  children: ReactNode
  /** No sheet around the content (the page draws its own). */
  flush?: boolean
}) {
  const navigate = useNavigate()
  const header = (
    <header className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6" style={{ borderBottom: '1px solid var(--clay-line)' }}>
      <div className="min-w-0 flex-1 basis-60">
        {back && (
          <button
            type="button"
            onClick={() => navigate(back.to)}
            className="-ml-1 mb-1 flex items-center gap-0.5 text-[13px] font-semibold"
            style={{ color: 'var(--clay-accent-ink)' }}
          >
            <ChevronLeft size={16} /> {back.label}
          </button>
        )}
        <h1 className="truncate text-[21px] font-bold leading-tight lg:text-[22px]" style={{ color: 'var(--clay-ink)' }}>{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
  if (flush) return <div>{header}{children}</div>
  return (
    <div
      className="-mx-3 overflow-hidden sm:mx-0"
      style={{ background: 'var(--clay-surface)', borderRadius: 'var(--clay-r-lg)', border: '1px solid var(--clay-line)' }}
    >
      {header}
      {children}
    </div>
  )
}

export function Divided({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('divide-y', className)} style={{ borderColor: 'var(--clay-line)' }}>{children}</div>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 pb-2 pt-4 sm:px-6">
      <h2 className="flex-1 text-[15px] font-bold" style={{ color: 'var(--clay-ink)' }}>{children}</h2>
      {action}
    </div>
  )
}

export function Segmented<T extends string>({
  value, options, onChange, label, className,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  label: string
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap gap-0.5 p-[3px]', className)} style={{ background: 'var(--clay-bg)', borderRadius: 10 }}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className="min-h-[34px] rounded-lg px-3 text-[13px] transition-colors"
            style={{
              background: on ? 'var(--clay-surface)' : 'transparent',
              color: on ? 'var(--clay-ink)' : 'var(--clay-dim)',
              fontWeight: on ? 700 : 600,
              boxShadow: on ? '0 1px 3px rgba(58,48,84,.18)' : 'none',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  const [bg, fg] = TONES[tone]
  return (
    <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-[3px] text-[12px] font-bold" style={{ background: bg, color: fg }}>
      {children}
    </span>
  )
}

type BtnKind = 'primary' | 'soft' | 'quiet' | 'link'
export function Btn({
  kind = 'soft', children, className, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind }) {
  const style: React.CSSProperties =
    kind === 'primary' ? { background: 'var(--clay-accent-ink)', color: '#fff' }
      : kind === 'soft' ? { background: 'var(--clay-bg)', color: 'var(--clay-ink)' }
        : kind === 'quiet' ? { background: 'var(--clay-accent-soft)', color: '#C2452B' }
          : { background: 'transparent', color: 'var(--clay-accent-ink)', paddingLeft: 2, paddingRight: 2 }
  return (
    <button
      type="button"
      {...rest}
      className={cn('inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-[10px] px-3.5 text-[13.5px] transition-transform active:scale-[.97] disabled:opacity-50', kind === 'primary' || kind === 'quiet' ? 'font-bold' : 'font-semibold', className)}
      style={{ ...style, ...(rest.style ?? {}) }}
    >
      {children}
    </button>
  )
}

/** A dark bar of actions for whatever is selected. */
export function BulkBar({ label, children, onClear }: { label: string; children: ReactNode; onClear: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 sm:px-6" style={{ background: 'var(--clay-ink)', color: '#fff' }} role="region" aria-label="Selected">
      <strong className="flex-1 text-[13.5px]">{label}</strong>
      {children}
      <button type="button" onClick={onClear} aria-label="Clear selection" className="px-2 text-[15px]">✕</button>
    </div>
  )
}

export function BulkButton({ children, primary, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className="min-h-[34px] rounded-[9px] px-3 text-[13px] font-semibold disabled:opacity-50"
      style={{ background: primary ? 'var(--clay-accent)' : 'rgba(255,255,255,.16)', color: '#fff', fontWeight: primary ? 700 : 600 }}
    >
      {children}
    </button>
  )
}

export function Check({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      className="h-[18px] w-[18px] cursor-pointer"
      style={{ accentColor: 'var(--clay-accent-ink)' }}
    />
  )
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block text-[12.5px] font-medium', className)} style={{ color: 'var(--clay-dim)' }}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-6 text-[14px] sm:px-6" style={{ color: 'var(--clay-dim)' }}>{children}</p>
}

export function Avatar({ name, color, size = 34 }: { name: string; color?: string; size?: number }) {
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: color ?? 'var(--clay-dim)' }}
    >
      {initials}
    </span>
  )
}

