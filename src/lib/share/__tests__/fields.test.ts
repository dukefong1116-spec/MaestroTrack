import { describe, it, expect } from 'vitest'
import { buildShareFields, buildShareText, DEFAULT_SHARE_OPTIONS } from '../fields'
import type { PracticeSession, UserProfile } from '@/types'

const session = (over: Partial<PracticeSession> = {}): PracticeSession => ({
  id: 's1', userId: 'u1', date: '2026-10-18', durationMinutes: 47,
  category: 'Repertoire', difficultyRating: 3, confidenceRating: 7,
  notes: 'this is awful and I hate it',
  pieceName: 'piece-abc',
  createdAt: '2026-10-18T10:00:00.000Z', ...over,
} as PracticeSession)

const profile = {
  displayName: 'Ana Rivera', studioCode: 'JFA1T4', teacherId: 'teacher-1',
  email: 'ana@example.test',
} as UserProfile

const build = (opts = DEFAULT_SHARE_OPTIONS, over: Partial<PracticeSession> = {}) =>
  buildShareFields({
    session: session(over), profile, streakDays: 12,
    pieceTitle: 'Chopin Ballade No 3', week: [0, 20, 16, 26, 0, 22, 47], options: opts,
  })

describe('what goes on the card', () => {
  it('carries the figures someone would want to post', () => {
    const f = build()
    expect(f.minutes).toBe(47)
    expect(f.dateLabel).toBe('Sunday, 18 October')
    expect(f.name).toBe('Ana Rivera')
    expect(f.streakDays).toBe(12)
  })

  it('leaves the piece off unless it is asked for', () => {
    expect(build().pieceTitle).toBeUndefined()
    expect(build({ ...DEFAULT_SHARE_OPTIONS, includePiece: true }).pieceTitle)
      .toBe('Chopin Ballade No 3')
  })

  it('shares anonymously when the name is turned off', () => {
    expect(build({ ...DEFAULT_SHARE_OPTIONS, includeName: false }).name).toBeUndefined()
  })

  it('omits a streak nobody has yet rather than printing zero', () => {
    const f = buildShareFields({
      session: session(), profile, streakDays: 0, options: DEFAULT_SHARE_OPTIONS,
    })
    expect(f.streakDays).toBeUndefined()
  })
})

/**
 * The reason this file exists. Mirrors the assertions summary.test.ts
 * makes about practiceSummary: the test is cheap, and what it stops is
 * irreversible once posted.
 */
describe('what must never go on the card', () => {
  const everything = { includeName: true, includeStreak: true, includePiece: true }

  it('never the notes', () => {
    const serialised = JSON.stringify(build(everything))
    expect(serialised).not.toContain('awful')
    expect(serialised).not.toContain('hate')
  })

  it('never the studio code or the teacher', () => {
    const serialised = JSON.stringify(build(everything))
    expect(serialised).not.toContain('JFA1T4')
    expect(serialised).not.toContain('teacher-1')
  })

  it('never an email or an internal id', () => {
    const serialised = JSON.stringify(build(everything))
    expect(serialised).not.toContain('@')
    expect(serialised).not.toContain('piece-abc')
  })

  it('and the same is true of the text that goes with it', () => {
    const text = buildShareText(build(everything))
    expect(text).not.toContain('awful')
    expect(text).not.toContain('JFA1T4')
    expect(text).toContain('47 minutes')
  })
})

describe('the words on a public post', () => {
  it('never says "1 minutes"', () => {
    const one = buildShareFields({
      session: session({ durationMinutes: 1 }), profile, streakDays: 1,
      options: DEFAULT_SHARE_OPTIONS,
    })
    expect(buildShareText(one)).toContain('1 minute of practice')
    expect(buildShareText(one)).not.toContain('1 minutes')
  })

  it('and still pluralises everything else', () => {
    expect(buildShareText(build())).toContain('47 minutes')
  })
})
