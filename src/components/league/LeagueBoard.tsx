import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { rankMembers, zoneOf, TOP_TIER, MAESTRO_PLACES, type Zone } from '@/lib/league/rules'
import { playClimb, playLand, playXpTick, playZoneChime, playZoomIn } from '@/lib/league/sounds'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import type { Climb } from '@/stores/leagueStore'
import { AVATAR_COLOURS } from '@/lib/league/themes'
import type { InstrumentType, LeagueCard, LeagueRoom } from '@/types'

/**
 * A league room as a ranked list, with the move-up zone in green at the
 * top and the drop zone in red at the bottom — and, when you have just
 * moved, the climb:
 *
 *   your XP counts up → your row zooms in → everyone slides into their new
 *   places together, a little slowly, with a soft bounce → it zooms back
 *   out. Passing people plays a rising note for each.
 *
 * `compact` shows only the few rows around the move, for the session
 * celebration; otherwise the whole room.
 */

const ZONE_BG: Record<'up' | 'down', string> = {
  up: 'var(--clay-success-bg)',
  down: 'var(--clay-danger-bg)',
}
const ZONE_FG: Record<'up' | 'down', string> = {
  up: 'var(--clay-success-fg)',
  down: 'var(--clay-danger-fg)',
}

const CLIMB_S = 1.7
/** Row heights: the celebration's compact strip, the board's top three, everyone else. */
const ROW_H = 40
const ROW_TOP = 66
const ROW_REST = 56

/** Gold, silver and bronze: the disc, and the number on it. */
const MEDALS: [string, string][] = [['#F5C542', '#6E5000'], ['#CDD6DF', '#465565'], ['#E3A672', '#6B3A12']]

function Face({ name, photo, size, bg, fg }: { name: string; photo?: string | null; size: number; bg: string; fg: string }) {
  if (photo) return <img src={photo} alt="" loading="lazy" decoding="async" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full font-bold" style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: bg, color: fg }}>
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

type Phase = 'idle' | 'count' | 'zoom' | 'climb' | 'settle' | 'done'

interface Row { uid: string; name: string; colour: number; xp: number }

export default function LeagueBoard({ room, me, climb, compact, instrument, onClimbDone, cards, onOpen }: {
  room: LeagueRoom
  me: string
  climb?: Climb | null
  compact?: boolean
  instrument?: InstrumentType
  onClimbDone?: () => void
  /** Players' public cards, for their photos. */
  cards?: Record<string, LeagueCard | null>
  /** Tapping a row opens that player's profile. */
  onOpen?: (uid: string) => void
}) {
  const reduced = usePrefersReducedMotion()
  const after = useMemo<Row[]>(
    () => rankMembers(Object.entries(room.members ?? {}).map(([uid, m]) => ({ uid, ...m })))
      .map((m) => ({ uid: m.uid, name: m.name, colour: m.colour, xp: m.xp })),
    [room.members],
  )
  const n = after.length
  const myAfter = after.findIndex((r) => r.uid === me)

  // Where you were: everyone else in the same order, you back at your old
  // place. Exact, rather than re-ranked from old numbers that others may
  // have moved since.
  const moving = !!climb && myAfter >= 0
  const before = useMemo<Row[]>(() => {
    if (!moving || !climb) return after
    const others = after.filter((r) => r.uid !== me)
    const at = Math.max(0, Math.min(others.length, climb.oldRank - 1))
    return [...others.slice(0, at), { ...after[myAfter], xp: climb.oldXp }, ...others.slice(at)]
  }, [moving, climb, after, me, myAfter])

  const [phase, setPhase] = useState<Phase>(moving ? 'count' : 'idle')
  const [shownXp, setShownXp] = useState(moving && climb ? climb.oldXp : null as number | null)
  const [zonePill, setZonePill] = useState(false)
  const doneRef = useRef(onClimbDone)
  doneRef.current = onClimbDone

  useEffect(() => {
    if (!moving || !climb) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms))
    const places = Math.max(0, climb.oldRank - climb.newRank)
    const beforeZone = zoneOf(climb.oldRank - 1, n, room.tier, climb.oldXp)
    const afterZone = zoneOf(climb.newRank - 1, n, room.tier, climb.xp)

    // XP counting up, over about 0.8s.
    const steps = Math.min(24, Math.max(1, climb.xp - climb.oldXp))
    for (let i = 1; i <= steps; i++) {
      at((800 / steps) * i, () => {
        setShownXp(Math.round(climb.oldXp + ((climb.xp - climb.oldXp) * i) / steps))
        playXpTick(instrument)
      })
    }
    let t = 900
    if (places === 0) {
      at(t, () => { setShownXp(null); setPhase('done'); doneRef.current?.() })
    } else if (reduced) {
      at(t, () => { setPhase('climb'); setShownXp(null) })
      at(t + 500, () => { setPhase('done'); doneRef.current?.() })
    } else {
      at(t, () => { setPhase('zoom'); playZoomIn() })
      t += 650
      at(t, () => { setPhase('climb'); setShownXp(null); playClimb(places, CLIMB_S, instrument) })
      t += CLIMB_S * 1000 + 200
      at(t, () => { setPhase('settle'); playLand() })
      if (beforeZone !== 'up' && afterZone === 'up') {
        at(t + 350, () => { setZonePill(true); playZoneChime(instrument) })
      }
      at(t + 900, () => { setPhase('done'); doneRef.current?.() })
    }
    return () => timers.forEach(clearTimeout)
    // One climb per mount: the board is keyed by the climb that plays it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const order = phase === 'count' || phase === 'zoom' ? before : after
  const zoomed = phase === 'zoom' || phase === 'climb'

  // Compact: five rows around where you land, the same five throughout,
  // so the card never changes height mid-climb. Coming from further down,
  // you rise from the bottom edge of them.
  const visible = useMemo(() => {
    if (!compact) return order
    const start = Math.max(0, Math.min(myAfter - 1, n - 5))
    const keep = new Set(after.slice(start, start + 5).map((r) => r.uid))
    return order.filter((r) => keep.has(r.uid))
  }, [compact, order, after, myAfter, n])

  return (
    <div className="relative">
      {visible.map((r) => {
        const index = order.findIndex((x) => x.uid === r.uid)
        const zone: Zone = zoneOf(index, n, room.tier, r.xp)
        const mine = r.uid === me
        // Nobody moves up from the top tier: its top three are the Maestro
        // places instead, in gold.
        const maestro = room.tier === TOP_TIER && index < MAESTRO_PLACES && r.xp > 0
        const [bg, fg] = AVATAR_COLOURS[r.colour % AVATAR_COLOURS.length]
        const top = !compact && index < 3 && r.xp > 0
        const medal = index < 3 && r.xp > 0 ? MEDALS[index] : null
        const face = compact ? 24 : top ? 48 : 40
        const open = onOpen ? () => onOpen(r.uid) : undefined
        return (
          <motion.div
            key={r.uid}
            layout="position"
            transition={{ layout: reduced ? { duration: 0.3 } : { duration: CLIMB_S, ease: [0.4, 1.25, 0.5, 1] } }}
            style={{ position: 'relative', zIndex: mine ? 3 : 1 }}
            data-me={mine || undefined}
          >
            <motion.div
              animate={{ scale: mine && zoomed && !reduced ? (compact ? 1.07 : 1.16) : 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 18 }}
              className={`flex items-center px-3 ${compact ? 'gap-2.5' : 'gap-3'}${open ? ' cursor-pointer' : ''}`}
              role={open ? 'button' : undefined}
              tabIndex={open ? 0 : undefined}
              aria-label={open ? `${mine ? 'Your' : `${r.name}'s`} profile` : undefined}
              onClick={open}
              onKeyDown={open ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } } : undefined}
              style={{
                height: compact ? ROW_H : top ? ROW_TOP : ROW_REST,
                borderRadius: 12,
                background: mine ? 'var(--clay-accent-soft)' : maestro ? 'rgba(255,214,107,.28)' : zone ? ZONE_BG[zone] : 'transparent',
                boxShadow: mine
                  ? zoomed ? '0 0 0 2px var(--clay-accent), 0 10px 24px rgba(224,85,57,.3)' : '0 0 0 2px var(--clay-accent)'
                  : 'none',
                transition: 'background .6s, box-shadow .45s',
              }}
            >
              {medal ? (
                <span
                  className="flex shrink-0 items-center justify-center rounded-full font-extrabold tabular-nums"
                  style={{ width: compact ? 20 : 30, height: compact ? 20 : 30, fontSize: compact ? 11 : 14, background: medal[0], color: medal[1], boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.14)' }}
                >
                  {index + 1}
                </span>
              ) : (
                <span className="shrink-0 text-center font-bold tabular-nums" style={{ width: compact ? 20 : 30, fontSize: compact ? 12.5 : 15, color: mine ? 'var(--clay-accent-ink)' : 'var(--clay-dim)' }}>
                  {index + 1}
                </span>
              )}
              <Face
                name={r.name}
                photo={cards?.[r.uid]?.photo}
                size={face}
                bg={mine ? 'var(--clay-accent)' : bg}
                fg={mine ? 'var(--clay-on-accent)' : fg}
              />
              <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--clay-ink)', fontWeight: mine || !compact ? 700 : 500, fontSize: compact ? 13.5 : top ? 16.5 : 15.5 }}>
                {mine ? 'You' : r.name}
              </span>
              <span className="shrink-0 font-bold tabular-nums" style={{ fontSize: compact ? 12.5 : top ? 15.5 : 14.5, color: maestro && !mine ? '#A87A12' : zone && !mine ? ZONE_FG[zone] : 'var(--clay-ink)' }}>
                {mine && shownXp !== null ? shownXp : r.xp} XP
              </span>
            </motion.div>
            {mine && zonePill && (
              <motion.span
                initial={{ opacity: 0, scale: 0.6, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 16 }}
                className="absolute -top-3 right-3 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                style={{ background: 'var(--clay-success-fg)', color: '#fff' }}
              >
                In the move-up zone
              </motion.span>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
