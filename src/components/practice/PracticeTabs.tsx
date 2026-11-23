import { useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { haptic } from '@/lib/haptics'
import { useNativeSegmented } from '@/lib/nativeGlass'

/**
 * Sessions | Progress, at the top of Practice. Progress used to be a tab
 * of its own; the League took its place in the tab bar, and your history
 * and how you're doing belong together anyway.
 *
 * In the iPhone app it is Apple's own segmented control on Liquid Glass,
 * laid over this one (see nativeGlass); elsewhere this glass capsule.
 */
const TABS = [
  { to: '/student/practice', label: 'Sessions', end: true },
  { to: '/student/practice/progress', label: 'Progress', end: true },
]

export default function PracticeTabs() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const selected = Math.max(0, TABS.findIndex((t) => t.to === pathname.replace(/\/+$/, '')))
  // One id per page: Sessions and Progress each have their own copy, and
  // one leaving must not take the other's away.
  const native = useNativeSegmented(ref, {
    id: `practice-tabs-${selected}`, items: TABS.map((t) => t.label), selected, tint: '#1F8FD1', visible: true,
  }, (i) => { haptic('select'); navigate(TABS[i].to, { replace: true }) })

  return (
    // A grey track, the chosen tab a raised white pill in it (as Apple's own).
    <div
      ref={ref}
      className="mb-5 flex p-1"
      style={{ borderRadius: 999, background: 'rgba(118,118,128,.14)', visibility: native ? 'hidden' : undefined }}
      role="tablist"
      aria-hidden={native || undefined}
    >
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          replace
          onClick={() => haptic('select')}
          role="tab"
          tabIndex={native ? -1 : undefined}
          data-coach={`practice-tab-${t.label.toLowerCase()}`}
          className="flex-1 py-2 text-center text-[13px] font-semibold transition-colors"
          style={({ isActive }) => ({
            borderRadius: 999,
            background: isActive ? 'var(--clay-surface)' : 'transparent',
            boxShadow: isActive ? '0 1px 2px rgba(20,30,60,.08), 0 4px 12px rgba(20,30,60,.08)' : undefined,
            color: isActive ? 'var(--clay-ink)' : 'var(--clay-dim)',
          })}
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  )
}
