import { beforeEach, describe, expect, it } from 'vitest'
import { usePracticeStore } from '../practiceStore'
import type { PracticeSession } from '@/types'

/** The saved copy fills in what has not arrived live — never the reverse. */
const S = (id: string) => ({ id, userId: 'u', date: '2026-11-10', durationMinutes: 20 }) as PracticeSession
const snap = { sessions: [S('old')], pieces: [], assignments: [], lessons: [], performances: [], recordings: [], messages: [] }

describe('saved copy vs live data', () => {
  beforeEach(() => usePracticeStore.getState().resetUserData())

  it('shows the saved copy until live data arrives, without calling it loaded', () => {
    usePracticeStore.getState().hydrate(snap)
    const st = usePracticeStore.getState()
    expect(st.sessions.map((s) => s.id)).toEqual(['old'])
    expect(st.sessionsLoaded).toBe(false)
    expect(st.live.sessions).toBe(false)
  })
  it('live data replaces it', () => {
    usePracticeStore.getState().hydrate(snap)
    usePracticeStore.getState().setSessions([S('new')])
    const st = usePracticeStore.getState()
    expect(st.sessions.map((s) => s.id)).toEqual(['new'])
    expect(st.sessionsLoaded).toBe(true)
  })
  it('a saved copy read late never overwrites live data', () => {
    usePracticeStore.getState().setSessions([])
    usePracticeStore.getState().hydrate(snap)
    expect(usePracticeStore.getState().sessions).toEqual([])
  })
  it('signing out forgets both', () => {
    usePracticeStore.getState().hydrate(snap)
    usePracticeStore.getState().resetUserData()
    expect(usePracticeStore.getState().sessions).toEqual([])
    expect(usePracticeStore.getState().live.sessions).toBe(false)
  })
})
