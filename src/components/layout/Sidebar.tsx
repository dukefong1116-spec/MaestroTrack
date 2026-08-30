import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Music2, BookOpen, Mic, Target, Trophy, Bell, Brain,
  Users, BarChart3, Settings, LogOut, ChevronLeft, ChevronRight, CalendarDays
} from 'lucide-react'
import { useState } from 'react'
import { logOut } from '@/lib/firebase/auth'
import { useAuth } from '@/hooks/useAuth'
import { getTheme } from '@/lib/utils/instruments'
import { cn } from '@/lib/utils/cn'
import type { InstrumentType } from '@/types'

const studentNav = [
  { to: '/student', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/student/practice', icon: Music2, label: 'Practice Log' },
  { to: '/student/pieces', icon: BookOpen, label: 'My Pieces' },
  { to: '/student/recordings', icon: Mic, label: 'Recordings' },
  { to: '/student/goals', icon: Target, label: 'Goals' },
  { to: '/student/performances', icon: Trophy, label: 'Performances' },
  { to: '/student/insights', icon: Brain, label: 'AI Insights' },
  { to: '/student/reminders', icon: Bell, label: 'Reminders' },
]

const teacherNav = [
  { to: '/teacher', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/teacher/students', icon: Users, label: 'My Students' },
  { to: '/teacher/schedule', icon: CalendarDays, label: 'Schedule' },
  { to: '/teacher/research', icon: BarChart3, label: 'Research' },
]

export default function Sidebar() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const theme = getTheme(profile?.instrument as InstrumentType | undefined)
  const cachedRole = user ? localStorage.getItem(`maestro_role_${user.uid}`) : null
  const role = profile?.role ?? cachedRole
  const nav = role === 'teacher' ? teacherNav : studentNav

  async function handleLogout() {
    await logOut()
    navigate('/login')
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 240 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative flex flex-col h-screen shrink-0 overflow-hidden"
      style={{ background: '#22201C', borderRight: '1px solid #33302C' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid #33302C' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}>
          {theme.emoji}
        </div>
        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="font-bold text-sm leading-tight" style={{ color: '#F5F0EB' }}>MaestroTrack</p>
            <p className="text-xs" style={{ color: '#A09C95' }}>{profile?.displayName}</p>
          </motion.div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
              isActive ? 'text-white shadow-sm' : 'hover:bg-white/10'
            )}
            style={({ isActive }) =>
              isActive
                ? { backgroundColor: '#E8503A', color: '#ffffff' }
                : { color: '#A09C95' }
            }
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-4 space-y-0.5 pt-3" style={{ borderTop: '1px solid #33302C' }}>
        <NavLink
          to={role === 'teacher' ? '/teacher/settings' : '/student/settings'}
          className={({ isActive }) => cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
            isActive ? 'text-white shadow-sm' : 'hover:bg-white/10'
          )}
          style={({ isActive }) =>
            isActive
              ? { backgroundColor: '#E8503A', color: '#ffffff' }
              : { color: '#A09C95' }
          }
        >
          <Settings size={18} className="shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 hover:bg-red-500/20"
          style={{ color: '#A09C95' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#F87171')}
          onMouseLeave={e => (e.currentTarget.style.color = '#A09C95')}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Log Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-[72px] rounded-full p-0.5 z-10 shadow-md transition-colors"
        style={{ background: '#33302C', border: '1px solid #44403A', color: '#A09C95' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#F5F0EB')}
        onMouseLeave={e => (e.currentTarget.style.color = '#A09C95')}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </motion.aside>
  )
}
