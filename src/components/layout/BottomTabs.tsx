import { NavLink } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import Sticker from '@/components/stickers/Sticker'
import { cn } from '@/lib/utils/cn'
import { homeFor, navFor, settingsFor, type NavItem } from './nav'

/**
 * The sidebar, rethought for a thumb.
 *
 * Five slots, because that is every destination the sidebar has and five is
 * as many as 390px holds at a 48px target. Log Out is deliberately not one
 * of them: it lives at the bottom of Settings, where reaching it is a
 * decision rather than a mis-tap.
 *
 * Hidden from `lg` up, where the sidebar takes over again — the desktop
 * layout is untouched by any of this.
 */
function TabIcon({ icon, active }: { icon: NavItem['icon']; active: boolean }) {
  if (typeof icon === 'string') {
    return <Sticker name={icon} size={21} tone={active ? 'accent' : 'ink'} className="shrink-0" />
  }
  const Icon = icon
  return <Icon size={21} className="shrink-0" />
}

export default function BottomTabs() {
  const { profile, user } = useAuth()
  const { unread } = useNotifications()
  const cachedRole = user ? localStorage.getItem(`maestro_role_${user.uid}`) : null
  const role = profile?.role ?? cachedRole

  const tabs: NavItem[] = [
    ...navFor(role),
    { to: settingsFor(role), icon: Settings, label: 'Settings' },
  ]

  return (
    <nav
      aria-label="Main"
      className="grid shrink-0 grid-cols-5 lg:hidden"
      style={{
        background: 'var(--clay-surface)',
        borderTop: '1px solid var(--clay-line)',
        // The home indicator sits in the bottom inset on a modern iPhone;
        // without this the last row of labels lands underneath it.
        paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
        paddingTop: 7,
      }}
    >
      {tabs.map(({ to, icon, label, short, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => cn(
            'relative flex min-h-[48px] flex-col items-center justify-center gap-[3px] px-1',
            isActive ? 'font-semibold' : 'font-medium'
          )}
          style={({ isActive }) => ({ color: isActive ? 'var(--clay-accent-ink)' : 'var(--clay-dim)' })}
        >
          {({ isActive }) => (
            <>
              <TabIcon icon={icon} active={isActive} />
              <span className="text-[10px] leading-none tracking-[-.1px]">{short ?? label}</span>
              {/* Same rule as the sidebar: a dot, not a number. The count
                  belongs to the bell, and two counts disagreeing is worse
                  than one. */}
              {unread > 0 && to === homeFor(role) && (
                <span
                  className="absolute right-[calc(50%-14px)] top-1.5 h-[7px] w-[7px] rounded-full"
                  style={{ background: 'var(--clay-accent)' }}
                />
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
