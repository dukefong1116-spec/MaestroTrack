import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TOUR, type TourStep } from '@/lib/utils/onboarding'

/**
 * Shows a new account round Today.
 *
 * The screen shades and one thing is left lit. The hole is cut with a
 * single enormous spread shadow rather than four panels or an SVG mask:
 * one element, one rectangle, and the rounded corner comes free.
 *
 * Nothing here captures taps. The lit element stays live — the backdrop
 * and the bubble are the only things that take a click, and the lit
 * element is a hole in a `pointer-events: none` box, so pressing Start
 * during the tour starts a session rather than being swallowed.
 */

interface Box { top: number; left: number; width: number; height: number }

const PAD = 8

function measure(target: string): Box | null {
  const el = document.querySelector<HTMLElement>(`[data-coach="${target}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  }
}

export default function Spotlight({ onDone }: { onDone: (reason: 'finished' | 'skipped') => void }) {
  const [i, setI] = useState(0)
  const [box, setBox] = useState<Box | null>(null)

  /** Steps whose target is not on this page are no use; skip past them. */
  const resolve = useCallback((from: number): { step: TourStep; box: Box } | null => {
    for (let n = from; n < TOUR.length; n += 1) {
      const b = measure(TOUR[n].target)
      if (b) return { step: TOUR[n], box: b }
    }
    return null
  }, [])

  // Before paint, so the first frame is already in the right place rather
  // than flashing in the corner and sliding over.
  useLayoutEffect(() => {
    const found = resolve(i)
    if (!found) { onDone('finished'); return }
    if (found.step !== TOUR[i]) setI(TOUR.indexOf(found.step))
    setBox(found.box)
  }, [i, resolve, onDone])

  // The lit box is in viewport coordinates, so anything that moves the
  // page moves it: a rotation, a keyboard, the address bar collapsing.
  useEffect(() => {
    const remeasure = () => {
      const b = measure(TOUR[i].target)
      if (b) setBox(b)
    }
    window.addEventListener('resize', remeasure)
    window.addEventListener('scroll', remeasure, true)
    return () => {
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('scroll', remeasure, true)
    }
  }, [i])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone('skipped')
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function next() {
    if (i >= TOUR.length - 1) { onDone('finished'); return }
    setI(i + 1)
  }

  const step = TOUR[i]
  if (!box) return null

  const last = i === TOUR.length - 1
  // Placed on the side the step asks for, unless there is no room there.
  const below = step.place === 'below'
    ? box.top + box.height + 14
    : null
  const above = step.place === 'above'
    ? Math.max(12, box.top - 14)
    : null

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="A quick look round">
      {/* The shade and the hole, in one element. */}
      <motion.div
        className="pointer-events-none absolute"
        initial={false}
        animate={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        style={{
          borderRadius: 14,
          boxShadow: '0 0 0 9999px rgba(26, 17, 25, .72)',
        }}
      />

      {/* Taps outside the lit area land here and end the tour, which is
          what someone who wants out will try first. */}
      <button
        type="button"
        aria-label="Skip the tour"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={() => onDone('skipped')}
        style={{ background: 'transparent' }}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: step.place === 'above' ? 8 : -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="absolute px-5"
          style={{
            left: 0,
            right: 0,
            ...(below !== null ? { top: below } : { bottom: `calc(100% - ${above}px)` }),
          }}
        >
          <div
            className="mx-auto w-full max-w-[380px] px-5 py-4"
            style={{
              background: 'var(--clay-surface)',
              borderRadius: 'var(--clay-r-md)',
              boxShadow: 'var(--clay-deep)',
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--clay-faint)' }}>
              {i + 1} of {TOUR.length}
            </p>
            <p className="mt-1.5 text-[17px] font-bold" style={{ color: 'var(--clay-ink)' }}>
              {step.title}
            </p>
            <p className="mt-1 text-[13.5px] leading-snug" style={{ color: 'var(--clay-dim)' }}>
              {step.body}
            </p>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => onDone('skipped')}
                className="text-[12.5px] font-semibold"
                style={{ color: 'var(--clay-dim)' }}
              >
                Skip
              </button>
              <button
                type="button"
                onClick={next}
                className="ml-auto min-h-[40px] px-5 text-[14px] font-bold transition-transform active:scale-95"
                style={{
                  borderRadius: 'var(--clay-r-sm)',
                  background: 'var(--clay-accent)',
                  color: 'var(--clay-on-accent)',
                }}
              >
                {last ? 'Got it' : 'Next'}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
