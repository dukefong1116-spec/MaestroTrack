import { type ReactNode, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'rgba(58,48,84,.32)' }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className={`relative w-full ${widths[size]} overflow-hidden`}
            style={{
              background: 'var(--clay-surface)',
              borderRadius: 'var(--clay-r-lg)',
              boxShadow: 'var(--clay-deep)',
            }}
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ boxShadow: 'inset 0 -1px 0 var(--clay-line)' }}
            >
              <h2 className="text-lg font-bold" style={{ color: 'var(--clay-ink)', fontFamily: 'var(--clay-font)' }}>
                {title}
              </h2>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 transition-transform active:scale-90"
                style={{ color: 'var(--clay-faint)', background: 'var(--clay-bg)' }}
              >
                <X size={17} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[80vh]">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
