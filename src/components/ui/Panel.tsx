import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * The app's page surface.
 *
 * One panel with hairline rules, not a stack of floating cards: the blocks
 * belong to the same subject, and separating them into cards made every
 * page read as a pile of unrelated chunks.
 *
 * Started life in settings/ and now carries Today, Progress, Library and
 * Practice too, which is why it lives in ui/.
 *
 * Everything here is token-only — no literal colours — so the dark-mode
 * pass has one surface to check rather than one per screen.
 */

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn('overflow-hidden', className)}
      style={{
        background: 'var(--clay-surface)',
        borderRadius: 'var(--clay-r-md)',
      }}
    >
      {children}
    </div>
  )
}

/** A block of free-form content inside a panel. `first` drops the top rule. */
export function Block({ children, first }: { children: ReactNode; first?: boolean }) {
  return (
    <div className="px-5 py-5 sm:px-6" style={first ? undefined : { borderTop: '1px solid var(--clay-line)' }}>
      {children}
    </div>
  )
}

/** A small all-caps heading, the app's existing eyebrow. */
export function Legend({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clay-dim)' }}>
        {title}
      </p>
      {hint && <p className="mt-2 text-sm" style={{ color: 'var(--clay-dim)' }}>{hint}</p>}
    </div>
  )
}

const rowBase =
  'flex w-full items-center gap-3.5 px-5 py-4 text-left transition-transform active:scale-[.99] sm:px-6'

/** A row that goes somewhere. */
export function NavRow({
  icon, label, value, to, first,
}: {
  icon?: ReactNode
  label: string
  value?: string
  to: string
  first?: boolean
}) {
  return (
    <Link to={to} className={rowBase} style={first ? undefined : { borderTop: '1px solid var(--clay-line)' }}>
      {icon && <span className="flex shrink-0" style={{ color: 'var(--clay-dim)' }}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold" style={{ color: 'var(--clay-ink)' }}>{label}</span>
        {value && <span className="block truncate text-xs" style={{ color: 'var(--clay-dim)' }}>{value}</span>}
      </span>
      <ChevronRight size={18} className="shrink-0" style={{ color: 'var(--clay-faint)' }} />
    </Link>
  )
}

/** A row that flips something. */
export function ToggleRow({
  icon, label, hint, checked, onChange, first, disabled,
}: {
  icon?: ReactNode
  label: string
  hint?: string
  checked: boolean
  onChange: (next: boolean) => void
  first?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(rowBase, 'disabled:opacity-50')}
      style={first ? undefined : { borderTop: '1px solid var(--clay-line)' }}
    >
      {icon && <span className="flex shrink-0" style={{ color: 'var(--clay-dim)' }}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold" style={{ color: 'var(--clay-ink)' }}>{label}</span>
        {hint && <span className="block text-xs" style={{ color: 'var(--clay-dim)' }}>{hint}</span>}
      </span>
      <Switch checked={checked} />
    </button>
  )
}

/** The track-and-knob, matching the one the Sound setting already uses. */
export function Switch({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
      style={{ background: checked ? 'var(--clay-accent)' : 'var(--clay-bg-deep)' }}
    >
      <span
        className="absolute top-1 h-4 w-4 rounded-full transition-all"
        style={{ left: checked ? 24 : 4, background: 'var(--clay-surface)' }}
      />
    </span>
  )
}

/** A label/value line for facts that cannot be edited here. */
export function FactRow({ label, value, first }: { label: string; value: ReactNode; first?: boolean }) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 px-5 py-3.5 sm:px-6"
      style={first ? undefined : { borderTop: '1px solid var(--clay-line)' }}
    >
      <span className="shrink-0 text-sm" style={{ color: 'var(--clay-dim)' }}>{label}</span>
      <span className="min-w-0 truncate text-sm" style={{ color: 'var(--clay-ink)' }}>{value}</span>
    </div>
  )
}

/**
 * The shell every settings sub-screen uses: a back arrow, a title, and the
 * content. Keeps the header identical across screens, so one change moves
 * all of them.
 */
export function SettingsScreen({
  title, back, children,
}: {
  title: string
  back: string
  children: ReactNode
}) {
  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-3 lg:mb-8">
        <Link
          to={back}
          aria-label="Back"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
          style={{ background: 'var(--clay-surface)', boxShadow: 'var(--clay-raised)', color: 'var(--clay-ink)' }}
        >
          <ChevronLeft size={20} />
        </Link>
        <h1
          className="text-[22px] font-bold leading-tight lg:text-[26px]"
          style={{ color: 'var(--clay-ink)', fontFamily: 'var(--clay-font)' }}
        >
          {title}
        </h1>
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  )
}
