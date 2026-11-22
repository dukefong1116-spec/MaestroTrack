import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { TONES, type Tone } from './tokens'
import Femata, { type FemataMood } from '@/components/femata/Femata'

/**
 * The teacher pages' building blocks: one connected sheet per page, split
 * by hairlines rather than stacked cards, with the page's title and its
 * actions in the sheet's own header.
 */

export function StudioPage({
  title, subtitle, actions, back, corner, children, flush,
}: {
  /** Left out, and with no actions or back link, the page has no header at all. */
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** Where the back arrow goes, with its label. phoneOnly: a computer
   *  reaches this page from its rail, so the arrow is only for a phone. */
  back?: { to: string; label: string; phoneOnly?: boolean }
  /** Top right, on the back arrow's line: a page's "…" menu. */
  corner?: ReactNode
  children: ReactNode
  /** No sheet around the content (the page draws its own). */
  flush?: boolean
}) {
  const navigate = useNavigate()
  // One row, as on the student's pages: a round back button, the title
  // beside it, the page's "…" or actions at the end. (The small "‹ More"
  // link above the title sat too close to it and too far from the edge.)
  const header = !title && !actions && !back && !corner ? null : (
    <header className="flex flex-wrap items-center gap-3 px-5 pb-4 pt-3 sm:px-6" style={{ borderBottom: '1px solid var(--clay-line)' }}>
      {back && (
        <button
          type="button"
          onClick={() => navigate(back.to)}
          aria-label={`Back to ${back.label}`}
          className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90', back.phoneOnly && 'lg:hidden')}
          style={{ background: 'var(--clay-surface)', boxShadow: 'var(--clay-raised)', color: 'var(--clay-ink)' }}
        >
          <ChevronLeft size={20} />
        </button>
      )}
      <div className="min-w-0 flex-1 basis-40">
        {title && <h1 className="truncate text-[22px] font-bold leading-tight lg:text-[24px]" style={{ color: 'var(--clay-ink)' }}>{title}</h1>}
        {subtitle && <p className="mt-0.5 text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>{subtitle}</p>}
      </div>
      {corner}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
  if (flush) return <div>{header}{children}</div>
  return (
    // On a phone the sheet is the screen: no outline and no rounded top,
    // which drew a stray line under the status bar on every teacher page.
    // From sm up it is a card again.
    <div
      className="-mx-3 overflow-hidden sm:mx-0 sm:rounded-[var(--clay-r-lg)] sm:border"
      style={{ background: 'var(--clay-surface)', borderColor: 'var(--clay-line)' }}
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
              boxShadow: on ? '0 1px 3px rgba(30,40,70,.18)' : 'none',
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

/** Whether a student uses the app: a small dot and plain words, quieter than a pill. */
export function AppStatus({ on }: { on: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold" style={{ color: on ? 'var(--clay-success-fg)' : 'var(--clay-dim)' }}>
      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: on ? 'var(--clay-success-fg)' : 'var(--clay-faint)' }} />
      {on ? 'On the app' : 'Not on the app'}
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
        : kind === 'quiet' ? { background: 'var(--clay-accent-soft)', color: 'var(--clay-accent-ink)' }
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
/**
 * What to do with the rows ticked: a floating pill above the tab bar (on a
 * computer, centred at the bottom) rather than a dark band across the
 * panel. The count, then a round button per action, then close. Pages
 * end their list with <BulkSpacer /> so the last rows can scroll clear of it.
 */
export function BulkBar({ label, children, onClear }: { label: string; children: ReactNode; onClear: () => void }) {
  return (
    <>
      <div
        role="region"
        aria-label="Selected"
        className="glass fixed left-3 right-3 z-40 flex items-center gap-1.5 rounded-full py-1.5 pl-4 pr-1.5 lg:bottom-6 lg:left-1/2 lg:right-auto lg:-translate-x-1/2"
        style={{
          bottom: 'calc(86px + env(safe-area-inset-bottom))',
          color: 'var(--clay-ink)',
        }}
      >
        <strong className="min-w-0 flex-1 truncate pr-2 text-[14px]">{label}</strong>
        {children}
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'var(--clay-bg)', color: 'var(--clay-dim)' }}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </>
  )
}

/** Room at the end of a list for the floating pill to sit over. */
export function BulkSpacer() {
  return <div aria-hidden="true" className="h-24 lg:h-16" />
}

/** One action in the pill: a round, coloured icon; its words are its label. */
export function BulkButton({ children, icon, tone = 'neutral', primary, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode
  tone?: Tone
  /** Kept for callers; the tone carries the emphasis now. */
  primary?: boolean
}) {
  const [bg, fg] = TONES[tone]
  const words = typeof children === 'string' ? children : undefined
  return (
    <button
      type="button"
      {...rest}
      aria-label={words}
      title={words}
      className="flex h-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold transition-transform active:scale-95 disabled:opacity-50"
      style={{ background: bg, color: fg, width: icon ? 40 : undefined, padding: icon ? 0 : '0 14px', boxShadow: primary ? `0 0 0 2px ${fg}` : undefined }}
    >
      {icon ?? children}
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

/**
 * An empty list. With a mood, Femata says it (a different face on each
 * page); without one, just the line, for small spots like a loading note.
 */
export function Empty({ children, mood, title, fill }: { children?: ReactNode; mood?: FemataMood; title?: string; fill?: boolean }) {
  if (!mood) return <p className="px-5 py-6 text-[14px] sm:px-6" style={{ color: 'var(--clay-dim)' }}>{children}</p>
  return (
    // fill: the whole page is empty, so it sits in the middle of the screen
    // rather than just under the filters.
    <div className={cn('flex flex-col items-center px-6 text-center', fill ? 'min-h-[calc(100dvh-300px)] justify-center py-10' : 'pb-10 pt-8')}>
      <Femata mood={mood} size={104} />
      {title && <p className="mt-3 text-[16.5px] font-bold" style={{ color: 'var(--clay-ink)' }}>{title}</p>}
      {children && <p className="mt-1 max-w-[300px] text-[13.5px] leading-snug" style={{ color: 'var(--clay-dim)' }}>{children}</p>}
    </div>
  )
}

/** A student's profile photo when they have set one; their initials on a colour when not. */
export function Avatar({ name, color, size = 34, src }: { name: string; color?: string; size?: number; src?: string | null }) {
  if (src) {
    return <img src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  }
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

