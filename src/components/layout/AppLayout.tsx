import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomTabs from './BottomTabs'
import { usePrefs } from '@/hooks/usePrefs'
import { useAuth } from '@/hooks/useAuth'
import TeacherRail from '@/components/teacher/layout/TeacherRail'
import TeacherTabs from '@/components/teacher/layout/TeacherTabs'
import MessageDock from '@/components/teacher/layout/MessageDock'

export default function AppLayout() {
  // Mounted once for the whole signed-in app: reading the preferences is
  // what puts them into effect, so the theme, accent, display size and
  // motion setting follow the profile rather than the device.
  usePrefs()
  const { profile, user } = useAuth()
  const cachedRole = user ? localStorage.getItem(`maestro_role_${user.uid}`) : null
  const teacher = (profile?.role ?? cachedRole) === 'teacher'

  return (
    <div
      // 100dvh, not 100vh: on mobile Safari the toolbar slides in and out,
      // and vh keeps reporting the taller figure.
      className="flex h-[100dvh] overflow-hidden"
      style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)', fontFamily: 'var(--clay-font)' }}
    >
      {/* A teacher gets the studio's icon rail; a student keeps the sidebar. */}
      {teacher ? <TeacherRail /> : <Sidebar />}

      {/*
        A column, so the tab bar is a sibling of the scroll area rather than
        a fixed overlay on top of it. Fixed positioning resolves against the
        layout viewport, which on iOS Safari drifts away from the visual one
        while the toolbar animates — that gap is what showed through as a
        band under the content. Two boxes in the same flex column cannot
        come apart, and the content no longer needs padding to dodge a bar
        that is overlapping it.
      */}
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="no-scrollbar flex-1 overflow-y-auto overscroll-contain">
          <div className={teacher ? 'clay-zoom mx-auto max-w-[1320px] px-3 py-4 sm:px-5 lg:px-4 lg:pb-24' : 'clay-zoom max-w-7xl mx-auto px-6 py-8'}>
            <Outlet />
          </div>
        </main>
        {teacher ? <TeacherTabs /> : <BottomTabs />}
      </div>
      {teacher && <MessageDock />}
    </div>
  )
}
