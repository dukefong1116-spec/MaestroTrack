import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Flame, Lock, Medal, Music, Trophy, Zap } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useLeagueCard } from '@/hooks/useLeagueCards'
import { useLeagueStore } from '@/stores/leagueStore'
import { colourFor } from '@/lib/league/rules'
import { AVATAR_COLOURS, themeFor } from '@/lib/league/themes'
import { INSTRUMENT_THEMES } from '@/lib/utils/instruments'
import { BADGES } from '@/lib/utils/progression'
import Banner from '@/components/profile/Banner'
import BadgeArt, { type BadgeArtName } from '@/components/badges/BadgeArt'
import type { InstrumentType, LeagueCard } from '@/types'

/**
 * A player's profile, opened from the league board: their instrument and
 * level, this week's practice against yours, their streak and the badges
 * they pinned.
 *
 * Everything shown about someone else comes from their league card, which
 * only the league server writes and only the players in their room can
 * read. Your own comes from your profile and your latest sync, so it is
 * current even before the server has rewritten your card.
 */

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function LeaguePlayerPage() {
  const { uid: param } = useParams()
  const uid = param ? decodeURIComponent(param) : undefined
  const navigate = useNavigate()
  const { profile } = useAuth()
  const result = useLeagueStore((s) => s.result)
  const mine = !!uid && uid === profile?.uid
  const { card: theirs, loading } = useLeagueCard(mine ? undefined : uid)

  const myDays = (result?.days ?? []).map((d) => d.minutes)
  const me: LeagueCard | null = profile && mine ? {
    uid: profile.uid,
    roomId: result?.roomId ?? '',
    name: profile.displayName ?? 'You',
    colour: colourFor(profile.uid),
    instrument: profile.instrument ?? null,
    level: profile.experienceLevel ?? null,
    photo: profile.avatar || null,
    bannerImage: profile.bannerImage || null,
    bannerColor: profile.bannerColor || null,
    days: myDays,
    streak: result?.streak ?? 0,
    xp: result?.xp ?? 0,
    tier: result?.tier ?? profile.league?.tier ?? 0,
    topFinishes: profile.league?.topFinishes ?? 0,
    badges: (profile.pinnedBadges ?? []).slice(0, 3),
    updatedAt: '',
  } : null
  const card = mine ? me : theirs

  const back = (
    <button
      type="button"
      onClick={() => navigate('/student/league')}
      aria-label="Back to the league"
      className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full"
      style={{ background: 'rgba(255,255,255,.75)', color: '#000' }}
    >
      <ChevronLeft size={20} aria-hidden="true" />
    </button>
  )

  if (!card) {
    return (
      <div className="-mx-6 -mt-8">
        <Banner height={220}>{back}</Banner>
        {!loading && (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <Lock size={28} style={{ color: 'var(--clay-dim)' }} aria-hidden="true" />
            <p className="mt-3 text-[16px] font-bold" style={{ color: 'var(--clay-ink)' }}>This profile is private</p>
            <p className="mt-1 max-w-xs text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>
              They keep their profile to themselves, or they are no longer in your room.
            </p>
          </div>
        )}
      </div>
    )
  }

  const [bg, fg] = AVATAR_COLOURS[card.colour % AVATAR_COLOURS.length]
  const instrument = card.instrument
    ? INSTRUMENT_THEMES[card.instrument as InstrumentType]?.label ?? card.instrument
    : null
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
  const badges = card.badges
    .map((id) => BADGES.find((b) => b.id === id))
    .filter((b): b is NonNullable<typeof b> => !!b)
  const first = mine ? 'You' : card.name.split(' ')[0]

  return (
    <div className="-mx-6 -mt-8 pb-8">
      <div className="relative">
        <Banner image={card.bannerImage} color={card.bannerColor} height={230}>{back}</Banner>
        <div className="absolute -bottom-11 left-5 rounded-full" style={{ border: '4px solid var(--clay-page)' }}>
          {card.photo
            ? <img src={card.photo} alt="" className="rounded-full object-cover" style={{ width: 88, height: 88 }} />
            : (
              <span className="flex items-center justify-center rounded-full text-[34px] font-bold" style={{ width: 88, height: 88, background: mine ? 'var(--clay-accent)' : bg, color: mine ? 'var(--clay-on-accent)' : fg }}>
                {card.name.charAt(0).toUpperCase()}
              </span>
            )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6">
        <div className="pt-14">
          <h1 className="text-[24px] font-bold leading-tight" style={{ color: 'var(--clay-ink)' }}>{card.name}</h1>
          {card.level && <p className="text-[15px] font-semibold capitalize" style={{ color: 'var(--clay-accent-ink)' }}>{card.level}</p>}
          <p className="mt-1 flex items-center gap-1.5 text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>
            <Music size={14} aria-hidden="true" />
            {[instrument, `${themeFor(card.tier).name} league`].filter(Boolean).join(' · ')}
          </p>
        </div>

        <section className="mt-6">
          <h2 className="text-[11.5px] font-bold uppercase tracking-[.08em]" style={{ color: 'var(--clay-dim)' }}>This week's practice</h2>
          <WeekChart theirs={card.days} yours={mine ? null : myDays} />
          <Legend dot="var(--clay-accent)" label={first} minutes={sum(card.days)} />
          {!mine && <Legend dot="var(--clay-faint)" label="You" minutes={sum(myDays)} />}
        </section>

        <section className="mt-6 pt-5" style={{ borderTop: '1px solid var(--clay-line)' }}>
          <h2 className="text-[11.5px] font-bold uppercase tracking-[.08em]" style={{ color: 'var(--clay-dim)' }}>Overview</h2>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 text-[16px] font-bold" style={{ color: 'var(--clay-ink)' }}>
            <Stat icon={<Flame size={20} style={{ color: '#F08A24' }} />} text={`${card.streak} day${card.streak === 1 ? '' : 's'}`} sub="League streak" />
            <Stat icon={<Zap size={20} style={{ color: '#E8B100' }} />} text={`${card.xp} XP`} sub="This week" />
            <Stat icon={<Trophy size={20} style={{ color: 'var(--clay-accent)' }} />} text={themeFor(card.tier).name} sub="League" />
            <Stat icon={<Medal size={20} style={{ color: '#E3A672' }} />} text={`${card.topFinishes}`} sub="Top-3 finishes" />
          </div>
        </section>

        <section className="mt-6 pt-5" style={{ borderTop: '1px solid var(--clay-line)' }}>
          <h2 className="text-[11.5px] font-bold uppercase tracking-[.08em]" style={{ color: 'var(--clay-dim)' }}>Badges</h2>
          {badges.length ? (
            <div className="mt-3 flex flex-wrap gap-4">
              {badges.map((b) => (
                <div key={b.id} className="flex w-[76px] flex-col items-center text-center">
                  <BadgeArt name={b.id as BadgeArtName} size={60} />
                  <span className="mt-1 text-[11.5px] font-semibold leading-tight" style={{ color: 'var(--clay-dim)' }}>{b.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[13.5px]" style={{ color: 'var(--clay-dim)' }}>
              {mine ? 'Pin badges on Progress to show them here.' : 'No badges pinned yet.'}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

function Stat({ icon, text, sub }: { icon: React.ReactNode; text: string; sub: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate">{text}</span>
        <span className="block text-[12px] font-medium" style={{ color: 'var(--clay-dim)' }}>{sub}</span>
      </span>
    </div>
  )
}

function Legend({ dot, label, minutes }: { dot: string; label: string; minutes: number }) {
  return (
    <div className="mt-2 flex items-center justify-between text-[15px]" style={{ color: 'var(--clay-ink)' }}>
      <span className="flex items-center gap-2 font-bold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} />{label}</span>
      <span style={{ color: 'var(--clay-dim)' }}>{minutes} min</span>
    </div>
  )
}

/** Minutes a day, Monday to Sunday: theirs in the accent, yours behind in grey. */
function WeekChart({ theirs, yours }: { theirs: number[]; yours: number[] | null }) {
  const W = 320
  const H = 150
  const pad = { l: 28, r: 8, t: 10, b: 22 }
  const max = Math.max(30, ...theirs, ...(yours ?? []))
  const top = Math.ceil(max / 30) * 30
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / 6
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b)
  // Up to today: the days still to come are not zeros.
  const shown = (new Date().getDay() + 6) % 7 + 1
  const line = (d: number[]) => d.slice(0, shown).map((v, i) => `${x(i)},${y(v)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Minutes practised each day this week">
      {[0, top / 2, top].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--clay-line)" />
          <text x={0} y={y(v) + 4} fontSize="10.5" fill="var(--clay-dim)">{v}</text>
        </g>
      ))}
      {DAYS.map((d, i) => <text key={i} x={x(i)} y={H - 4} fontSize="10.5" textAnchor="middle" fill="var(--clay-dim)">{d}</text>)}
      {yours && yours.length > 0 && (
        <g>
          <polyline points={line(yours)} fill="none" stroke="var(--clay-faint)" strokeWidth={2.5} strokeLinejoin="round" />
          {yours.slice(0, shown).map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill="var(--clay-faint)" />)}
        </g>
      )}
      {theirs.length > 0 && (
        <g>
          <polyline points={line(theirs)} fill="none" stroke="var(--clay-accent)" strokeWidth={2.5} strokeLinejoin="round" />
          {theirs.slice(0, shown).map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill="var(--clay-accent)" />)}
        </g>
      )}
    </svg>
  )
}
