import { LayoutDashboard, Users, CalendarDays, ClipboardCheck, Wallet, LineChart, Sun, MoreHorizontal, type LucideIcon } from 'lucide-react'

/** The teacher's pages, in menu order (desktop rail). */
export const TEACHER_PAGES: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/teacher', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/teacher/students', label: 'Students', icon: Users },
  { to: '/teacher/calendar', label: 'Calendar & Attendance', icon: CalendarDays },
  { to: '/teacher/review', label: 'To review', icon: ClipboardCheck },
  { to: '/teacher/families', label: 'Families & Invoices', icon: Wallet },
  { to: '/teacher/reports', label: 'Reports', icon: LineChart },
]

/** The phone's five tabs; everything else is under More. */
export const TEACHER_TABS: { to: string; label: string; icon: LucideIcon; end?: boolean; also?: string[] }[] = [
  { to: '/teacher', label: 'Today', icon: Sun, end: true },
  { to: '/teacher/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/teacher/students', label: 'Students', icon: Users },
  { to: '/teacher/review', label: 'Review', icon: ClipboardCheck },
  { to: '/teacher/more', label: 'More', icon: MoreHorizontal, also: ['/teacher/families', '/teacher/reports', '/teacher/settings', '/teacher/messages', '/teacher/research'] },
]
