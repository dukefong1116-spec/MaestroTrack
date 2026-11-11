import { useEffect } from 'react'
import { usePracticeStore } from '@/stores/practiceStore'
import { useLeagueStore } from '@/stores/leagueStore'
import { subscribeRoom, type SyncResult } from '@/lib/firebase/league'
import { readSnapshot, writeSnapshot, snapshotKey } from '@/lib/cache/snapshot'
import type { LeagueRoom } from '@/types'

interface SavedLeague { result: SyncResult | null; room: LeagueRoom | null }

/**
 * Keeps the weekly league in step with the session log, for a student.
 *
 * Any change to the sessions — saved here, deleted in the log, or on
 * another device — means a sync, once things settle. So does opening the
 * app, which is also what finishes a week that ended while you were away
 * and brings its result in. Debounced, and skipped when nothing changed
 * since the last one, because DataProvider mounts afresh on some routes.
 */
let lastKey = ''

export function useLeagueSync(uid: string | undefined, optedOut: boolean | undefined, profileRoomId?: string | null) {
  const sessions = usePracticeStore((s) => s.sessions)
  const loaded = usePracticeStore((s) => s.sessionsLoaded)
  const result = useLeagueStore((s) => s.result)

  // Your room, live: the server's latest word on which one, else the
  // profile's. One listener, shared by the League tab and the bell.
  const roomId = uid && !optedOut ? (result ? result.roomId : profileRoomId ?? null) : null
  useEffect(() => {
    const { setRoom } = useLeagueStore.getState()
    if (!roomId) { setRoom(null); return }
    return subscribeRoom(roomId, setRoom)
  }, [roomId])

  useEffect(() => {
    if (!uid) { useLeagueStore.getState().reset(); lastKey = ''; return }
    // The League tab as you last saw it, at once; the sync and the room's
    // live listener bring it up to date. Display only, like Today's copy.
    let active = true
    void readSnapshot<SavedLeague>(snapshotKey.league(uid)).then((saved) => {
      if (!active || !saved) return
      const st = useLeagueStore.getState()
      if (!st.result && saved.result) useLeagueStore.setState({ result: saved.result })
      if (!st.room && saved.room) st.setRoom(saved.room)
    })
    // Kept from what the server says, a moment after it changes.
    let timer: ReturnType<typeof setTimeout> | undefined
    const stop = useLeagueStore.subscribe((st, prev) => {
      if (st.result === prev.result && st.room === prev.room) return
      if (!st.result) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (!active) return
        const now = useLeagueStore.getState()
        void writeSnapshot<SavedLeague>(snapshotKey.league(uid), { result: now.result, room: now.room })
      }, 1500)
    })
    return () => { active = false; clearTimeout(timer); stop() }
  }, [uid])

  useEffect(() => {
    if (!uid || !loaded) return
    const key = `${uid}|${optedOut ? 1 : 0}|${sessions.length}|${sessions.map((s) => `${s.id}:${s.durationMinutes}`).join(',')}`
    if (key === lastKey) return
    const t = setTimeout(() => {
      lastKey = key
      void useLeagueStore.getState().sync()
    }, 1200)
    return () => clearTimeout(t)
  }, [uid, loaded, sessions, optedOut])
}
