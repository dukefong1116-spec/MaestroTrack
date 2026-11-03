import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import ProgressRing from '@/components/ui/ProgressRing'
import { Panel, Block } from '@/components/ui/Panel'
import { useOnboarding } from '@/hooks/useOnboarding'

/**
 * The first five minutes, said one line at a time.
 *
 * Not an overlay tour. A dimmed screen with an arrow and a Next button
 * gets tapped through in seconds, teaches nothing, and has to be fought
 * past to use the app at all. This sits in the page and scrolls away
 * like everything else.
 *
 * It never congratulates you for reading. A step crosses itself off when
 * the data says you did the thing, so the list cannot be ahead of you or
 * behind you.
 */
export default function CoachCard() {
  const navigate = useNavigate()
  const { visible, celebrating, steps, next, doneCount, total, dismiss } = useOnboarding()

  if (!visible) return null

  if (celebrating || !next) {
    return (
      <Panel>
        <Block first>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3.5"
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'var(--clay-success-fg)', color: '#FFFFFF' }}
        >
          <Check size={20} strokeWidth={3} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-bold" style={{ color: 'var(--clay-ink)' }}>
            That's the tour.
          </p>
          <p className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>
            Everything else you'll find on your own. Go and play something.
          </p>
        </div>
      </motion.div>
        </Block>
      </Panel>
    )
  }

  const pct = Math.round((doneCount / total) * 100)

  return (
    <Panel>
      <Block first>
      <div className="flex items-start gap-4">
        <ProgressRing percentage={pct} size={56} strokeWidth={6} color="var(--clay-accent)">
          <p className="text-[12px] font-bold tabular-nums" style={{ color: 'var(--clay-ink)' }}>
            {doneCount}/{total}
          </p>
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clay-dim)' }}>
            Getting started
          </p>
          {/* Keyed on the step, so a completed one reads out and the next
              one reads in — the only animation here, and it marks the
              thing you just did. */}
          <AnimatePresence mode="wait">
            <motion.p
              key={next.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="mt-1 text-[15px] font-semibold leading-snug"
              style={{ color: 'var(--clay-ink)' }}
            >
              {next.say}
            </motion.p>
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide getting started"
          className="-mr-1 -mt-1 shrink-0 p-1"
          style={{ color: 'var(--clay-faint)' }}
        >
          <X size={16} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => navigate(next.to)}
        className="mt-3.5 flex min-h-[46px] w-full items-center justify-center text-[15px] font-bold transition-transform active:scale-[.99]"
        style={{
          borderRadius: 'var(--clay-r-sm)',
          background: 'var(--clay-accent)',
          color: 'var(--clay-on-accent)',
        }}
      >
        {next.action}
      </button>

      {/* The whole list, so the five minutes have a visible end. Done ones
          stay rather than vanishing: crossing something off is the point. */}
      <ul className="mt-3.5 space-y-1.5">
        {steps.map(({ step, done }) => (
          <li key={step.id} className="flex items-center gap-2.5">
            <span
              className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
              style={{
                background: done ? 'var(--clay-success-fg)' : 'transparent',
                border: done ? 'none' : '1.5px solid var(--clay-line)',
                color: '#FFFFFF',
              }}
            >
              {done && <Check size={11} strokeWidth={3.5} />}
            </span>
            <span
              className="min-w-0 flex-1 truncate text-[12.5px]"
              style={{
                color: done ? 'var(--clay-faint)' : 'var(--clay-dim)',
                textDecoration: done ? 'line-through' : 'none',
              }}
            >
              {step.action}
            </span>
          </li>
        ))}
      </ul>
      </Block>
    </Panel>
  )
}
