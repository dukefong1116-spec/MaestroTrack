import { AnimatePresence, motion } from 'framer-motion'
import Sticker, { type StickerName } from '@/components/stickers/Sticker'

/**
 * The tools, taught where they are.
 *
 * Metronome, tuner and recording all live inside a session, so a
 * checklist on Today cannot teach them without sending somebody in, out,
 * and back in again. This is one line above the tool row instead.
 *
 * It advances on use rather than on a Next button: open the tool and the
 * line moves on. Ignore it and it is three small lines you scroll past,
 * which is the worst case worth designing for.
 */

export type CoachTool = 'metro' | 'tuner' | 'mic'

const LINES: { id: CoachTool; sticker: StickerName; say: string }[] = [
  { id: 'metro', sticker: 'metro', say: 'Metronome’s here. Set a tempo you can actually play at.' },
  { id: 'tuner', sticker: 'tuner', say: 'Tuner too, if you need it.' },
  { id: 'mic', sticker: 'mic', say: 'Hit Record. In a month you’ll want to hear this one.' },
]

export default function SessionCoach({ used, onSkip }: {
  /** Tools opened so far this session. */
  used: CoachTool[]
  onSkip: () => void
}) {
  const line = LINES.find((l) => !used.includes(l.id))
  if (!line) return null

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={line.id}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.18 }}
        className="mb-3 flex items-center gap-2.5 px-3.5 py-2.5"
        style={{
          borderRadius: 'var(--clay-r-sm)',
          background: 'var(--clay-accent-soft)',
          color: 'var(--clay-accent-ink)',
        }}
      >
        <Sticker name={line.sticker} size={16} tone="accent" />
        <span className="min-w-0 flex-1 text-[12.5px] font-semibold leading-snug">
          {line.say}
        </span>
        <button
          type="button"
          onClick={onSkip}
          className="shrink-0 text-[11px] font-semibold underline-offset-2 hover:underline"
          style={{ color: 'var(--clay-accent-ink)' }}
        >
          Got it
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
