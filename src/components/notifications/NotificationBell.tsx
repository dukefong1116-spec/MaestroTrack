import { useEffect, useRef, useState } from 'react'
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
export default function NotificationBell() {
  const { profile } = useAuth()
  const { items, unread, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && unread > 0) markAllRead()
  }

  return (
    <div ref={boxRef} className="relative">
      <motion.button
        onClick={toggle}
        whileTap={{ scale: 0.92 }}
        aria-label={unread > 0 ? `Notifications, ${unread} new` : 'Notifications'}
        className="relative flex h-9 w-9 items-center justify-center rounded-full"
        style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}
      >
        <Bell size={16} />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 520, damping: 22 }}
              className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
              style={{ background: 'var(--clay-accent)', color: 'var(--clay-on-accent)' }}
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <NotificationPanel
            items={items}
            readAt={profile?.notificationsReadAt}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
