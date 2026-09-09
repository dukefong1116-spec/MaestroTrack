import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, Settings, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { logOut } from '@/lib/firebase/auth'
import { useAuth } from '@/hooks/useAuth'
import { getTheme } from '@/lib/utils/instruments'
import InstrumentIcon from '@/components/icons/InstrumentIcon'
import Sticker, { type StickerName } from '@/components/stickers/Sticker'
import { cn } from '@/lib/utils/cn'
import type { InstrumentType } from '@/types'

const studentNav: { to: string; icon: StickerName | typeof LayoutDashboard; label: string; end?: boolean }[] = [
  { to: '/student', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/student/practice', icon: 'metro', label: 'Practice Log' },
  { to: '/student/pieces', icon: 'book', label: 'My Pieces' },
  { to: '/student/goals', icon: 'target', label: 'Goals' },
  { to: '/student/performances', icon: 'trophy', label: 'Performances' },
  { to: '/student/insights', icon: 'brain', label: 'AI Insights' },
  { to: '/student/reminders', icon: 'bell', label: 'Reminders' },
]

const teacherNav: { to: string; icon: StickerName | typeof LayoutDashboard; label: string; end?: boolean }[] = [
  { to: '/teacher', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/teacher/students', icon: 'users', label: 'My Students' },
  { to: '/teacher/schedule', icon: 'calendar', label: 'Schedule' },
  { to: '/teacher/research', icon: 'chart', label: 'Research' },
]

function NavIcon({ icon, active }: { icon: StickerName | typeof LayoutDashboard; active: boolean }) {
  if (typeof icon === 'string') {
    return <Sticker name={icon} size={18} tone={active ? 'onAccent' : 'ink'} className="shrink-0" />
  }
  const Icon = icon
  return <Icon size={18} className="shrink-0" />
}

/**
 * Clay sidebar: white surface, no hard border — the puffy shadow on the
 * whole frame carries the separation instead. Dark charcoal read wrong
 * against Clay's airy lilac, so this flips from the Limestone version.
 */
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
      animate={{ width: collapsed ? 72 : 248 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative flex flex-col h-screen shrink-0 overflow-hidden"
      style={{ background: 'var(--clay-surface)', boxShadow: '2px 0 20px -8px rgba(58,48,84,.14)', zIndex: 1 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`, boxShadow: 'var(--clay-raised)' }}
        >
          <InstrumentIcon instrument={profile?.instrument as InstrumentType | undefined} size={19} className="text-white" />
        </div>
        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="font-bold text-sm leading-tight" style={{ color: 'var(--clay-ink)', fontFamily: 'var(--clay-font)' }}>
              MaestroTrack
            </p>
            <p className="text-xs" style={{ color: 'var(--clay-dim)' }}>{profile?.displayName}</p>
          </motion.div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2.5 space-y-1 overflow-y-auto">
        {nav.map(({ to, icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-150',
              !isActive && 'hover:bg-[var(--clay-bg)]'
            )}
            style={({ isActive }) =>
              isActive
                ? { background: 'var(--clay-accent)', color: 'var(--clay-on-accent)', boxShadow: 'var(--clay-accent-shadow)' }
                : { color: 'var(--clay-dim)' }
            }
          >
            {({ isActive }) => (
              <>
                <NavIcon icon={icon} active={isActive} />
                {!collapsed && <span>{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-2.5 pb-4 space-y-1 pt-2">
        <NavLink
          to={role === 'teacher' ? '/teacher/settings' : '/student/settings'}
          className={({ isActive }) => cn(
            'flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-150',
            !isActive && 'hover:bg-[var(--clay-bg)]'
          )}
          style={({ isActive }) =>
            isActive
              ? { background: 'var(--clay-accent)', color: 'var(--clay-on-accent)', boxShadow: 'var(--clay-accent-shadow)' }
              : { color: 'var(--clay-dim)' }
          }
        >
          <Settings size={18} className="shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-150 hover:bg-[#FFE3E7]"
          style={{ color: 'var(--clay-dim)' }}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Log Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-[72px] rounded-full p-1 z-10 transition-transform active:scale-90"
        style={{ background: 'var(--clay-surface)', boxShadow: 'var(--clay-raised)', color: 'var(--clay-dim)' }}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </motion.aside>
  )
}
