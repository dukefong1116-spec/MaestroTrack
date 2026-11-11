import { onServerSnapshot } from './snapshotError'
import { doc, type Unsubscribe } from 'firebase/firestore'
import { auth, db } from './config'
import type { LeagueRoom } from '@/types'
import type { DayLine } from '@/lib/league/rules'

/**
 * The app's side of the weekly league. It never writes league data —
 * the server does (api/league/*). The app asks for a practice ticket when
 * the timer starts, asks the server to sync, and listens to its room.
 */

export interface SyncResult {
  optedOut: boolean
  week: string
  tier: number
  xp: number
  oldXp?: number
  days: DayLine[]
  streak: number
  roomId: string | null
  oldRank?: number | null
  newRank?: number | null
  size?: number
  joined?: boolean
}

async function post<T>(path: string, body: unknown = {}): Promise<T> {
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`League ${res.status}`)
  return (await res.json()) as T
}

/** A signed ticket for the session the timer just started. */
export async function requestTicket(): Promise<string> {
  return (await post<{ ticket: string }>('/api/league/ticket')).ticket
}

/** Recount, place, finish a week — whatever is due. Safe to repeat. */
export function syncLeague(): Promise<SyncResult> {
  // Minutes east of UTC: the server works out "this week" in your time zone.
  return post<SyncResult>('/api/league/sync', { tzOffset: -new Date().getTimezoneOffset() })
}

export function subscribeRoom(roomId: string, cb: (room: LeagueRoom | null) => void): Unsubscribe {
  return onServerSnapshot(
    doc(db, 'leagueRooms', roomId),
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as LeagueRoom) : null),
    () => cb(null),
  )
}
