/**
 * Metronome built on a Web Audio lookahead scheduler.
 *
 * The naive approach — setInterval firing a click — drifts audibly within
 * about 30 seconds, because JS timers are not real-time and get throttled
 * by layout, GC and background tabs. Instead a coarse ~25ms timer wakes up
 * and schedules every click that falls inside the next 100ms *directly on
 * the audio clock*, which is sample-accurate. Timer jitter then only
 * affects when we queue, never when a click actually sounds.
 */

import { unlock, peek } from './engine'

export interface MetronomeOptions {
  /** Fires just before each beat sounds, for visual sync. */
  onBeat?: (beatIndex: number, isAccent: boolean, atTime: number) => void
}

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD_S = 0.1

export class Metronome {
  private timer: ReturnType<typeof setTimeout> | null = null
  private nextNoteTime = 0
  private beat = 0
  private onBeat?: (i: number, accent: boolean, at: number) => void

  bpm = 92
  beatsPerBar = 4
  running = false

  constructor(opts: MetronomeOptions = {}) {
    this.onBeat = opts.onBeat
  }

  /**
   * Must be called from inside a user gesture (Safari only authorises
   * resume() synchronously within the gesture's call stack).
   *
   * This used to build its own AudioContext, unguarded — so at Safari's
   * ceiling of roughly four contexts per page the constructor threw,
   * straight out through toggle() and into the React click handler. The
   * metronome then appeared dead with nothing logged and no way back.
   * The engine owns the one context now, and never throws.
   */
  prime(): void {
    unlock()
  }

  /**
   * The context whatever its state, not only when running: resume() is
   * asynchronous, so insisting on 'running' here would make the very first
   * tap do nothing on any browser that starts its context suspended.
   * Clicks scheduled during the resume sound as soon as it completes.
   */
  private get ctx(): AudioContext | null {
    return peek()
  }

  start(): void {
    if (this.running) return
    // unlock() returns the context even mid-resume, so a first tap works.
    const ctx = unlock()
    if (!ctx) return

    this.running = true
    this.beat = 0
    // Small offset so the very first click isn't scheduled in the past.
    this.nextNoteTime = ctx.currentTime + 0.06
    this.tick()
  }

  stop(): void {
    this.running = false
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  toggle(): boolean {
    if (this.running) this.stop()
    else this.start()
    return this.running
  }

  setBpm(bpm: number): void {
    this.bpm = Math.min(240, Math.max(30, Math.round(bpm)))
  }

  /**
   * Stops scheduling. It deliberately does *not* close the context: that
   * context is shared with the reward chime and the tuner now, and closing
   * it on leaving the session page silenced the whole app.
   */
  dispose(): void {
    this.stop()
  }

  /** Scheduler loop: queue everything landing inside the lookahead window. */
  private tick = (): void => {
    if (!this.running || !this.ctx) return

    while (this.nextNoteTime < this.ctx.currentTime + SCHEDULE_AHEAD_S) {
      // Every click identical — no accented downbeat. The bar position is
      // still reported so the dots can light up in sequence.
      this.click(this.nextNoteTime)
      this.onBeat?.(this.beat % this.beatsPerBar, false, this.nextNoteTime)

      this.nextNoteTime += 60 / this.bpm
      this.beat++
    }

    this.timer = setTimeout(this.tick, LOOKAHEAD_MS)
  }

  /** One click: a short pitched blip with a fast decay. */
  private click(at: number): void {
    const ctx = this.ctx
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'square'
    osc.frequency.value = 1050

    const peak = 0.19
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.055)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(at)
    osc.stop(at + 0.07)
  }
}

/**
 * Tap tempo. Keeps a rolling window of taps and averages the gaps between
 * them; taps more than ~2.5s apart start a fresh measurement so an
 * abandoned attempt doesn't poison the next one.
 */
export class TapTempo {
  private taps: number[] = []
  private readonly maxGapMs = 2500

  /** Returns the derived BPM, or null while there aren't enough taps. */
  tap(now = performance.now()): number | null {
    if (this.taps.length && now - this.taps[this.taps.length - 1] > this.maxGapMs) {
      this.taps = []
    }
    this.taps.push(now)
    if (this.taps.length > 6) this.taps.shift()
    if (this.taps.length < 2) return null

    let total = 0
    for (let i = 1; i < this.taps.length; i++) total += this.taps[i] - this.taps[i - 1]
    const bpm = Math.round(60000 / (total / (this.taps.length - 1)))

    return bpm >= 30 && bpm <= 240 ? bpm : null
  }

  reset(): void {
    this.taps = []
  }
}
