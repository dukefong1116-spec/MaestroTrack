import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import Sticker from '@/components/stickers/Sticker'
import { isUnread, type AppNotification } from '@/lib/utils/notifications'

/**
 * The list itself.
 *
 * Positioned in viewport coordinates and rendered through a portal by the
 * bell, because the sidebar it is anchored to is narrower than the panel
 * and scrolls: left inside it, the list was clipped at the sidebar's edge
 * and drawn over the navigation.
 */
export default function NotificationPanel({
  items, loading, readAt, anchor, innerRef, emptyText, onClose,
}: {
  items: AppNotification[]
  /** Still arriving: a spinner, not the empty message. */
  loading?: boolean
  readAt?: string
  /** A teacher is not waiting to be told to go and practise. */
  emptyText: string
  /** Viewport coordinates, because this is rendered outside the sidebar. */
  anchor: { top: number; left: number }
  innerRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
}) {
  const navigate = useNavigate()

  return (
    <motion.div
      // Solid from the first frame. Fading in, the panel sat half see-through
      // over the page whenever the app was busy, and read as not opened.
      initial={{ y: -6, scale: 0.98 }}
      animate={{ y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      ref={innerRef}
      className="fixed z-[70] w-[310px] overflow-hidden p-1.5"
      style={{
        top: anchor.top,
        left: anchor.left,
        background: 'var(--clay-surface)',
        borderRadius: 'var(--clay-r-md)',
        boxShadow: 'var(--clay-deep)',
      }}
    >
      {loading ? (
        <div className="flex justify-center py-7" role="status" aria-label="Loading notifications">
          <span
            className="h-6 w-6 animate-spin rounded-full border-[2.5px]"
            style={{ borderColor: 'var(--clay-line)', borderTopColor: 'var(--clay-accent)' }}
          />
        </div>
      ) : items.length === 0 ? (
        <p className="px-3 py-6 text-center text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>
          {emptyText}
        </p>
      ) : (
        <ul className="max-h-[min(320px,calc(100dvh-7rem))] overflow-y-auto">
          {items.map((n) => {
            const fresh = isUnread(n, readAt)
            return (
              <li key={n.id}>
                <button
                  onClick={() => { navigate(n.to); onClose() }}
                  className="flex w-full items-start gap-2.5 rounded-[12px] px-2.5 py-2.5 text-left transition-colors hover:bg-[var(--clay-bg)]"
                >
                  <span className="mt-0.5 shrink-0">
                    <Sticker name={n.sticker} size={16} tone="ink" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="truncate text-[12.5px] font-semibold"
                        style={{ color: 'var(--clay-ink)' }}
                      >
                        {n.title}
                      </span>
                      {fresh && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: 'var(--clay-accent)' }}
                        />
                      )}
                    </span>
                    {n.body && (
                      <span className="mt-0.5 block truncate text-[11.5px]" style={{ color: 'var(--clay-dim)' }}>
                        {n.body}
                      </span>
                    )}
                    <span className="mt-0.5 block text-[10.5px]" style={{ color: 'var(--clay-faint)' }}>
                      {ago(n.at)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </motion.div>
  )
}

/** "in 40 minutes" reads wrong for something that has already happened. */
function ago(iso: string): string {
  try {
    const d = parseISO(iso)
    const future = d.getTime() > Date.now()
    const rel = formatDistanceToNowStrict(d)
    return future ? `in ${rel}` : `${rel} ago`
  } catch {
    return ''
  }
}

export { AnimatePresence }
