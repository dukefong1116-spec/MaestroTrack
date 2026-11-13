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
  const itemCls = 'relative flex h-11 w-full shrink-0 items-center gap-3.5 overflow-hidden whitespace-nowrap rounded-[14px] px-[15px] text-sm font-semibold transition-colors'

  return (
    <aside
      aria-label="Main menu"
      className="relative z-30 hidden h-full w-[72px] shrink-0 lg:block"
      style={{ background: 'var(--clay-surface)', borderRight: '1px solid var(--clay-line)' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false) }}
    >
      <div
        className="absolute inset-y-0 left-0 flex flex-col gap-0.5 overflow-hidden px-3 py-3.5"
        style={{
          width: open ? 248 : 72,
          background: 'var(--clay-surface)',
          borderRight: '1px solid var(--clay-line)',
          boxShadow: open ? '16px 0 32px -16px rgba(58,48,84,.3)' : 'none',
          transition: reduce ? 'none' : 'width 170ms ease, box-shadow 170ms ease',
        }}
      >
        <div className="mb-2.5 flex h-12 shrink-0 items-center gap-3 overflow-hidden whitespace-nowrap pl-1">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]" style={{ background: 'linear-gradient(135deg,#FF7A5C,#F26243)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></svg>
          </span>
          <span className="min-w-0" style={{ opacity: open ? 1 : 0, transition: reduce ? 'none' : 'opacity 120ms ease' }}>
            <span className="block text-sm font-bold" style={{ color: 'var(--clay-ink)' }}>MaestroTrack</span>
            <span className="block truncate text-xs" style={{ color: 'var(--clay-dim)' }}>
              {profile?.displayName}{profile?.studioName ? ` · ${profile.studioName}` : ''}
            </span>
          </span>
        </div>

        <div className="shrink-0 overflow-hidden [&>*]:w-full">
          <NotificationBell label={open ? 'Notifications' : undefined} />
        </div>

        <nav aria-label="Pages" className="mt-1 flex flex-col gap-1">
          {TEACHER_PAGES.map((p) => (
            <NavLink
              key={p.to}
              to={p.to}
              end={p.end}
              aria-label={p.label}
              className={({ isActive }) => `${itemCls} ${isActive ? '' : 'hover:bg-[var(--clay-bg)]'}`}
              style={({ isActive }) => isActive
                ? { background: 'var(--clay-accent)', color: 'var(--clay-on-accent)' }
                : { color: 'var(--clay-dim)' }}
            >
              {({ isActive }) => (
                <>
                  <p.icon size={18} className="shrink-0" aria-hidden="true" />
                  {label(p.label)}
                  {p.to === '/teacher/review' && toReview > 0 && (
                    <span
                      className="absolute flex items-center justify-center rounded-full text-[10.5px] font-bold"
                      style={open
                        ? { right: 10, top: 12, minWidth: 20, height: 20, padding: '0 6px', background: isActive ? '#fff' : 'var(--clay-accent)', color: isActive ? 'var(--clay-accent-ink)' : '#fff' }
                        : { left: 26, top: 4, minWidth: 17, height: 17, padding: '0 4px', background: isActive ? '#fff' : 'var(--clay-accent-ink)', color: isActive ? 'var(--clay-accent-ink)' : '#fff', border: '2px solid var(--clay-surface)' }}
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
          <Settings size={18} className="shrink-0" aria-hidden="true" />
          {label('Settings')}
        </NavLink>
        <button type="button" onClick={logout.ask} aria-label="Log out" className={`${itemCls} hover:bg-[var(--clay-danger-bg)]`} style={{ color: 'var(--clay-dim)' }}>
          <LogOut size={18} className="shrink-0" aria-hidden="true" />
          {label('Log out')}
        </button>
      </div>
      <LogOutSheet open={logout.asking} busy={logout.busy} onCancel={logout.cancel} onConfirm={logout.confirm} />
    </aside>
  )
}
