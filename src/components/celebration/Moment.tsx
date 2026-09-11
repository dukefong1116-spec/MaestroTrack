import { type ReactNode, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Volume2, VolumeX } from 'lucide-react'
import { isSoundMuted, setSoundMuted } from '@/lib/utils/sound'

interface MomentProps {
  open: boolean
  onDismiss: () => void
  children: ReactNode
  /** Scrim colour — freeze uses a cold tint, the rest use warm ink. */
  scrim?: string
  /** Milliseconds before it closes itself. */
  autoDismissMs?: number
  /** Hide the mute control (e.g. for a silent moment). */
  hideMute?: boolean
}

export function usePrefersReducedMotion(): boolean {
  const [reduced] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
  return reduced
}

/**
 * Full-screen celebration shell.
 *
 * Owns the parts every celebratory moment needs and must not diverge on:
 * scrim, spring entrance, auto-dismiss, Escape, tap-to-skip,
 * reduced-motion and the sound toggle. Each moment supplies only its
 * own contents.
 */
export default function Moment({
  open,
  onDismiss,
  children,
  scrim = 'rgba(58,48,84,.45)',
  autoDismissMs = 3200,
  hideMute,
}: MomentProps) {
  const [muted, setMuted] = useState(isSoundMuted)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(onDismiss, autoDismissMs)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss() }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onDismiss, autoDismissMs])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex cursor-pointer items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onDismiss}
          role="status"
          aria-live="polite"
        >
          <div className="absolute inset-0" style={{ background: scrim }} />

          {!hideMute && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                const next = !muted
                setMuted(next)
                setSoundMuted(next)
              }}
              className="absolute right-5 top-5 z-10 rounded-full p-2 transition-transform active:scale-90"
              style={{ background: 'rgba(255,255,255,.16)', color: '#fff' }}
              aria-label={muted ? 'Unmute celebration sound' : 'Mute celebration sound'}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          )}

          <motion.div
            className="relative w-full max-w-sm"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={
              reduced
                ? { duration: 0.18, delay: 0.08 }
                : { type: 'spring', stiffness: 360, damping: 24, delay: 0.08 }
            }
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
