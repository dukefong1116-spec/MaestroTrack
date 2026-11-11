import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { subscribeRoom, type SyncResult } from '@/lib/firebase/league'
import { TierTrophy } from './TierArt'
import { themeFor } from '@/lib/league/themes'
import LeagueBoard from './LeagueBoard'
import { STREAK_BONUS, DAY_BONUS } from '@/lib/league/rules'
import type { Climb } from '@/stores/leagueStore'
import type { InstrumentType, LeagueRoom } from '@/types'

/**
 * The league's part of the session celebration: the XP this session
 * earned, and — if it moved you — the climb, on the few rows around it.
 * Joining the week's league with this session gets its own line.
 */
export default function LeagueSessionPanel({ result, climb, uid, instrument }: {
  result: SyncResult
  climb: Climb | null
  uid: string
  instrument?: InstrumentType
}) {
  const [room, setRoom] = useState<LeagueRoom | null>(null)
  useEffect(() => (result.roomId ? subscribeRoom(result.roomId, setRoom) : undefined), [result.roomId])

  const theme = themeFor(result.tier)
  const gained = Math.max(0, result.xp - (climb?.oldXp ?? result.oldXp ?? result.xp))
  const today = result.days.find((d) => d.date === new Date().toLocaleDateString('en-CA'))
  const streakBonus = !!today && today.bonus > DAY_BONUS
  const n = room ? Object.keys(room.members ?? {}).length : result.size ?? 0

  if (!result.roomId) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mt-5 overflow-hidden text-left"
      style={{ background: 'var(--clay-bg)', borderRadius: 18 }}
    >
      <div className="flex items-center gap-2.5 px-3 pt-3">
        <TierTrophy tier={result.tier} size={30} animated={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold" style={{ color: 'var(--clay-ink)' }}>
            {result.joined ? `You joined ${theme.name} league` : `${theme.name} league`}
          </p>
          <p className="text-[11.5px]" style={{ color: 'var(--clay-dim)' }}>
            {result.newRank ? `${ordinal(result.newRank)} of ${n}` : ''}{streakBonus ? ` · streak bonus +${STREAK_BONUS}` : ''}
          </p>
        </div>
        {gained > 0 && (
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.2 }}
            className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold"
            style={{ background: 'var(--clay-accent-soft)', color: 'var(--clay-accent-ink)' }}
          >
            +{gained} XP
          </motion.span>
        )}
      </div>
      <div className="px-1.5 pb-2 pt-2">
        {room && (
          <LeagueBoard key={climb ? 'climb' : 'still'} room={room} me={uid} climb={climb} compact instrument={instrument} />
        )}
      </div>
    </motion.div>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}
