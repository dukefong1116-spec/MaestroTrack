import { motion } from 'framer-motion'
import Sticker from '@/components/stickers/Sticker'
import { usePracticeNudges, type NudgeTone } from '@/hooks/usePracticeNudges'
import { useAuth } from '@/hooks/useAuth'

const TONE: Record<NudgeTone, { bg: string; fg: string }> = {
  success: { bg: 'var(--clay-success-bg)', fg: 'var(--clay-success-fg)' },
  warning: { bg: 'var(--clay-warning-bg)', fg: 'var(--clay-warning-fg)' },
  info: { bg: 'var(--clay-accent-soft)', fg: 'var(--clay-accent-ink)' },
}

/**
 * Timely prompts, shown where they'll actually be seen. Renders nothing
 * when there's nothing worth saying — an empty "no reminders" card is
 * noise, not reassurance.
 */
export default function NudgeList({ limit = 3 }: { limit?: number }) {
  const { profile } = useAuth()
  const nudges = usePracticeNudges(limit)
  // Switched off in Settings → Notifications. Checked after the hook, not
  // around it, because a hook cannot be called conditionally.
  if (profile?.notify?.nudges === false) return null
  if (nudges.length === 0) return null

  return (
    <div className="space-y-2.5">
      {nudges.map((n, i) => {
        const tone = TONE[n.tone]
        return (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center gap-3 px-4 py-3"
            style={{
              background: 'var(--clay-surface)',
              borderRadius: 'var(--clay-r-md)',
              boxShadow: 'var(--clay-raised)',
            }}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
              style={{ background: tone.bg, color: tone.fg }}
            >
              <Sticker name={n.sticker} size={15} tone="accent" />
            </span>
            <p className="text-[13px] font-medium" style={{ color: 'var(--clay-ink)' }}>
              {n.text}
            </p>
          </motion.div>
        )
      })}
    </div>
  )
}
