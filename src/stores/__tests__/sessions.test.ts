import { describe, it, expect, beforeEach } from 'vitest'
import { usePracticeStore } from '../practiceStore'
import type { PracticeSession } from '@/types'

const s = (id: string): PracticeSession => ({
  id, userId: 'u', date: '2026-10-01', durationMinutes: 30, category: 'Technique',
  difficultyRating: 3, confidenceRating: 7, createdAt: '2026-10-01T10:00:00.000Z',
})

/**
 * Logging a session showed it twice in the list.
 *
 * addPracticeSession resolves only once Firestore has acknowledged the
 * write, and the live subscription has delivered the new document through
 * setSessions by then. The optimistic addSession that follows was adding
 * the same session a second time, and nothing removed it — the list stayed
 * wrong until some other change triggered a fresh snapshot.
 */
describe('addSession', () => {
  beforeEach(() => usePracticeStore.setState({ sessions: [] }))
  const store = () => usePracticeStore.getState()

  it('adds a session that is genuinely new', () => {
    store().addSession(s('a'))
    expect(store().sessions.map((x) => x.id)).toEqual(['a'])
  })

  it('does not add one the subscription has already delivered', () => {
    // Exactly the race: the snapshot lands first, then the optimistic add.
    usePracticeStore.setState({ sessions: [s('a')] })
    store().addSession(s('a'))
    expect(store().sessions.map((x) => x.id)).toEqual(['a'])
  })

  it('is safe to call twice with the same session', () => {
    store().addSession(s('a'))
    store().addSession(s('a'))
    expect(store().sessions).toHaveLength(1)
  })

  it('keeps the newest first, as the list expects', () => {
    usePracticeStore.setState({ sessions: [s('old')] })
    store().addSession(s('new'))
    expect(store().sessions.map((x) => x.id)).toEqual(['new', 'old'])
  })
})
