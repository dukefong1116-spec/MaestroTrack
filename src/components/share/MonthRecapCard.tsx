import { useMemo } from 'react'
import { Share2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { monthRecap, recapMonth, STYLES } from '@/lib/share/recap'
import { recapShare } from '@/lib/share/moments'
import { openShare } from '@/stores/shareStore'
import { haptic } from '@/lib/haptics'

/**
 * "Your November in music": the month so far (or, in the first days of a
 * new one, the month just gone) — minutes, best run, top piece, and a
 * practice style — with a button to share it.
 */
export default function MonthRecapCard() {
  const { profile } = useAuth()
  const sessions = usePracticeStore((s) => s.sessions)
  const pieces = usePracticeStore((s) => s.pieces)
  const recap = useMemo(() => {
    const [y, m] = recapMonth(sessions)
    return monthRecap(sessions, pieces, y, m)
  }, [sessions, pieces])
  if (!recap) return null
  const style = STYLES[recap.style]

  return (
    <div className="mb-4 overflow-hidden rounded-[var(--clay-r-md)] p-4 text-white" style={{ background: 'linear-gradient(135deg,#8F86E6,#3C3489)' }}>
      <p className="text-[11.5px] font-bold uppercase tracking-[.14em] opacity-80">Your {recap.month} in music</p>
      <div className="mt-2 flex items-center gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[16px] text-[30px]" style={{ background: 'rgba(255,255,255,.16)' }} aria-hidden>{style.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[20px] font-bold leading-tight">{style.name}</p>
          <p className="text-[13px] opacity-85">{recap.styleLine}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[12.5px] font-semibold">
        <span className="rounded-full px-2.5 py-1" style={{ background: 'rgba(255,255,255,.18)' }}>{recap.minutes} min</span>
        <span className="rounded-full px-2.5 py-1" style={{ background: 'rgba(255,255,255,.18)' }}>{recap.days} {recap.days === 1 ? 'day' : 'days'}</span>
        {recap.bestStreak > 1 && <span className="rounded-full px-2.5 py-1" style={{ background: 'rgba(255,255,255,.18)' }}>🔥 best {recap.bestStreak} in a row</span>}
        {recap.topPiece && <span className="max-w-full truncate rounded-full px-2.5 py-1" style={{ background: 'rgba(255,255,255,.18)' }}>{recap.topPiece}</span>}
      </div>
      <button
        type="button"
        onClick={() => {
          haptic('tap')
          openShare(recapShare({ month: recap.month, minutes: recap.minutes, style: `${style.emoji} ${style.name}`, styleLine: recap.styleLine, bestStreak: recap.bestStreak, topPiece: recap.topPiece }, profile?.displayName))
        }}
        className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[14px] font-bold"
        style={{ background: '#FFFFFF', color: '#3C3489' }}
      >
        <Share2 size={15} /> Share my {recap.month}
      </button>
    </div>
  )
}
