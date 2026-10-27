import { LayoutDashboard } from 'lucide-react'
import type { StickerName } from '@/components/stickers/Sticker'

/**
 * The one list of destinations, shared by the sidebar (desktop) and the
 * bottom tab bar (phone). Kept here rather than in either component so the
 * two cannot drift: a tab added for one is a tab added for both.
 */
export type NavItem = {
  to: string
  icon: StickerName | typeof LayoutDashboard
  label: string
  /** Used where a slot is ~78px wide; falls back to `label`. */
  short?: string
  end?: boolean
}

export const studentNav: NavItem[] = [
  { to: '/student', icon: LayoutDashboard, label: 'Today', end: true },
  { to: '/student/practice', icon: 'metro', label: 'Practice' },
  { to: '/student/library', icon: 'book', label: 'Library' },
  { to: '/student/progress', icon: 'target', label: 'Progress' },
]

export const teacherNav: NavItem[] = [
  { to: '/teacher', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/teacher/students', icon: 'users', label: 'My Students', short: 'Students' },
  { to: '/teacher/schedule', icon: 'calendar', label: 'Schedule' },
  { to: '/teacher/research', icon: 'chart', label: 'Research' },
]

export function navFor(role: string | null | undefined): NavItem[] {
  return role === 'teacher' ? teacherNav : studentNav
}

export function settingsFor(role: string | null | undefined): string {
  return role === 'teacher' ? '/teacher/settings' : '/student/settings'
}

/** Where notifications send people, per role — the dot goes on that tab. */
export function homeFor(role: string | null | undefined): string {
  return role === 'teacher' ? '/teacher' : '/student'
}
