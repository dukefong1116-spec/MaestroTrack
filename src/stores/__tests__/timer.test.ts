import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { usePracticeStore } from '../practiceStore'

/**
 * The session clock. Covered because the pause control silently discarded
 * the whole session: pausing cleared the start instant and resuming set it
 * to now, so a 52-minute practice came back as 00:00.
 */
describe('session timer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    usePracticeStore.getState().resetTimer()
  })
  afterEach(() => vi.useRealTimers())

  const tick = (seconds: number) => vi.advanceTimersByTime(seconds * 1000)
  const store = () => usePracticeStore.getState()

  it('counts while running', () => {
    store().startTimer()
    tick(90)
    expect(store().elapsedSeconds()).toBe(90)
  })

  it('keeps the clock across a pause and resume', () => {
    store().startTimer()
    tick(52 * 60)
    expect(store().pauseTimer()).toBe(52 * 60)
    expect(store().elapsedSeconds()).toBe(52 * 60)

    tick(10 * 60) // paused: this must not count
    expect(store().elapsedSeconds()).toBe(52 * 60)

    store().startTimer()
    tick(8 * 60)
    expect(store().elapsedSeconds()).toBe(60 * 60)
  })

  it('survives several pauses', () => {
    store().startTimer()
    tick(60); store().pauseTimer()
    tick(600)
    store().startTimer(); tick(60); store().pauseTimer()
    tick(600)
    store().startTimer(); tick(60)
    expect(store().elapsedSeconds()).toBe(180)
  })

  it('stopTimer returns the whole session, banked time included', () => {
    store().startTimer()
    tick(40 * 60)
    store().pauseTimer()
    store().startTimer()
    tick(20 * 60)
    expect(store().stopTimer()).toBe(60 * 60)
  })

  it('stopTimer clears the clock so a second call cannot re-bank it', () => {
    store().startTimer()
    tick(30 * 60)
    expect(store().stopTimer()).toBe(30 * 60)
    expect(store().stopTimer()).toBe(0)
    expect(store().elapsedSeconds()).toBe(0)
  })

  it('reports the banked time while paused, not zero', () => {
    store().startTimer()
    tick(45 * 60)
    store().pauseTimer()
    expect(store().timerRunning).toBe(false)
    expect(store().elapsedSeconds()).toBe(45 * 60)
  })

  it('resetTimer discards everything', () => {
    store().startTimer()
    tick(45 * 60)
    store().pauseTimer()
    store().resetTimer()
    expect(store().elapsedSeconds()).toBe(0)
    expect(store().timerAccumulatedSec).toBe(0)
  })
})
