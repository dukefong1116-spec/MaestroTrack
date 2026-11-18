import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronLeft, Pin } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import BadgeArt from '@/components/badges/BadgeArt'
import BadgeSheet from '@/components/badges/BadgeSheet'
import { Panel, Block } from '@/components/ui/Panel'
import { useAuth } from '@/hooks/useAuth'
import { useGamification } from '@/hooks/useGamification'
import { usePinnedBadges } from '@/hooks/usePinnedBadges'
import { useShareBadge } from '@/hooks/useShareBadge'
import { BADGES, badgeProgress, isEarned, type BadgeFamily } from '@/lib/utils/progression'

/**
 * Every badge, each tier on its own, grouped by what it counts. Progress
 * shows a few; this is the whole set — won in colour with the date,
 * still to win in grey with how far along you are.
 */
function amount(value: number, unit: string): string {
  if (unit !== 'minutes') return String(Math.round(value))
  const h = value / 60
  return h >= 1 ? `${Math.round(h * 10) / 10}h` : `${Math.round(value)}m`
}

export default function BadgesPage() {
  const { profile } = useAuth()
  const { families, badgeCtx } = useGamification()
  const { pinned, togglePin } = usePinnedBadges()
  const { shareBadge, shareNote } = useShareBadge()
  const [open, setOpen] = useState<{ family: BadgeFamily; id: string } | null>(null)
  const earnedAt = profile?.badgeEarnedAt ?? {}
  const won = BADGES.filter((b) => isEarned(b, badgeCtx)).length

  return (
    <div>
      <Link to="/student/practice/progress" className="mb-2 inline-flex items-center gap-1 px-1 text-[13px] font-semibold" style={{ color: 'var(--clay-accent-ink)' }}>
        <ChevronLeft size={16} /> Progress
      </Link>
      <PageHeader title="Badges" subtitle={`${won} of ${BADGES.length} earned`} />

      <Panel>
        {families.map((fam, i) => (
          <Block key={fam.family} first={i === 0}>
            <p className="mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clay-dim)' }}>{fam.label}</p>
            <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4">
              {fam.tiers.map((b) => {
                const got = isEarned(b, badgeCtx)
                const at = earnedAt[b.id]
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setOpen({ family: fam.family, id: b.id })}
                    className="flex flex-col items-center text-center transition-transform active:scale-[.97]"
                  >
                    <span className="relative">
                      <BadgeArt name={b.id} size={72} locked={!got} />
                      {got && pinned.includes(b.id) && (
                        <span
                          className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full"
                          style={{ background: 'var(--clay-accent)', color: 'var(--clay-on-accent)', border: '2px solid var(--clay-surface)' }}
                          aria-label="Pinned to Today"
                        >
                          <Pin size={12} aria-hidden="true" />
                        </span>
                      )}
                    </span>
                    <p className="mt-2 text-[13px] font-semibold leading-tight" style={{ color: got ? 'var(--clay-ink)' : 'var(--clay-dim)' }}>{b.label}</p>
                    {got ? (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--clay-success-fg)' }}>
                        <Check size={11} aria-hidden="true" />{at ? new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Earned'}
                      </p>
                    ) : (
                      <>
                        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--clay-faint)' }}>
                          {amount(b.current(badgeCtx), b.unit)} of {amount(b.target, b.unit)}
                        </p>
                        <div className="mt-1.5 h-1.5 w-full max-w-[84px] overflow-hidden rounded-full" style={{ background: 'var(--clay-bg-deep)' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.round(badgeProgress(b, badgeCtx) * 100)}%`, background: 'var(--clay-accent)' }} />
                        </div>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          </Block>
        ))}
      </Panel>

      <BadgeSheet
        family={families.find((f) => f.family === open?.family) ?? null}
        focusId={open?.id}
        ctx={badgeCtx}
        pinned={pinned}
        earnedAt={earnedAt}
        onClose={() => setOpen(null)}
        onTogglePin={togglePin}
        onShare={(id) => void shareBadge(id)}
      />
      {shareNote && (
        <p
          className="fixed inset-x-0 bottom-24 z-[70] mx-auto w-fit rounded-full px-4 py-2 text-[12.5px] font-semibold"
          style={{ background: 'var(--clay-ink)', color: 'var(--clay-page)' }}
          role="status"
        >
          {shareNote}
        </p>
      )}
    </div>
  )
}
