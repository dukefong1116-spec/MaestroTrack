import { describe, it, expect } from 'vitest'
import { cleanForFirestore } from '../clean'

/**
 * Regression cover for a bug that cost a working feature: a recording with
 * no notes carried `notes: undefined`, Firestore rejected the whole write
 * with `invalid-argument`, and because the audio had already uploaded the
 * file existed in Storage with nothing pointing at it.
 */
describe('cleanForFirestore', () => {
  it('drops undefined, which Firestore refuses outright', () => {
    expect(cleanForFirestore({ a: 1, notes: undefined })).toEqual({ a: 1 })
  })

  it('drops empty strings, which read as absent everywhere anyway', () => {
    expect(cleanForFirestore({ a: 1, notes: '' })).toEqual({ a: 1 })
  })

  it('keeps falsy values that are real data', () => {
    // 0 minutes and false are meaningful; only undefined and '' are not.
    expect(cleanForFirestore({ duration: 0, done: false, n: null }))
      .toEqual({ duration: 0, done: false, n: null })
  })

  it('handles the exact recording metadata shape that failed', () => {
    const metadata = {
      pieceName: 'Ballade No. 1',
      date: '2026-09-20',
      notes: undefined,
      duration: 95,
      sessionId: 'sess-123',
      userId: 'uid',
      audioUrl: 'https://…',
      createdAt: '2026-09-20T00:00:00.000Z',
    }
    const out = cleanForFirestore(metadata)
    expect('notes' in out).toBe(false)
    expect(Object.values(out).every((v) => v !== undefined)).toBe(true)
    expect(out.duration).toBe(95)
  })

  it('leaves a genuine note alone', () => {
    expect(cleanForFirestore({ notes: 'coda uneven' })).toEqual({ notes: 'coda uneven' })
  })
})
