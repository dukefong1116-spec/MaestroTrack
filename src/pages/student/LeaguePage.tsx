import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Crown, Info, ArrowBigUpDash, ArrowBigDownDash } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { useAuth } from '@/hooks/useAuth'
import { useLeagueStore, type Climb } from '@/stores/leagueStore'
import { TierGround, TierTrophy } from '@/components/league/TierArt'
import { TIER_THEMES, themeFor } from '@/lib/league/themes'
import LeagueBoard from '@/components/league/LeagueBoard'
import StreakFlame from '@/components/icons/StreakFlame'
import {
  moveCounts, TOP_TIER, MAESTRO_PLACES, DAILY_CAP, DAY_MIN, DAY_BONUS, STREAK_BONUS, STREAK_DAYS,
} from '@/lib/league/rules'
import type { InstrumentType } from '@/types'

/**
 * The weekly league: your tier's trophy and colours, the countdown, your
 * streak, and your room — with the climb, if you moved since you last saw
 * it.
 *
 * Reads only. Everything here is written by the league server; opening
 * the page asks it to sync, which is also what finishes a week that ended
 * while you were away.
 */

function timeLeft(endsAt: number, now: number): string {
  const ms = endsAt - now
  if (ms <= 0) return 'Finishing up…'
  const h = Math.floor(ms / 3_600_000)
  const d = Math.floor(h / 24)
  if (d >= 1) return `${d}d ${h % 24}h left`
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h >= 1 ? `${h}h ${m}m left` : `${m}m left`
}

export default function LeaguePage() {
  const { profile } = useAuth()
  const result = useLeagueStore((s) => s.result)
  const failed = useLeagueStore((s) => s.failed)
  // Only this week's: before the first sync the profile may still point
  // at last week's finished room.
  const stored = useLeagueStore((s) => s.room)
  const room = stored?.status === 'open' ? stored : null
  const [climb, setClimb] = useState<Climb | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [howOpen, setHowOpen] = useState(false)

  useEffect(() => { void useLeagueStore.getState().sync() }, [])
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  // A climb not yet seen plays here, once the room has arrived.
  useEffect(() => {
    if (room && !climb) {
      const c = useLeagueStore.getState().takeClimb()
      if (c) setClimb(c)
    }
  }, [room, climb])

  const tier = result?.tier ?? profile?.league?.tier ?? 0
  const theme = themeFor(tier)
  const uid = profile?.uid ?? ''
  const n = room ? Object.keys(room.members ?? {}).length : 0
  const { up, down } = moveCounts(n)
  const streak = result?.streak ?? 0
  const last = profile?.league?.lastResult

  if (!profile) return null
  const optedOut = profile.leagueOptOut || result?.optedOut
  const loading = !result && !failed

  const pill = theme.dark ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.6)'

  return (
    // Edge to edge, like a phone screen: the tier's colours and trophy fill
    // the whole top, from under the page's own padding, and the room sits
    // right below.
    <div className="-mx-6 -mt-8 pb-6">
      <div className="relative">
      <button
        type="button"
        onClick={() => setHowOpen(true)}
        aria-label="How weekly XP works"
        className="absolute right-3 top-3 z-10 rounded-full p-1.5 transition-opacity active:opacity-60"
        style={{ color: theme.ink, background: pill }}
      >
        <Info size={20} />
      </button>
      <TierGround
        tier={tier}
        className="flex flex-col items-center justify-center px-5 text-center"
        style={{ minHeight: 'min(46vh, 420px)', paddingTop: 30, paddingBottom: 26 }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[.14em]" style={{ color: theme.sub }}>
          {room ? 'This week' : 'Your tier'}
        </p>
        <div className="mx-auto mt-2 flex justify-center"><TierTrophy tier={tier} size={124} /></div>
        <p className="mt-1 text-[17px] font-semibold italic" style={{ fontFamily: 'Georgia, serif', color: theme.sub }}>{theme.id}</p>
        <p className="text-[25px] font-bold leading-tight">{theme.name} league</p>
        {room && (
          <p className="mt-1 flex items-center justify-center gap-1.5 text-[13px]" style={{ color: theme.sub }}>
            <Clock size={13} /> {timeLeft(room.endsAt, now)} · {n} player{n === 1 ? '' : 's'}
          </p>
        )}
        <div className="mt-3.5 flex justify-center gap-1.5">
          {TIER_THEMES.map((t, i) => (
            <span
              key={t.id}
              title={t.name}
              className="rounded-[10px] p-[3px]"
              style={{
                background: i === tier ? 'rgba(255,255,255,.75)' : 'transparent',
                boxShadow: i === tier ? '0 0 0 2px var(--clay-accent)' : 'none',
                filter: i > tier ? 'grayscale(1)' : 'none',
                opacity: i > tier ? 0.35 : 1,
              }}
            >
              <TierTrophy tier={i} size={28} animated={false} />
            </span>
          ))}
        </div>
        {/* Your streak and XP, on the tier itself. */}
        {!optedOut && (
          <span
            className="mt-3.5 inline-flex max-w-full items-center gap-2 rounded-full py-1.5 pl-2 pr-3.5 text-[12.5px] font-semibold"
            style={{ background: pill, color: theme.ink }}
          >
            <StreakFlame streak={streak} size={18} />
            <span className="truncate">
              {streak >= STREAK_DAYS
                ? `${streak}-day league streak · bonus on, +${STREAK_BONUS} a day`
                : streak > 0
                  ? `${streak}-day league streak · bonus in ${STREAK_DAYS - streak} days`
                  : `Practise ${STREAK_DAYS} days in a row for a bonus`}
            </span>
          </span>
        )}
      </TierGround>
      </div>

      <Modal open={howOpen} onClose={() => setHowOpen(false)} title="How weekly XP works" size="sm">
        <ul className="space-y-2.5 text-[13.5px] leading-snug" style={{ color: 'var(--clay-dim)' }}>
          <li><b style={{ color: 'var(--clay-ink)' }}>1 XP a minute</b> you practise with the timer, up to {DAILY_CAP} minutes a day.</li>
          <li><b style={{ color: 'var(--clay-ink)' }}>+{DAY_BONUS} XP</b> for each day you practise at least {DAY_MIN} minutes.</li>
          <li><b style={{ color: 'var(--clay-ink)' }}>+{STREAK_BONUS} more</b> a day once you're on a {STREAK_DAYS}-day league streak: {DAY_MIN}+ timer minutes a day. Your lesson day and freezes keep it going.</li>
          <li>Only timer sessions count. Sessions typed into your log don't.</li>
          <li>Each week ends Sunday at midnight. The top of your room moves up a tier, the bottom moves down. In Fortissimo, the top {MAESTRO_PLACES} finish as Maestro.</li>
          <li>Other players see only your first name and last initial.</li>
        </ul>
      </Modal>

      <div className="mx-auto max-w-2xl px-3">
      {/* The room, or why there is none */}
      <div className="mt-3 px-2 py-3" style={{ background: 'var(--clay-surface)', borderRadius: 'var(--clay-r-md)' }}>
        {optedOut ? (
          <Empty
            title="Weekly leagues are off"
            text="You're not in a league, and nobody sees your practice. Turn them back on any time."
            action={<Link to="/student/settings/privacy" className="text-[13px] font-semibold" style={{ color: 'var(--clay-accent-ink)' }}>Privacy settings ›</Link>}
          />
        ) : loading ? (
          <div className="space-y-2 p-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-9 animate-pulse rounded-xl" style={{ background: 'var(--clay-bg-deep)' }} />)}</div>
        ) : !room ? (
          <Empty
            title="Join this week's league"
            text={`Practise with the timer to join a ${theme.name} room. Your first session this week puts you in.`}
            action={<Link to="/student/session" className="rounded-full px-5 py-2.5 text-[13.5px] font-bold" style={{ background: 'var(--clay-accent)', color: 'var(--clay-on-accent)' }}>Start practising</Link>}
          />
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between gap-2 whitespace-nowrap px-2 text-[11px] font-semibold uppercase tracking-[.06em]">
              {tier < TOP_TIER && up > 0
                ? <span className="flex items-center gap-1" style={{ color: 'var(--clay-success-fg)' }}><ArrowBigUpDash size={14} /> Top {up} move up</span>
                : <span className="flex items-center gap-1" style={{ color: '#A87A12' }}>{tier === TOP_TIER ? <><Crown size={13} /> Top {MAESTRO_PLACES}: Maestro</> : ''}</span>}
              {tier > 0 && down > 0 && (
                <span className="flex items-center gap-1" style={{ color: 'var(--clay-danger-fg)' }}><ArrowBigDownDash size={14} /> Bottom {down} drop</span>
              )}
            </div>
            <LeagueBoard
              key={climb ? `${climb.oldRank}-${climb.newRank}-${climb.xp}` : 'still'}
              room={room}
              me={uid}
              climb={climb}
              instrument={profile.instrument as InstrumentType | undefined}
            />
          </>
        )}
        {failed && !result && !optedOut && (
          <p className="px-2 pb-1 pt-2 text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>Couldn't reach the league just now. It'll catch up next time.</p>
        )}
      </div>

      {/* Last week, briefly */}
      {last && (
        <p className="mt-3 px-2 text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>
          Last week: {ordinal(last.rank)} of {last.of} in {themeFor(last.fromTier).name}
          {last.toTier > last.fromTier ? ', moved up' : last.toTier < last.fromTier ? ', moved down' : ''}
          {last.maestro ? ' · Maestro finish' : ''}
        </p>
      )}

      </div>
    </div>
  )
}

function Empty({ title, text, action }: { title: string; text: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-6 text-center">
      <p className="text-[15px] font-bold" style={{ color: 'var(--clay-ink)' }}>{title}</p>
      <p className="mb-4 mt-1 max-w-xs text-[13px]" style={{ color: 'var(--clay-dim)' }}>{text}</p>
      {action}
    </div>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}
