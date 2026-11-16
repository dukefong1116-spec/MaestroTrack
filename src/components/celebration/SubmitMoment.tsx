import { useEffect } from 'react'
import { motion } from 'framer-motion'
import Moment from './Moment'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { playSubmitChime } from '@/lib/utils/sound'

/**
 * Handing an assignment in.
 *
 * Shorter and quieter than the badge and mastery moments on purpose. This
 * happens often — potentially several times a week — and a full fanfare
 * every time would become something to sit through rather than enjoy.
 *
 * The motion is a departure rather than an arrival: the note lifts, arcs
 * away and shrinks, leaving a ripple where it was. Nothing lands, because
 * nothing has been decided yet.
 */
export default function SubmitMoment({
  open, title, hadRecording, onDismiss,
}: {
  open: boolean
  /** The assignment handed in, echoed back so it is clear what was sent. */
  title: string
  hadRecording: boolean
  onDismiss: () => void
}) {
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (open) playSubmitChime()
  }, [open])

  if (!open) return null

  return (
    <Moment open={open} onDismiss={onDismiss} autoDismissMs={2400}>
      <div
        className="relative overflow-hidden px-9 py-10 text-center"
        style={{
          background: 'var(--clay-surface)',
          borderRadius: 'var(--clay-r-lg)',
          boxShadow: 'var(--clay-deep)',
        }}
      >
        <div className="relative mx-auto mb-5 h-[92px] w-[132px]">
          {/* the ripple it leaves behind */}
          {!reduced && (
            <motion.span
              className="absolute left-1/2 top-[58px] -translate-x-1/2 rounded-full"
              style={{ width: 54, height: 54, border: '2px solid var(--clay-accent)' }}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: [0.3, 1.6], opacity: [0, 0.5, 0] }}
              transition={{ delay: 0.22, duration: 0.8, ease: 'easeOut' }}
            />
          )}

          {/* the note, leaving */}
          <motion.svg
            width="52" height="52" viewBox="0 0 48 48" fill="none"
            className="absolute left-1/2 top-[42px]"
            style={{ marginLeft: -26 }}
            initial={reduced ? { opacity: 0 } : { y: 10, x: 0, scale: 1, opacity: 0, rotate: -8 }}
            animate={
              reduced
                ? { opacity: 1 }
                : { y: [10, -34, -52], x: [0, 26, 46], scale: [1, 0.92, 0.62], opacity: [0, 1, 0], rotate: [-8, 6, 16] }
            }
            transition={reduced ? { duration: 0.2 } : { duration: 1.25, times: [0, 0.45, 1], ease: [0.3, 0, 0.2, 1] }}
            aria-hidden="true"
          >
            <rect x="5" y="7" width="38" height="30" rx="6" fill="#FFEFE3" />
            <path d="M5 13l19 13 19-13" stroke="var(--clay-accent)" strokeWidth="3"
                  strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <rect x="5" y="7" width="38" height="30" rx="6" stroke="var(--clay-accent)" strokeWidth="3" fill="none" />
          </motion.svg>

          {/* a short trail, so it reads as travelling */}
          {!reduced && [0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute left-1/2 top-[62px] rounded-full"
              style={{ width: 5, height: 5, background: 'var(--clay-accent)' }}
              initial={{ opacity: 0, x: 0, y: 0 }}
              animate={{ opacity: [0, 0.5, 0], x: [-4, -16 - i * 9], y: [4, 12 + i * 5] }}
              transition={{ delay: 0.3 + i * 0.07, duration: 0.6, ease: 'easeOut' }}
            />
          ))}
        </div>

        <motion.p
          className="text-[10px] font-bold uppercase tracking-[.18em]"
          style={{ color: 'var(--clay-accent)' }}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Handed in
        </motion.p>

        <motion.h2
          className="mx-auto mt-1.5 max-w-[20ch] text-[22px] font-bold leading-tight"
          style={{ color: 'var(--clay-ink)', fontFamily: 'var(--clay-font)' }}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.58, duration: 0.4 }}
        >
          {title}
        </motion.h2>

        <motion.p
          className="mt-2 text-[12.5px]"
          style={{ color: 'var(--clay-dim)' }}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.72 }}
        >
          {hadRecording
            ? 'Your teacher will hear it and reply.'
            : 'Your teacher will take a look and reply.'}
        </motion.p>
      </div>
    </Moment>
  )
}
