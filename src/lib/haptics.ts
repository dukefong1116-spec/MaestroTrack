import { registerPlugin } from '@capacitor/core'
import { isNativeApp } from '@/lib/native'

/**
 * Haptics: every moment its own feel.
 *
 * In the iPhone app each pattern is played with Core Haptics
 * (FemataHapticsPlugin in ios/App/App/NativeTabBar.swift), so a pattern is
 * a little score of taps and rumbles: when (t, seconds), how hard (i, 0–1),
 * how crisp (s, 0–1: low is a dull thud, high a sharp click), and for a
 * rumble how long (d). On the web, phones that can vibrate get the rough
 * shape of it; the rest (an iPhone's Safari) feel nothing.
 *
 * Off with the Haptics switch in Settings › Appearance.
 */

interface Ev { t: number; i: number; s: number; d?: number }
interface HapticsPlugin { play(o: { events: Ev[] }): Promise<void> }
const Native = registerPlugin<HapticsPlugin>('FemataHaptics')

const tap = (t: number, i: number, s: number): Ev => ({ t, i, s })
const rumble = (t: number, d: number, i: number, s: number): Ev => ({ t, i, s, d })

/** A ramp of taps from one strength to another, `n` of them over `len` seconds. */
function ramp(t: number, len: number, n: number, from: number, to: number, s: number): Ev[] {
  return Array.from({ length: n }, (_, k) => tap(t + (len * k) / Math.max(1, n - 1), from + ((to - from) * k) / Math.max(1, n - 1), s))
}

/** Several takes of the same moment: one is picked each time, so it never feels canned. */
type Take = Ev[] | (() => Ev[])

const PATTERNS = {
  /** Any ordinary press: a light, crisp tick. */
  tap: [[tap(0, 0.45, 0.7)]],
  /** Picking a chip, a tab, a toggle: the lightest click there is. */
  select: [[tap(0, 0.3, 0.9)]],
  /** Patting Femata: a purr — soft, warm taps that fade. Three moods of purr. */
  pat: [
    [tap(0, 0.55, 0.25), tap(0.09, 0.4, 0.2), tap(0.17, 0.28, 0.15), tap(0.24, 0.18, 0.1)],
    [rumble(0, 0.22, 0.35, 0.1), tap(0.24, 0.5, 0.3)],
    [tap(0, 0.4, 0.3), tap(0.12, 0.6, 0.35), tap(0.3, 0.3, 0.2)],
  ],
  /** Picking Femata up: a quick lift. */
  pick: [[tap(0, 0.6, 0.85), tap(0.05, 0.25, 0.9)]],
  /** Putting Femata down: a soft thud and one small bounce. */
  drop: [[tap(0, 0.85, 0.2), tap(0.13, 0.3, 0.3)]],
  /** Starting a session: two rising steps, like a count-in. */
  start: [[tap(0, 0.4, 0.6), tap(0.14, 0.75, 0.7)]],
  /** Pausing: one soft, low press. */
  pause: [[tap(0, 0.5, 0.15)]],
  /** Finishing a session: a firm landing, a warm swell, and a bright pop on top. */
  finish: [
    [tap(0, 0.8, 0.5), rumble(0.1, 0.35, 0.45, 0.2), tap(0.5, 1, 0.8)],
    [tap(0, 0.6, 0.4), tap(0.12, 0.8, 0.5), rumble(0.22, 0.25, 0.5, 0.25), tap(0.52, 1, 0.9)],
  ],
  /** Today's flame lights: a heartbeat, then the crackle of a fire catching. */
  streakLit: [
    () => [tap(0, 0.7, 0.3), tap(0.15, 1, 0.4), ...crackle(0.34, 5)],
    () => [rumble(0, 0.18, 0.4, 0.2), tap(0.2, 1, 0.5), ...crackle(0.36, 4)],
  ],
  /** A freeze saves the day: a cold, thin, steady hum. */
  freeze: [[rumble(0, 0.3, 0.35, 0.95), tap(0.32, 0.5, 1)]],
  /** A streak breaks: one hard crack, then the shards falling. */
  shatter: [() => [tap(0, 1, 1), ...shards(0.08, 7)]],
  /** Locking in a goal, a promise: a building rumble that lands in one decisive press. */
  commit: [[rumble(0, 0.32, 0.25, 0.2), ...ramp(0.05, 0.25, 4, 0.2, 0.55, 0.3), tap(0.36, 1, 0.55)]],
  /** Something charging up (a badge about to flip): a rumble that swells. */
  charge: [[rumble(0, 0.5, 0.2, 0.3), ...ramp(0.1, 0.4, 5, 0.15, 0.6, 0.5)]],
  /** Ice thawing: slow drips, each a little softer. */
  thaw: [[tap(0, 0.4, 0.7), tap(0.22, 0.32, 0.7), tap(0.48, 0.25, 0.7), tap(0.8, 0.18, 0.7)]],
  /** A badge: sparkles, quickening and brightening. */
  badge: [() => sparkle(7, 0.55), () => [tap(0, 0.9, 0.6), ...sparkle(5, 0.4).map((e) => ({ ...e, t: e.t + 0.12 }))]],
  /** Confetti and celebrations: a scatter of tiny bright taps. */
  celebrate: [() => sparkle(10, 0.8)],
  /** Moving up in the league: three steps, each higher and crisper. */
  climb: [[tap(0, 0.4, 0.3), tap(0.12, 0.65, 0.55), tap(0.24, 0.95, 0.85)]],
  /** Moving down: a slow, soft slide downward, sorry rather than harsh. */
  sink: [[tap(0, 0.6, 0.4), tap(0.18, 0.4, 0.25), rumble(0.3, 0.3, 0.25, 0.05)]],
  /** Something done and saved: Apple's success shape, a short double. */
  success: [[tap(0, 0.6, 0.5), tap(0.11, 0.9, 0.7)]],
  /** Something wrong: three dull knocks. */
  error: [[tap(0, 0.8, 0.1), tap(0.1, 0.8, 0.1), tap(0.2, 0.6, 0.1)]],
  /** A gentle "look here": the guide's next step, a new notification. */
  nudge: [[tap(0, 0.35, 0.5), tap(0.09, 0.2, 0.6)]],
  /** The launch screen's hop: two little landings. */
  hop: [[tap(0, 0.35, 0.3), tap(0.36, 0.25, 0.3)]],
} satisfies Record<string, Take[]>

export type HapticName = keyof typeof PATTERNS

function crackle(t: number, n: number): Ev[] {
  return Array.from({ length: n }, (_, k) => tap(t + k * (0.045 + Math.random() * 0.04), 0.2 + Math.random() * 0.25, 0.85 + Math.random() * 0.15))
}
function shards(t: number, n: number): Ev[] {
  let at = t
  return Array.from({ length: n }, (_, k) => {
    at += 0.03 + Math.random() * 0.06 + k * 0.01
    return tap(at, Math.max(0.12, 0.55 - k * 0.06) * (0.7 + Math.random() * 0.3), 0.9)
  })
}
function sparkle(n: number, peak: number): Ev[] {
  let at = 0
  return Array.from({ length: n }, (_, k) => {
    at += Math.max(0.035, 0.12 - k * 0.012) + Math.random() * 0.03
    return tap(at, Math.min(1, 0.25 + (peak * k) / n + Math.random() * 0.1), 0.8 + Math.random() * 0.2)
  })
}

// On unless switched off. Set from the preferences (lib/utils/prefs), and
// read from the copy saved on this phone at once, so a moment at launch
// (the launch screen's hop) already honours the switch.
let enabled = (() => {
  try { return (JSON.parse(localStorage.getItem('maestro_prefs') ?? 'null') as { haptics?: boolean } | null)?.haptics !== false } catch { return true }
})()
export function setHapticsEnabled(on: boolean) { enabled = on }
export const hapticsEnabled = () => enabled

/** Rough shape for phones that only know how to vibrate: buzz lengths and gaps. */
function toVibration(evs: Ev[]): number[] {
  const out: number[] = []
  let at = 0
  for (const e of [...evs].sort((a, b) => a.t - b.t)) {
    const start = Math.round(e.t * 1000)
    const len = Math.max(8, Math.round((e.d ? e.d * 1000 : 12 + e.i * 18)))
    if (out.length) out.push(Math.max(0, start - at))
    out.push(len)
    at = start + len
  }
  return out
}

/**
 * Every pattern played firmer than written: a floor lifts the light ticks
 * so they are clearly felt, and the rest scale up to full strength, so
 * each pattern keeps its shape (a purr still softer than a crack), just
 * stronger. Rumbles a touch longer too.
 */
const FLOOR = 0.4
function stronger(evs: Ev[]): Ev[] {
  return evs.map((e) => ({
    ...e,
    i: Math.min(1, FLOOR + e.i * (1 - FLOOR) * 1.25),
    s: Math.min(1, e.s + 0.1),
    ...(e.d ? { d: e.d * 1.2 } : {}),
  }))
}

/** Play a moment's feel. Never throws, never waits. */
export function haptic(name: HapticName) {
  if (!enabled) return
  const takes = PATTERNS[name] as Take[]
  const take = takes[Math.floor(Math.random() * takes.length)]
  const events = stronger(typeof take === 'function' ? take() : take)
  try {
    if (isNativeApp) void Native.play({ events }).catch(() => {})
    else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(toVibration(events))
  } catch { /* nothing to feel here */ }
}
