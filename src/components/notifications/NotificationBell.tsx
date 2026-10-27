import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import NotificationPanel from './NotificationPanel'

/**
 * The bell, and the count that makes someone look at it.
 *
 * Opening the panel marks everything read — not clicking each item. The
 * list is derived, so "read" is a point in time rather than a property of
 * any one row, and a badge that only clears item by item would stay lit
 * for things nobody intends to open.
 */
export default function NotificationBell({ label, floating }: { label?: string; floating?: boolean }) {
  const { profile } = useAuth()
  const { items, unread, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState({ top: 0, left: 0 })
  const boxRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  /**
   * Where to put the panel, measured rather than assumed.
   *
   * The bell lives in the sidebar, which is narrower than the panel and
   * scrolls — so anchoring the list inside it clipped the list at the
   * sidebar's edge and drew it over the navigation. It is rendered through
   * a portal instead, which means its position has to be computed here and
   * kept inside the viewport.
   */
  const place = useCallback(() => {
    const r = boxRef.current?.getBoundingClientRect()
    if (!r) return
    const PANEL_W = 310
    const GAP = 10
    // Beside the sidebar, not below the bell. Dropping it downwards put it
    // straight over the navigation — the rows someone is most likely to
    // want next after glancing at the list.
    const left = Math.min(r.right + GAP, window.innerWidth - PANEL_W - GAP)
    const top = Math.min(r.top, window.innerHeight - 160)
    setAnchor({ top: Math.max(GAP, top), left: Math.max(GAP, left) })
  }, [])

  useEffect(() => {
    if (!open) return
    place()
    window.addEventListener('resize', place)
    // Capture phase: the sidebar scrolls independently of the page, and a
    // listener on window alone never hears it.
    window.addEventListener('scroll', place, true)
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (boxRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, place])

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && unread > 0) markAllRead()
  }

  return (
    <div ref={boxRef} className={label ? 'w-full' : 'relative'}>
      {/* With a label it is a row like the navigation beside it; without
          one — a collapsed sidebar — it falls back to the icon alone. */}
      <motion.button
        onClick={toggle}
        whileTap={{ scale: 0.97 }}
        aria-label={unread > 0 ? `Notifications, ${unread} new` : 'Notifications'}
        className={
          label
            ? 'flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--clay-bg)]'
            : floating
              ? 'relative flex h-11 w-11 items-center justify-center rounded-full'
              : 'relative flex h-9 w-9 items-center justify-center rounded-full'
        }
        style={
          label
            ? { color: 'var(--clay-dim)' }
            : floating
              // On a phone this sits over the page rather than inside the
              // sidebar, so it needs its own surface to read as a control.
              ? { background: 'var(--clay-surface)', color: 'var(--clay-ink)', boxShadow: 'var(--clay-raised)' }
              : { background: 'var(--clay-bg)', color: 'var(--clay-ink)' }
        }
      >
        <span className="relative flex shrink-0 items-center justify-center">
          <Bell size={label || floating ? 18 : 16} />
          {!label && (
            <AnimatePresence>
              {unread > 0 && (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                  className="absolute -right-2 -top-2 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
                  style={{ background: 'var(--clay-accent)', color: 'var(--clay-on-accent)' }}
                >
                  {unread > 9 ? '9+' : unread}
                </motion.span>
              )}
            </AnimatePresence>
          )}
        </span>

        {label && <span>{label}</span>}

        {label && (
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                className="ml-auto flex h-[19px] min-w-[19px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-bold"
                style={{ background: 'var(--clay-accent)', color: 'var(--clay-on-accent)' }}
              >
                {unread > 9 ? '9+' : unread}
              </motion.span>
            )}
          </AnimatePresence>
        )}
      </motion.button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <NotificationPanel
              items={items}
              emptyText={
                profile?.role === 'teacher'
                  ? 'Nothing new from your students.'
                  : 'Nothing new. Go and practise something.'
              }
              readAt={profile?.notificationsReadAt}
              anchor={anchor}
              innerRef={panelRef}
              onClose={() => setOpen(false)}
            />
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
