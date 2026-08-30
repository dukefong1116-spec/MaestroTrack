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
            style={{ background: 'rgba(34,32,28,.35)' }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className={`relative w-full ${widths[size]} rounded-2xl overflow-hidden`}
            style={{
              background: '#F8F6F2',
              border: '1px solid #DEDAD2',
              boxShadow: '0 24px 64px -12px rgba(34,32,28,.22)',
            }}
          >
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #E8E4DC' }}>
              <h2 className="text-lg font-semibold" style={{ color: '#22201C' }}>{title}</h2>
              <button
                onClick={onClose}
                className="transition-colors p-1 rounded-lg"
                style={{ color: '#A09C95' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#22201C')}
                onMouseLeave={e => (e.currentTarget.style.color = '#A09C95')}
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[80vh]">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
