import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { useTour } from '@/hooks/useTour'
import { usePracticeStore } from '@/stores/practiceStore'
import { useTourStore } from '@/stores/tourStore'
import { whatToShow, INTRO_SEEN, type Show } from '@/lib/utils/tour'
import { NoteGlyph } from '@/components/icons/InstrumentIcon'

/**
 * Draws the tour: a speech bubble, a ring round the thing it is about,
 * and — on the steps that can't be skipped — a shade over everything else
 * that swallows taps, so the lit element is the only way on.
 *
 * Mounted once, app-wide, because the first session runs outside the main
 * layout. What to show is decided by whatToShow (lib/utils/tour); this
 * only measures, draws, and moves things on.
 *
 * Never a trap: if the element a must-tap step points at cannot be found,
 * a Continue button appears after a few seconds.
 */

interface Box { top: number; left: number; width: number; height: number }

const PAD = 6
/** Everything but the lit element fades back into the page's own colour. */
const FADE = 'color-mix(in srgb, var(--clay-bg) 80%, transparent)'
const MISSING_GRACE_MS = 4000
/** Room between the lit element and the bubble's arrow. */
const GAP = 14
/** Everything eases in rather than switching on: the fade first, then the
 *  bubble drifts up a moment later, so things arrive one at a time. */
const EASE_OUT = [0.16, 1, 0.3, 1] as const
const FADE_IN = { duration: 0.5, ease: 'easeOut' } as const
const DRIFT = { duration: 0.55, ease: EASE_OUT, delay: 0.26 } as const

/** The first matching element that is actually on screen — the sidebar
 *  and the bottom tabs carry the same names, and only one is visible. */
function measure(target: string): Box | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-coach="${target}"]`)) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }
  }
  return null
}

export default function TourLayer() {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const pieces = usePracticeStore((s) => s.pieces)
  const sub = useTourStore((s) => s.sub)
  const setSub = useTourStore((s) => s.setSub)
  const { setTour, markSeen } = useTour()

  const onboarding = profile?.role === 'student' ? profile.onboarding : undefined
  const decision = useMemo(() => whatToShow({
    tour: onboarding?.tour,
    seen: onboarding?.seen,
    path: pathname,
    sub,
    hasPieces: pieces.some((p) => !p.status || p.status === 'active'),
    firstName: (profile?.displayName ?? '').trim().split(/\s+/)[0] || 'there',
  }), [onboarding?.tour, onboarding?.seen, pathname, sub, pieces, profile?.displayName])

  const show: Show | null = decision.kind === 'show' ? decision.show : null

  // In the tour but somewhere else: back to Today, where it carries on.
  useEffect(() => {
    if (decision.kind === 'redirect') navigate(decision.to, { replace: true })
  }, [decision, navigate])

  // The session's own steps end with the session.
  useEffect(() => {
    if (pathname !== '/student/session' && sub !== null) setSub(null)
  }, [pathname, sub, setSub])

  /** The step is done: move on. */
  const advance = useRef<(id: Show['id']) => void>(() => {})
  advance.current = (id) => {
    switch (id) {
      case 'welcome': return setTour('today')
      case 'today': return setTour('start')
      case 'category': return setSub('tools')
      case 'tools': return setSub('finish')
      case 'finish': return setSub('saving')
      case 'streak': return setTour('history')
      case 'history': return setTour('done')
      case 'start': return // Start itself opens the session, where the tour carries on
      default: {
        const seenId = INTRO_SEEN[id]
        if (seenId) markSeen(seenId)
      }
    }
  }

  // Where the lit element is, kept current: things animate in, scroll,
  // and resize, and the ring has to follow.
  const [box, setBox] = useState<Box | null>(null)
  const [missing, setMissing] = useState(false)
  /** A celebration has the screen; the tour waits its turn. */
  const [waiting, setWaiting] = useState(false)
  const showId = show?.id
  const showTarget = show?.target
  useEffect(() => {
    setMissing(false)
    if (!showId) return
    const target = showTarget
    // Kept, not cleared, between two lit steps — the hole travels from the
    // last target to the next instead of closing and reopening.
    if (!target) setBox(null)
    let scrolled = false
    const tick = () => {
      setWaiting(!!document.querySelector('[data-tour-wait]'))
      if (!target) return
      const b = measure(target)
      setBox((prev) => (prev && b && prev.top === b.top && prev.left === b.left
        && prev.width === b.width && prev.height === b.height ? prev : b))
      if (b && !scrolled) {
        scrolled = true
        const off = b.top < 0 || b.top + b.height > window.innerHeight
        if (off) document.querySelector(`[data-coach="${target}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }
    tick()
    const timer = window.setInterval(tick, 200)
    const grace = target
      ? window.setTimeout(() => { if (!measure(target)) setMissing(true) }, MISSING_GRACE_MS)
      : undefined
    return () => { window.clearInterval(timer); window.clearTimeout(grace) }
  }, [showId, showTarget])

  // The bubble's height, to know whether it fits under the lit element.
  const bubbleRef = useRef<HTMLDivElement>(null)
  const [bubbleH, setBubbleH] = useState(110)
  useLayoutEffect(() => {
    const h = bubbleRef.current?.offsetHeight
    if (h && h !== bubbleH) setBubbleH(h)
  }, [showId, waiting, missing, bubbleH])

  // A must-tap step moves on when its element is tapped. Listened for on
  // the way down, and acted on after, so the tap itself still does what
  // it always does — Start still starts, a chip is still picked.
  useEffect(() => {
    if (!show?.mustTap || !show.target) return
    const id = show.id
    const target = show.target
    const chips = id === 'category' || id === 'piece-prompt'
    const onClick = (e: MouseEvent) => {
      const el = e.target as Element | null
      const inside = el?.closest(`[data-coach="${target}"]`)
      if (!inside) return
      if (chips && !el?.closest('button')) return
      window.setTimeout(() => advance.current(id), 0)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [show?.id, show?.mustTap, show?.target])

  if (!show || waiting) return null

  const mandatoryPhase = onboarding?.tour !== 'done'
  const canSkip = mandatoryPhase && onboarding?.replay
  const fallback = show.mustTap && missing && !box

  // The bubble points at what it is talking about: under it where there
  // is room, above it where there is not, and its arrow lined up with the
  // middle of it. With nothing lit it sits low and plain.
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(vw * 0.92, show.big ? 420 : 380)
  // Centred under what it points at, kept on screen — on a desktop the
  // sidebar is far from the middle, and the arrow has to reach it.
  const left = box
    ? Math.max(12, Math.min(vw - width - 12, box.left + box.width / 2 - width / 2))
    : (vw - width) / 2
  let place: { top: number; arrow: 'up' | 'down'; arrowX: number } | null = null
  if (box) {
    const below = box.top + box.height + GAP
    const fitsBelow = below + bubbleH + 16 <= vh
    const arrowX = Math.max(22, Math.min(width - 22, box.left + box.width / 2 - left))
    place = fitsBelow
      ? { top: below, arrow: 'up', arrowX }
      : { top: Math.max(16, box.top - GAP - bubbleH), arrow: 'down', arrowX }
  }

  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: 70 }} aria-live="polite">
      {/* What stops taps: four clear panels round the lit element, leaving
          a hole that taps go straight through — or all of it, with nothing
          lit. They draw nothing themselves. */}
      {show.block && (box ? (
        <>
          <div className="pointer-events-auto fixed left-0 right-0 top-0" style={{ height: Math.max(0, box.top) }} />
          <div className="pointer-events-auto fixed left-0 right-0 bottom-0" style={{ top: box.top + box.height }} />
          <div className="pointer-events-auto fixed left-0" style={{ top: box.top, height: box.height, width: Math.max(0, box.left) }} />
          <div className="pointer-events-auto fixed right-0" style={{ top: box.top, height: box.height, left: box.left + box.width }} />
        </>
      ) : (
        <div className="pointer-events-auto fixed inset-0" />
      ))}

      {/* The fade: one enormous spread shadow in the page's own colour,
          round a hole over the lit element (or a hole of nothing, mid-
          screen, when nothing is lit). One element for every step, so
          from one step to the next it never goes away and comes back —
          the hole just travels. It eases out on the steps that leave the
          screen usable, and back in after. */}
      <motion.div
        className="fixed"
        initial={{ opacity: 0, ...(box ?? { top: vh / 2, left: vw / 2, width: 0, height: 0 }) }}
        animate={{ opacity: show.block ? 1 : 0, ...(box ?? { top: vh / 2, left: vw / 2, width: 0, height: 0 }) }}
        transition={{ default: { type: 'spring', stiffness: 260, damping: 32 }, opacity: FADE_IN }}
        style={{ borderRadius: 'var(--clay-r-md)', boxShadow: `0 0 0 9999px ${FADE}` }}
      />

      {box && (
        <>
          {/* And a ripple, so the eye finds it. */}
          <div
            className="tour-ripple fixed"
            style={{ top: box.top, left: box.left, width: box.width, height: box.height, borderRadius: 'var(--clay-r-md)' }}
          />
        </>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={show.id}
          ref={bubbleRef}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={DRIFT}
          role="dialog"
          aria-label="Guide"
          // A bubble with nothing to press never takes a tap: on the
          // "tap Finish" step it may sit over the tools, which must still work.
          className={`${show.button || fallback || canSkip ? 'pointer-events-auto' : 'pointer-events-none'} fixed ${show.big ? 'px-5 py-5' : 'px-4 py-3.5'}`}
          style={{
            left,
            width,
            ...(place ? { top: place.top } : { bottom: 'calc(96px + env(safe-area-inset-bottom))' }),
            background: 'var(--clay-surface)',
            color: 'var(--clay-ink)',
            borderRadius: 'var(--clay-r-lg)',
            boxShadow: 'var(--clay-deep)',
          }}
        >
          {place && (
            <span
              aria-hidden
              className="absolute h-3.5 w-3.5"
              style={{
                left: place.arrowX - 7,
                ...(place.arrow === 'up' ? { top: -6 } : { bottom: -6 }),
                background: 'var(--clay-surface)',
                transform: 'rotate(45deg)',
                borderRadius: 2,
              }}
            />
          )}
          <div className={`relative flex items-start ${show.big ? 'gap-3.5' : 'gap-3'}`}>
            <span
              className={`mt-0.5 flex shrink-0 items-center justify-center rounded-full ${show.big ? 'h-11 w-11' : 'h-8 w-8'}`}
              style={{ background: 'var(--clay-accent-soft)', color: 'var(--clay-accent)' }}
            >
              <NoteGlyph size={show.big ? 24 : 18} />
            </span>
            <div className="flex-1">
              {show.title && <p className="mb-1 text-[19px] font-bold leading-tight">{show.title}</p>}
              <p className={`${show.big ? 'text-[15.5px]' : 'text-[14.5px]'} leading-snug`}>{show.text}</p>
            </div>
          </div>
          {(show.button || fallback || canSkip || show.progress) && (
            <div className={`relative flex items-center justify-end gap-2 ${show.big ? 'mt-4' : 'mt-3'}`}>
              {/* Where they are in it: a short journey, not a string of pop-ups. */}
              {show.progress && (
                <span className="mr-auto flex items-center gap-1.5" aria-label={`Step ${show.progress[0]} of ${show.progress[1]}`}>
                  {Array.from({ length: show.progress[1] }, (_, n) => (
                    <span
                      key={n}
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: n + 1 === show.progress![0] ? 14 : 6,
                        background: n < show.progress![0] ? 'var(--clay-accent)' : 'var(--clay-line)',
                      }}
                    />
                  ))}
                </span>
              )}
              {canSkip && (
                <button
                  type="button"
                  onClick={() => { setSub(null); setTour('done') }}
                  className={`${show.progress ? '' : 'mr-auto '}px-2 py-1.5 text-[13px] font-medium`}
                  style={{ color: 'var(--clay-dim)' }}
                >
                  Skip tour
                </button>
              )}
              {(show.button || fallback) && (
                <button
                  type="button"
                  onClick={() => {
                    // A fallback stands in for the tap that could not be
                    // made, so it does what that tap would have done.
                    if (fallback && show.id === 'start') return navigate('/student/session')
                    if (fallback && show.id === 'history') navigate('/student/practice')
                    advance.current(show.id)
                  }}
                  className={`${show.big ? 'px-5 py-2.5 text-[15px]' : 'px-4 py-2 text-[14px]'} font-semibold`}
                  style={{ background: 'var(--clay-accent)', color: 'var(--clay-on-accent)', borderRadius: 'var(--clay-r-sm)' }}
                >
                  {show.button ?? 'Continue'}
                </button>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
