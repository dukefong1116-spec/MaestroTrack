import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStudio } from '@/hooks/useStudio'
import { useTeacherStore } from '@/stores/teacherStore'
import { needsReview } from '@/lib/utils/assignments'
import { useNativeTabBar } from '@/lib/nativeTabBar'
import { TEACHER_TABS } from '@/components/teacher/layout/pages'
import { homeFor, navFor, settingsFor } from './nav'

/**
 * The same tabs the web tab bars show, in the same order, handed to the
 * iPhone app's native tab bar. Does nothing outside the app.
 */
export function useAppNativeTabs(teacher: boolean, inStudio: boolean, here: string, visible: boolean) {
  const { profile } = useAuth()
  const { studioAttention } = useStudio()
  const toReview = useTeacherStore((s) => s.assignments.filter(needsReview).length)
  const role = teacher ? 'teacher' : profile?.role ?? 'student'

  const tabs = useMemo(() => {
    if (teacher) {
      return TEACHER_TABS.map((t) => ({ to: t.to, title: t.label, badge: t.to === '/teacher/review' && toReview > 0 ? String(toReview) : undefined }))
    }
    // As BottomTabs: Today in the middle; Studio in Settings' place for a
    // student in a studio.
    const home = homeFor(role)
    const items = navFor(role, inStudio)
    const rest = items.filter((t) => t.to !== home)
    const after = inStudio ? rest : [...rest, { to: settingsFor(role), label: 'Settings' }]
    const mid = Math.floor((after.length + 1) / 2)
    const homeTab = items.find((t) => t.to === home)
    const order = homeTab ? [...after.slice(0, mid), homeTab, ...after.slice(mid)] : after
    return order.map((t) => ({ to: t.to, title: t.label, badge: t.to === '/student/studio' && studioAttention > 0 ? String(studioAttention) : undefined }))
  }, [teacher, role, inStudio, toReview, studioAttention])

  // The lit tab: this page if it is one; for a teacher, More stays lit on
  // the pages opened from it.
  const current = useMemo(() => {
    const exact = tabs.find((t) => t.to === here)?.to
    if (exact) return exact
    if (teacher) return TEACHER_TABS.find((t) => t.also?.some((p) => here.startsWith(p)))?.to
    if (here.startsWith('/student/practice')) return '/student/practice'
    return undefined
  }, [tabs, here, teacher])

  useNativeTabBar(tabs, current, visible)
}
