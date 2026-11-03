import { AnimatePresence, motion } from 'framer-motion'
import Button from './Button'

/**
 * "Are you sure?" for something that cannot be undone.
 *
 * Deliberately not built on Modal. The things worth confirming are
 * usually offered from inside a sheet already — a take inside the
 * session detail — and Modal sits at z-50, so one opened over another
 * would be drawn underneath it. This sits above both.
 *
 * Cancel is the wide one and comes first: the common answer to a
 * question nobody went looking for is no, so the easy target is the one
 * that changes nothing. Same reasoning as the log-out sheet.
 */
export default function ConfirmSheet({
  open, title, body, confirmLabel = 'Delete', busy = false, onCancel, onConfirm,
}: {
  open: boolean
  title: string
  body?: string
  confirmLabel?: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
        >
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'rgba(58,48,84,.45)' }}
            onClick={busy ? undefined : onCancel}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-label={title}
            className="relative w-full max-w-[380px] px-6 py-6"
            style={{
              background: 'var(--clay-surface)',
              borderRadius: 'var(--clay-r-lg)',
              boxShadow: 'var(--clay-deep)',
            }}
            initial={{ y: 30, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          >
            <p className="text-[17px] font-bold" style={{ color: 'var(--clay-ink)' }}>{title}</p>
            {body && (
              <p className="mt-2 text-sm" style={{ color: 'var(--clay-dim)' }}>{body}</p>
            )}
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onCancel} disabled={busy}>
                Keep it
              </Button>
              <Button variant="danger" onClick={onConfirm} loading={busy}>
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
