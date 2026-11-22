import { NavLink } from 'react-router-dom'
import { haptic } from '@/lib/haptics'

/**
 * Sessions | Progress, at the top of Practice. Progress used to be a tab
 * of its own; the League took its place in the tab bar, and your history
 * and how you're doing belong together anyway.
 */
export default function PracticeTabs() {
  const tabs = [
    { to: '/student/practice', label: 'Sessions', end: true },
    { to: '/student/practice/progress', label: 'Progress', end: true },
  ]
  return (
    // Liquid Glass: a glass capsule, the chosen tab a raised pill in it.
    <div className="glass mb-5 flex p-1" style={{ borderRadius: 999 }} role="tablist">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          replace
          onClick={() => haptic('select')}
          role="tab"
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
