import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LogOut, Settings } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { needsReview } from '@/lib/utils/assignments'
import NotificationBell from '@/components/notifications/NotificationBell'
import { useLogOutConfirm } from '@/components/layout/useLogOut'
import LogOutSheet from '@/components/layout/LogOutSheet'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { TEACHER_PAGES } from './pages'

/**
 * The teacher's menu on a desktop: a 72px rail of icons on every page,
 * opening over the page — not pushing it — while the pointer is on it or
 * focus is inside it, and closing when either leaves.
 *
 * Labels are faded out while closed rather than clipped, so nothing peeks
 * out from behind the icons.
 */
/** The side-menu items the tutorial points at. */
const RAIL_COACH: Record<string, string> = {
  '/teacher/students': 'rail-students', '/teacher/calendar': 'rail-calendar',
  '/teacher/review': 'rail-review', '/teacher/families': 'rail-billing',
}

export default function TeacherRail() {
  const { profile } = useAuth()
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)
  const open = hover || focus
  const reduce = usePrefersReducedMotion()
  const logout = useLogOutConfirm()
  const assignments = useTeacherStore((s) => s.assignments)
  const toReview = useMemo(() => assignments.filter(needsReview).length, [assignments])

  const label = (text: string) => (
    <span className="min-w-0 truncate" style={{ opacity: open ? 1 : 0, transition: reduce ? 'none' : 'opacity 120ms ease' }}>{text}</span>
  )
  const itemCls = 'relative flex h-11 w-full shrink-0 items-center gap-3.5 overflow-hidden whitespace-nowrap rounded-[0.875rem] px-[0.9375rem] text-sm font-semibold transition-colors'

  return (
    <aside
      aria-label="Main menu"
      className="relative z-30 hidden h-full w-[4.5rem] shrink-0 lg:block"
      style={{ background: 'var(--clay-surface)', borderRight: '1px solid var(--clay-line)' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      // Kept open by keyboard focus only: a click also focuses the link it
      // lands on, which held the rail open after the mouse had left.
      onFocus={(e) => setFocus(e.target.matches(':focus-visible'))}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false) }}
    >
      <div
        className="absolute inset-y-0 left-0 flex flex-col gap-0.5 overflow-hidden px-3 py-3.5"
        style={{
          // In rem, like everything inside it: with a larger text size the
          // rail grows with its buttons instead of cutting them off.
          width: open ? '15.5rem' : '4.5rem',
          background: 'var(--clay-surface)',
          borderRight: '1px solid var(--clay-line)',
          boxShadow: open ? '16px 0 32px -16px rgba(30,40,70,.3)' : 'none',
          transition: reduce ? 'none' : 'width 170ms ease, box-shadow 170ms ease',
        }}
      >
        <div className="mb-2.5 flex h-12 shrink-0 items-center gap-3 overflow-hidden whitespace-nowrap pl-1">
          {/* The app's own icon. */}
          <img src="/apple-touch-icon.png" alt="" className="h-10 w-10 shrink-0 rounded-[0.875rem]" draggable={false} />
          <span className="min-w-0" style={{ opacity: open ? 1 : 0, transition: reduce ? 'none' : 'opacity 120ms ease' }}>
            <span className="block text-sm font-bold" style={{ color: 'var(--clay-ink)' }}>Femata</span>
            <span className="block truncate text-xs" style={{ color: 'var(--clay-dim)' }}>
              {profile?.displayName}{profile?.studioName ? ` · ${profile.studioName}` : ''}
            </span>
          </span>
        </div>

        <div className="shrink-0 [&>*]:w-full">
          <NotificationBell rail={{ open }} />
        </div>

        <nav aria-label="Pages" className="mt-1 flex flex-col gap-1">
          {TEACHER_PAGES.map((p) => (
            <NavLink
              key={p.to}
              to={p.to}
              end={p.end}
              aria-label={p.label}
              // For the teacher's tutorial (lib/utils/teacherTour).
              data-coach={RAIL_COACH[p.to]}
              className={({ isActive }) => `${itemCls} ${isActive ? '' : 'hover:bg-[var(--clay-bg)]'}`}
              style={({ isActive }) => isActive
                ? { background: 'var(--clay-accent)', color: 'var(--clay-on-accent)' }
                : { color: 'var(--clay-dim)' }}
            >
              {({ isActive }) => (
                <>
                  <p.icon className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden="true" />
                  {label(p.label)}
                  {p.to === '/teacher/review' && toReview > 0 && (
                    <span
                      className="absolute flex items-center justify-center rounded-full text-[0.65rem] font-bold"
                      style={open
                        ? { right: '0.625rem', top: '0.75rem', minWidth: '1.25rem', height: '1.25rem', padding: '0 0.375rem', background: isActive ? '#fff' : 'var(--clay-accent)', color: isActive ? 'var(--clay-accent-ink)' : '#fff' }
                        : { left: '1.625rem', top: '0.25rem', minWidth: '1.0625rem', height: '1.0625rem', padding: '0 0.25rem', background: isActive ? '#fff' : 'var(--clay-accent-ink)', color: isActive ? 'var(--clay-accent-ink)' : '#fff', border: '2px solid var(--clay-surface)' }}
                    >
                      {toReview}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mx-1.5 my-2.5 h-px shrink-0" style={{ background: 'var(--clay-line)' }} />
        <NavLink
          to="/teacher/settings"
          aria-label="Settings"
          className={({ isActive }) => `${itemCls} ${isActive ? '' : 'hover:bg-[var(--clay-bg)]'}`}
          style={({ isActive }) => isActive ? { background: 'var(--clay-accent)', color: 'var(--clay-on-accent)' } : { color: 'var(--clay-dim)' }}
        >
          <Settings className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden="true" />
          {label('Settings')}
        </NavLink>
        <button type="button" onClick={logout.ask} aria-label="Log out" className={`${itemCls} hover:bg-[var(--clay-danger-bg)]`} style={{ color: 'var(--clay-dim)' }}>
          <LogOut className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden="true" />
          {label('Log out')}
        </button>
      </div>
      <LogOutSheet open={logout.asking} busy={logout.busy} onCancel={logout.cancel} onConfirm={logout.confirm} />
    </aside>
  )
}
