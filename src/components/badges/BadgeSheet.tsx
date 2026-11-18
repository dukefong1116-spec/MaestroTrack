import { Check, Lock, Pin, PinOff, Share2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import BadgeArt, { type BadgeArtName } from './BadgeArt'
import { badgeProgress, isEarned, type BadgeContext, type FamilyState } from '@/lib/utils/progression'
import { MAX_PINNED } from '@/hooks/usePinnedBadges'

/**
 * One badge family, in full: what you have, what is next, and how far.
 *
 * Uses the app's own Modal — the same sheet Change password opens — so
 * there is one way a sheet behaves rather than two.
 */

function amount(value: number, unit: string): string {
  if (unit === 'minutes') {
    const h = value / 60
    return h >= 1 ? `${Math.round(h * 10) / 10}h` : `${Math.round(value)} min`
  }
  return String(Math.round(value))
}

export default function BadgeSheet({
  family, focusId, ctx, pinned, earnedAt, onClose, onTogglePin, onShare,
}: {
  family: FamilyState | null
  /**
   * The badge that was tapped. Without it the sheet is about the family's
   * own representative — and on the All page, where every tier is its own
   * tile, that showed one badge's pin under another badge's name.
   */
  focusId?: string | null
  ctx: BadgeContext
  pinned: string[]
  earnedAt: Record<string, string>
  onClose: () => void
  onTogglePin: (id: string) => void
  onShare: (id: string) => void
}) {
  if (!family) return null

  // The tier on show: the one you hold, or the one you are working toward.
  const focus = family.tiers.find((t) => t.id === focusId) ?? family.display
  const focusEarned = isEarned(focus, ctx)
  const target = focusId ? focus : family.next ?? focus
  const pct = Math.round(badgeProgress(target, ctx) * 100)
  // Today shows only pins that are earned; call it pinned on exactly those.
  const isPinned = focusEarned && pinned.includes(focus.id)
  const full = pinned.length >= MAX_PINNED && !isPinned
  const wonAt = earnedAt[focus.id]

  return (
    <Modal open onClose={onClose} title={family.label} size="sm">
      <div className="flex flex-col items-center text-center">
        <BadgeArt name={focus.id as BadgeArtName} size={112} locked={!focusEarned} />
        <p className="mt-3 text-[17px] font-bold" style={{ color: 'var(--clay-ink)' }}>{focus.label}</p>
        <p className="mt-1 text-sm" style={{ color: 'var(--clay-dim)' }}>{focus.description}</p>

        {focusEarned ? (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--clay-success-fg)' }}>
            <Check size={14} />
            {wonAt ? `Earned ${new Date(wonAt).toLocaleDateString()}` : 'Earned'}
          </p>
        ) : (
          <p className="mt-2 text-[13px] font-medium" style={{ color: 'var(--clay-dim)' }}>Not yet</p>
        )}
      </div>

      {/* Progress toward whatever is still open */}
      {/* A tapped badge not yet won shows its own progress; otherwise the family's next rung. */}
      {(focusId ? !focusEarned : !!family.next) && (
        <div className="mt-6">
          <div className="mb-1.5 flex items-baseline justify-between text-xs" style={{ color: 'var(--clay-dim)' }}>
            <span>{focusId ? 'Progress' : `Next: ${target.label}`}</span>
            <span className="tabular-nums">
              {amount(target.current(ctx), target.unit)} of {amount(target.target, target.unit)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--clay-bg-deep)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: 'var(--clay-accent)' }}
            />
          </div>
        </div>
      )}

      {/* The ladder — only worth showing when there is more than one rung */}
      {family.tiers.length > 1 && (
        <div className="mt-6 space-y-1">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clay-dim)' }}>
            All tiers
          </p>
          {family.tiers.map((t) => {
            const got = isEarned(t, ctx)
            return (
              <div key={t.id} className="flex items-center gap-3 py-1.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center" style={{ color: got ? 'var(--clay-success-fg)' : 'var(--clay-faint)' }}>
                  {got ? <Check size={15} /> : <Lock size={13} />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px]" style={{ color: got ? 'var(--clay-ink)' : 'var(--clay-dim)' }}>
                  {t.label}
                </span>
                <span className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--clay-faint)' }}>
                  {amount(t.target, t.unit)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Button
          variant={isPinned ? 'outline' : 'primary'}
          className="flex-1"
          disabled={!focusEarned || full}
          onClick={() => onTogglePin(focus.id)}
        >
          {isPinned ? <><PinOff size={15} /> Unpin</> : <><Pin size={15} /> Pin to Today</>}
        </Button>
        <Button variant="outline" disabled={!focusEarned} onClick={() => onShare(focus.id)}>
          <Share2 size={15} /> Share
        </Button>
      </div>

      {/* Say why a disabled button is disabled, rather than just refusing. */}
      {!focusEarned && (
        <p className="mt-2.5 text-xs" style={{ color: 'var(--clay-faint)' }}>
          Pinning and sharing open up once you have earned it.
        </p>
      )}
      {focusEarned && full && (
        <p className="mt-2.5 text-xs" style={{ color: 'var(--clay-faint)' }}>
          Three badges are already pinned. Unpin one to make room.
        </p>
      )}
    </Modal>
  )
}
