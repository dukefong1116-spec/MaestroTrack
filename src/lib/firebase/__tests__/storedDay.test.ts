import { describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import { storedDay, withStoredDay } from '../storedDay'

describe('storedDay — a stored date, as the day the app reads', () => {
  it('keeps the string every writer saves, untouched', () => {
    expect(storedDay('2026-11-07')).toBe('2026-11-07')
    // Some takes carry a full ISO string; readers take the first ten.
    expect(storedDay('2026-11-07T09:30:00.000Z')).toBe('2026-11-07T09:30:00.000Z')
  })

  it('reads a Timestamp saved at UTC midnight back as its own day', () => {
    // Exactly what the unshipped writer stored, and what crashed the app.
    const ts = Timestamp.fromDate(new Date('2026-11-07T00:00:00.000Z'))
    expect(storedDay(ts)).toBe('2026-11-07')
  })

  it('reads a cached Timestamp that lost its methods', () => {
    expect(storedDay({ seconds: Date.UTC(2026, 10, 7) / 1000, nanoseconds: 0 })).toBe('2026-11-07')
  })

  it('reads a Date and an epoch number', () => {
    expect(storedDay(new Date('2026-11-07T00:00:00.000Z'))).toBe('2026-11-07')
    expect(storedDay(Date.UTC(2026, 10, 7))).toBe('2026-11-07')
  })

  it('falls back to the day it was created when the date is unreadable', () => {
    const created = '2026-11-07T18:00:00.000Z'
    expect(storedDay(undefined, created)).toBe('2026-11-07')
    expect(storedDay(null, created)).toBe('2026-11-07')
    expect(storedDay('', created)).toBe('2026-11-07')
    expect(storedDay('last Tuesday', created)).toBe('2026-11-07')
    expect(storedDay({}, created)).toBe('2026-11-07')
    expect(storedDay(new Date('nonsense'), created)).toBe('2026-11-07')
  })

  it('gives up only with no date and no creation time', () => {
    expect(storedDay(undefined)).toBeNull()
    expect(storedDay({}, 'not a date')).toBeNull()
  })
})

describe('withStoredDay — a document, ready to read', () => {
  it('settles the date and keeps everything else', () => {
    const ts = Timestamp.fromDate(new Date('2026-11-07T00:00:00.000Z'))
    const s = withStoredDay<{ id: string; date: string; durationMinutes: number }>(
      's1', { date: ts, durationMinutes: 15 }, 'sessions')
    expect(s).toEqual({ id: 's1', date: '2026-11-07', durationMinutes: 15 })
    // The thing that threw is now safe.
    expect(s!.date.substring(0, 10)).toBe('2026-11-07')
  })

  it('leaves out a document with no day at all', () => {
    expect(withStoredDay('s2', { durationMinutes: 15 }, 'sessions')).toBeNull()
  })
})
