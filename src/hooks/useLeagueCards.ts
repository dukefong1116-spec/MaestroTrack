import { useEffect, useState } from 'react'
import { getLeagueCard } from '@/lib/firebase/league'
import type { LeagueCard } from '@/types'

/**
 * League cards for the players on the board, fetched once each and kept
 * for a few minutes: a card changes when its owner syncs, which is not
 * often, and the board re-renders on every XP change in the room.
 */
const TTL = 3 * 60_000
const cache = new Map<string, { at: number; card: LeagueCard | null }>()

export function useLeagueCards(uids: string[]): Record<string, LeagueCard | null> {
  const key = [...uids].sort().join(',')
  const [cards, setCards] = useState<Record<string, LeagueCard | null>>(() => fromCache(uids))
  useEffect(() => {
    let live = true
    const list = key ? key.split(',') : []
    setCards(fromCache(list))
    const stale = list.filter((u) => { const c = cache.get(u); return !c || Date.now() - c.at > TTL })
    void Promise.all(stale.map(async (u) => cache.set(u, { at: Date.now(), card: await getLeagueCard(u) }))).then(() => {
      if (live && stale.length) setCards(fromCache(list))
    })
    return () => { live = false }
  }, [key])
  return cards
}

/** One card, for the player page — always fetched fresh. */
export function useLeagueCard(uid: string | undefined): { card: LeagueCard | null; loading: boolean } {
  const [state, setState] = useState<{ card: LeagueCard | null; loading: boolean }>({ card: null, loading: true })
  useEffect(() => {
    if (!uid) return
    let live = true
    setState({ card: cache.get(uid)?.card ?? null, loading: true })
    void getLeagueCard(uid).then((card) => {
      cache.set(uid, { at: Date.now(), card })
      if (live) setState({ card, loading: false })
    })
    return () => { live = false }
  }, [uid])
  return state
}

function fromCache(uids: string[]): Record<string, LeagueCard | null> {
  return Object.fromEntries(uids.map((u) => [u, cache.get(u)?.card ?? null]))
}
