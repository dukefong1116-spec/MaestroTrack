/**
 * The app's single audio context.
 *
 * There used to be three — one for the reward chime, one inside the
 * Metronome, one built per tuner session — each created and resumed by
 * different code following different rules. On Chrome that is merely
 * untidy. On Safari it is broken by construction:
 *
 *  - Safari caps a page at around four concurrent AudioContexts, and
 *    `new AudioContext()` *throws* at the ceiling rather than returning
 *    anything you can check.
 *  - Safari only honours `resume()` when it runs synchronously inside a
 *    user gesture. Chrome resumes on "sticky activation" long after the
 *    click, which is why this bug was invisible in testing: Chrome
 *    silently repairs the exact mistake Safari punishes.
 *
 * So: one context, owned here, unlocked by *every* gesture rather than
 * the first one, and never allowed to throw into a caller.
 */

type Listener = () => void

let ctx: AudioContext | null = null
let installed = false
const listeners = new Set<Listener>()

function Ctor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    null
  )
}

function notify() {
  for (const l of listeners) {
    try { l() } catch { /* a listener must never break audio */ }
  }
}

/** Subscribe to state changes (used by the diagnostic panel). */
export function onAudioChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Create the context if needed and resume it. Safe to call anywhere, but
 * only *effective* inside a user gesture on Safari — so call it from every
 * gesture rather than trying to predict which one matters.
 */
export function unlock(): AudioContext | null {
  const C = Ctor()
  if (!C) return null

  if (!ctx || ctx.state === 'closed') {
    try {
      ctx = new C()
    } catch {
      // At Safari's ceiling, or audio unavailable. Never throw: callers are
      // click handlers, and an exception here kills the button, not just
      // the sound.
      ctx = null
      notify()
      return null
    }
  }

  if (ctx.state === 'suspended') {
    ctx.resume().then(notify).catch(() => {})
  }
  notify()
  return ctx
}

/**
 * The context, but only if it can actually make sound right now.
 *
 * Returning a suspended context is how sound went missing without a single
 * error: oscillators scheduled on a suspended clock simply never play.
 * Callers get null instead, so a failure is detectable.
 */
export function ready(): AudioContext | null {
  if (ctx && ctx.state === 'running') return ctx
  return null
}

/** The context whatever its state — for the tuner, which can wait. */
export function peek(): AudioContext | null {
  return ctx
}

export interface AudioState {
  exists: boolean
  state: AudioContextState | 'none'
  sampleRate: number | null
  /** True when a sound played right now would be heard. */
  canPlay: boolean
}

export function audioState(): AudioState {
  return {
    exists: !!ctx,
    state: ctx?.state ?? 'none',
    sampleRate: ctx?.sampleRate ?? null,
    canPlay: ctx?.state === 'running',
  }
}

/**
 * Keep the context alive for the life of the page.
 *
 * Every pointer and key event unlocks, rather than only the first: Safari
 * suspends audio when a tab is backgrounded, when the system sleeps, and
 * at its own discretion. Arming once and detaching — which is what this
 * used to do — means the first suspension is permanent and the app goes
 * quiet with nothing to show for it.
 */
export function installAudioUnlock(): void {
  if (installed || typeof document === 'undefined') return
  installed = true

  const onGesture = () => { if (ctx?.state !== 'running') unlock() }

  // Capture phase, so a handler calling stopPropagation cannot starve us.
  document.addEventListener('pointerdown', onGesture, true)
  document.addEventListener('keydown', onGesture, true)
  document.addEventListener('touchstart', onGesture, true)

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ctx?.state === 'suspended') {
      ctx.resume().then(notify).catch(() => {})
    }
  })
}
