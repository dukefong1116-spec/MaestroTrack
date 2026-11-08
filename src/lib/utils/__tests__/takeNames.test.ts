import { describe, expect, it } from 'vitest'
import { takeLabel, takeNamesByDay } from '../takeNames'

describe('takeLabel', () => {
  it('names the first take of a day by the date alone', () => {
    expect(takeLabel('2026-11-05', 1)).toBe('Nov 5, 2026')
  })

  it('numbers the rest from 2', () => {
    expect(takeLabel('2026-11-05', 2)).toBe('Nov 5, 2026 2')
    expect(takeLabel('2026-11-05', 3)).toBe('Nov 5, 2026 3')
  })

  it('reads the day from a full timestamp without shifting it', () => {
    // Parsed from the date part, never through UTC: a late-evening take
    // west of Greenwich must not land on the next day.
    expect(takeLabel('2026-11-05T23:30:00.000Z', 1)).toBe('Nov 5, 2026')
  })
})

describe('takeNamesByDay', () => {
  it('numbers across sessions within one day, in recorded order', () => {
    const names = takeNamesByDay([
      { id: 'b', date: '2026-11-05', createdAt: '2026-11-05T19:00:00Z' },  // evening session
      { id: 'a', date: '2026-11-05', createdAt: '2026-11-05T08:00:00Z' },  // morning session
      { id: 'c', date: '2026-11-05', createdAt: '2026-11-05T19:05:00Z' },
    ])
    expect(names.get('a')).toBe('Nov 5, 2026')
    expect(names.get('b')).toBe('Nov 5, 2026 2')
    expect(names.get('c')).toBe('Nov 5, 2026 3')
  })

  it('starts each day over', () => {
    const names = takeNamesByDay([
      { id: 'x', date: '2026-11-05', createdAt: '2026-11-05T08:00:00Z' },
      { id: 'y', date: '2026-11-06', createdAt: '2026-11-06T08:00:00Z' },
    ])
    expect(names.get('x')).toBe('Nov 5, 2026')
    expect(names.get('y')).toBe('Nov 6, 2026')
  })
})
