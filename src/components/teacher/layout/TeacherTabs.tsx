import { useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTeacherStore } from '@/stores/teacherStore'
import { needsReview } from '@/lib/utils/assignments'
import { TEACHER_TABS } from './pages'

/**
 * The teacher's tab bar on a phone: Today, Calendar, Students, Review,
 * More. Hidden from lg up, where the rail takes over.
 */
export default function TeacherTabs() {
  const { pathname } = useLocation()
  const assignments = useTeacherStore((s) => s.assignments)
  const toReview = useMemo(() => assignments.filter(needsReview).length, [assignments])

  return (
    <nav
      aria-label="Main"
      className="grid shrink-0 grid-cols-5 lg:hidden"
      style={{
        background: 'var(--clay-surface)',
        borderTop: '1px solid var(--clay-line)',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
        paddingTop: 6,
      }}
    >
      {TEACHER_TABS.map((t) => {
        const extra = t.also?.some((p) => pathname.startsWith(p)) ?? false
        return (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            data-coach={`tab-${t.label.toLowerCase()}`}
            className="flex min-h-[50px] flex-col items-center justify-center gap-[3px]"
          >
            {({ isActive }) => {
              const on = isActive || extra
              return (
                <>
                  <span className="relative flex h-7 w-12 items-center justify-center rounded-full" style={{ background: on ? 'var(--clay-accent-soft)' : 'transparent', color: on ? 'var(--clay-accent-ink)' : 'var(--clay-dim)' }}>
                    <t.icon size={20} aria-hidden="true" />
                    {t.to === '/teacher/review' && toReview > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10.5px] font-bold text-white" style={{ background: 'var(--clay-accent-ink)' }}>
                        {toReview}
                      </span>
                    )}
                  </span>
                  <span className="text-[10.5px] leading-none" style={{ color: on ? 'var(--clay-accent-ink)' : 'var(--clay-dim)', fontWeight: on ? 700 : 600 }}>{t.label}</span>
                </>
              )
            }}
          </NavLink>
        )
      })}
    </nav>
  )
}
