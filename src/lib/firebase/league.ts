import { onServerSnapshot } from './snapshotError'
import { doc, getDoc, type Unsubscribe } from 'firebase/firestore'
import { auth, db } from './config'
import { apiUrl } from '@/lib/native'
import type { LeagueCard, LeagueRoom } from '@/types'
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
  const res = await fetch(apiUrl(path), {
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

/**
 * A player's league card, or null: their profile is hidden, they are not
 * in your room, or there is none yet. All three read the same on screen.
 */
export async function getLeagueCard(uid: string): Promise<LeagueCard | null> {
  try {
    const snap = await getDoc(doc(db, 'leagueCards', uid))
    return snap.exists() ? (snap.data() as LeagueCard) : null
  } catch {
    return null
  }
}
