import { NavLink } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import Sticker from '@/components/stickers/Sticker'
import { cn } from '@/lib/utils/cn'
import { homeFor, navFor, settingsFor, studioNav, type NavItem } from './nav'
import { useStudio } from '@/hooks/useStudio'

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
function TabIcon({ icon, active, raised }: { icon: NavItem['icon']; active: boolean; raised?: boolean }) {
  if (typeof icon === 'string') {
    // On the selected raised tab the ground is coloured itself, so the
    // sticker's accent tone would be colour on colour.
    return <Sticker name={icon} size={raised ? 24 : 21} tone={raised && active ? 'onAccent' : active ? 'accent' : 'ink'} className="shrink-0" />
  }
  const Icon = icon
  return <Icon size={raised ? 24 : 21} className="shrink-0" />
}

export default function BottomTabs() {
  const { profile, user } = useAuth()
  const { unread } = useNotifications()
  const cachedRole = user ? localStorage.getItem(`maestro_role_${user.uid}`) : null
  const role = profile?.role ?? cachedRole

  const home = homeFor(role)

  /**
   * Home sits in the middle, raised.
   *
   * navFor lists it first, which is right for the sidebar — a vertical
   * list reads top down. A thumb does not: the centre of the bar is the
   * easiest place on the screen to reach, and the one screen you return
   * to between everything else belongs there rather than in the corner.
   *
   * Only the order shown here changes; navFor is untouched, so the
   * sidebar still opens with it.
   */
  // In a studio, Studio takes Settings' slot — five is all a phone holds —
  // and Settings opens from the photo on Today instead.
  const { inStudio, unreadMessages } = useStudio()
  const items = navFor(role, inStudio)
  const rest = items.filter((t) => t.to !== home)
  const homeTab = items.find((t) => t.to === home)
  const settingsTab: NavItem = { to: settingsFor(role), icon: Settings, label: 'Settings' }
  const after = inStudio ? rest : [...rest, settingsTab]
  const middle = Math.floor((after.length + 1) / 2)
  const tabs: NavItem[] = homeTab
    ? [...after.slice(0, middle), homeTab, ...after.slice(middle)]
    : after

  return (
    <nav
      aria-label="Main"
      // Not clipped: the raised tab breaks the top edge of the bar on
      // purpose, which is the whole point of it.
      className="relative grid shrink-0 grid-cols-5 lg:hidden"
      style={{
        background: 'var(--clay-surface)',
        borderTop: '1px solid var(--clay-line)',
        // The home indicator sits in the bottom inset on a modern iPhone;
        // without this the last row of labels lands underneath it.
        paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
        paddingTop: 7,
        overflow: 'visible',
      }}
    >
      {tabs.map(({ to, icon, label, short, end }) => {
        const raised = to === home
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            data-coach={`tab-${label.toLowerCase().replace(/\s+/g, '-')}`}
            className={({ isActive }) => cn(
              'relative flex min-h-[48px] flex-col items-center px-1',
              raised ? 'justify-end' : 'justify-center gap-[3px]',
              isActive ? 'font-semibold' : 'font-medium'
            )}
            style={({ isActive }) => ({
              color: isActive ? 'var(--clay-accent-ink)' : 'var(--clay-dim)',
            })}
          >
            {({ isActive }) => raised ? (
              <>
                {/* Lifted clear of the bar and given a ring of the page's
                    own ground, so it reads as cut out of the bar rather
                    than sitting on top of it. Neutral like every other
                    tab until it is the one you are on; then the accent. */}
                <span
                  className="absolute left-1/2 flex h-[54px] w-[54px] -translate-x-1/2 items-center justify-center rounded-full transition-[transform,background-color] active:scale-95"
                  style={{
                    top: -22,
                    background: isActive ? 'var(--clay-accent)' : 'var(--clay-bg-deep)',
                    color: isActive ? 'var(--clay-on-accent)' : 'var(--clay-dim)',
                    border: '4px solid var(--clay-bg)',
                  }}
                >
                  <TabIcon icon={icon} active={isActive} raised />
                  {unread > 0 && (
                    <span
                      className="absolute right-0 top-0 h-[10px] w-[10px] rounded-full"
                      style={{ background: 'var(--clay-ink)', border: `2px solid ${isActive ? 'var(--clay-accent)' : 'var(--clay-bg-deep)'}` }}
                    />
                  )}
                </span>
                <span className="mt-[30px] text-[10px] leading-none tracking-[-.1px]">
                  {short ?? label}
                </span>
              </>
            ) : (
              <>
                <span className="relative">
                  <TabIcon icon={icon} active={isActive} />
                  {to === studioNav.to && unreadMessages > 0 && (
                    <span
                      aria-label={`${unreadMessages} unread`}
                      className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full"
                      style={{ background: 'var(--clay-accent)' }}
                    />
                  )}
                </span>
                <span className="text-[10px] leading-none tracking-[-.1px]">{short ?? label}</span>
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}
