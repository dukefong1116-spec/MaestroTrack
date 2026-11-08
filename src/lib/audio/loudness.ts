import { unlock } from './engine'

/**
 * Playing a take back at a sensible loudness.
 *
 * Takes are recorded with automatic gain control *off*, deliberately —
 * see MIC_CONSTRAINTS: AGC flattens a diminuendo and pumps on a sustained
 * note. The cost is that a phone's mic, left alone, records well below
 * full scale, so a take played straight back is quiet even at full volume.
 *
 * Turning AGC back on would trade the recording's honesty for its level.
 * Voice Memos does not; it normalises. So does this: the whole take is
 * measured once, and one constant gain is applied to all of it. A quiet
 * passage stays quieter than a loud one — they are both just louder.
 *
 * The browser caps an <audio> element's volume at 1.0, so going louder
 * means routing it through Web Audio — which carries two traps, both
 * handled here rather than at each player:
 *
 *  - Web Audio silently outputs zeros for media from a server that does
 *    not send CORS headers. So only sources known to send them are routed
 *    at all; anything else plays exactly as it always did.
 *  - On iOS a plain <audio> element plays through the silent switch, but
 *    audio routed through Web Audio is "ambient" and is muted by it. The
 *    Audio Session API declares it as playback for as long as a take
 *    plays, and hands the previous setting back afterwards.
 */

/**
 * Apple's published loudness target for spoken audio (Apple Podcasts) and
 * for Sound Check. Voice Memos' own figure is not published; this is the
 * nearest one Apple states, and puts a take level with things people hear
 * on the same phone.
 */
const TARGET_LUFS = -16

/** Never boost further than this, so a near-silent take is not blown up into hiss. */
const MAX_BOOST_DB = 24

/** Never turn a take *down*. The complaint was quiet, not loud. */
const MIN_BOOST_DB = 0

/** What to apply while the measurement is still in flight, on a first play. */
const PRIOR_BOOST_DB = 9

const dbToGain = (db: number) => Math.pow(10, db / 20)

/** Measured boost per source, so a second play starts at the right level. */
const measuredDb = new Map<string, number>()

interface Route {
  gain: GainNode
}
const routes = new WeakMap<HTMLMediaElement, Route>()

/**
 * Whether a source's server sends CORS headers, so routing it through Web
 * Audio will not silence it. Verified rather than assumed: Firebase
 * download URLs answer `access-control-allow-origin: *`, the storage
 * emulator echoes the origin, and blob: URLs are this page's own.
 */
export function canBoost(src: string): boolean {
  if (!src) return false
  if (src.startsWith('blob:') || src.startsWith('data:')) return true
  try {
    const u = new URL(src, window.location.href)
    if (u.origin === window.location.origin) return true
    if (u.hostname === 'firebasestorage.googleapis.com') return true
    // The storage emulator, in development only — same /v0/b/ API shape.
    return import.meta.env.DEV && u.port === '9199' && u.pathname.startsWith('/v0/b/')
  } catch {
    return false
  }
}

/** This page's own audio — never subject to CORS, so never taintable. */
function isLocal(src: string): boolean {
  if (src.startsWith('blob:') || src.startsWith('data:')) return true
  try { return new URL(src, window.location.href).origin === window.location.origin } catch { return false }
}

/* ── measuring ───────────────────────────────────────────────────── */

/**
 * Integrated loudness, after ITU-R BS.1770: 400 ms blocks on a 100 ms hop,
 * an absolute gate at −70 and a relative gate 10 below the ungated mean.
 *
 * Without the K-weighting filter — for a recorded instrument that moves
 * the answer by about a decibel, and it would cost a second pass over the
 * whole file on a phone. The gating is what matters: it keeps the silence
 * before and after the playing from dragging the measurement down and
 * over-boosting the take.
 *
 * Computed from 100 ms sub-block energies, so every sample is read once
 * and memory stays flat however long the take is.
 */
export function integratedLoudness(channels: Float32Array[], sampleRate: number): number | null {
  const sub = Math.max(1, Math.round(sampleRate * 0.1))
  const length = channels[0]?.length ?? 0
  const subCount = Math.floor(length / sub)
  if (subCount === 0) return null

  // Mean square per 100 ms sub-block, summed across channels (BS.1770 sums
  // the channel powers rather than averaging them).
  const energy = new Float64Array(subCount)
  for (const data of channels) {
    for (let b = 0; b < subCount; b++) {
      let sum = 0
      const start = b * sub
      for (let i = start; i < start + sub; i++) sum += data[i] * data[i]
      energy[b] += sum / sub
    }
  }

  // A 400 ms block is four consecutive sub-blocks; a take under 400 ms is
  // treated as one block of whatever it has.
  const blocks: number[] = []
  if (subCount < 4) {
    let sum = 0
    for (let b = 0; b < subCount; b++) sum += energy[b]
    blocks.push(sum / subCount)
  } else {
    for (let b = 0; b + 4 <= subCount; b++) {
      blocks.push((energy[b] + energy[b + 1] + energy[b + 2] + energy[b + 3]) / 4)
    }
  }

  const lufs = (ms: number) => -0.691 + 10 * Math.log10(ms)
  const audible = blocks.filter((ms) => ms > 0 && lufs(ms) > -70)
  if (!audible.length) return null

  const ungated = audible.reduce((a, b) => a + b, 0) / audible.length
  const floor = lufs(ungated) - 10
  const gated = audible.filter((ms) => lufs(ms) > floor)
  const mean = gated.reduce((a, b) => a + b, 0) / gated.length
  return lufs(mean)
}

/** How many decibels to add to reach the target, within bounds. */
export function boostFor(loudness: number | null): number {
  if (loudness === null) return MIN_BOOST_DB
  return Math.min(MAX_BOOST_DB, Math.max(MIN_BOOST_DB, TARGET_LUFS - loudness))
}

async function measure(ctx: AudioContext, src: string): Promise<number> {
  const cached = measuredDb.get(src)
  if (cached !== undefined) return cached
  const res = await fetch(src)
  if (!res.ok) throw new Error(`fetch ${res.status}`)
  const decoded = await ctx.decodeAudioData(await res.arrayBuffer())
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i))
  const db = boostFor(integratedLoudness(channels, decoded.sampleRate))
  measuredDb.set(src, db)
  return db
}

/* ── playing ─────────────────────────────────────────────────────── */

type AudioSessionType = 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record'
interface AudioSessionLike { type: AudioSessionType }
const session = (): AudioSessionLike | null =>
  (navigator as unknown as { audioSession?: AudioSessionLike }).audioSession ?? null

/** Called synchronously from the tap: Safari only resumes audio inside the gesture. */
export function wakeAudio(): void {
  unlock()
}

/**
 * Route a player through a gain and a limiter, louder by however much its
 * take needs. Call it once the element's src is known and before play().
 *
 * Does nothing — and the element plays as it always has — when the source
 * is not one known to send CORS, when audio is unavailable, or when the
 * element has already loaded without CORS (routing it then would silence it).
 */
export function boost(el: HTMLMediaElement, opts: { onlyIfRunning?: boolean } = {}): void {
  const src = el.currentSrc || el.getAttribute('src') || ''
  if (!canBoost(src)) return

  let route = routes.get(el)
  if (!route) {
    const local = isLocal(src)
    // Cross-origin and already loaded without CORS: routing would taint it
    // into silence. A blob: or same-origin take cannot be tainted.
    if (!local && el.readyState !== HTMLMediaElement.HAVE_NOTHING && el.crossOrigin !== 'anonymous') return
    const ctx = unlock()
    if (!ctx) return
    // Where the caller could not wake audio inside a tap, only route if it
    // is already live: a routed element on a context that never resumes
    // is silent, which is worse than quiet.
    if (opts.onlyIfRunning && ctx.state !== 'running') return
    try {
      // Before the first load, so the request goes out as CORS.
      if (!local && el.crossOrigin !== 'anonymous') el.crossOrigin = 'anonymous'
      const source = ctx.createMediaElementSource(el)
      const gain = ctx.createGain()
      // A limiter, in effect: ratio 20 above −1.5 dBFS, fast attack. A
      // take with one loud attack would otherwise clip once boosted.
      const limiter = ctx.createDynamicsCompressor()
      limiter.threshold.value = -1.5
      limiter.knee.value = 0
      limiter.ratio.value = 20
      limiter.attack.value = 0.002
      limiter.release.value = 0.15
      source.connect(gain).connect(limiter).connect(ctx.destination)
      route = { gain }
      routes.set(el, route)
      holdPlaybackSession(el)
    } catch (e) {
      console.warn('[loudness] could not route; playing unboosted', e)
      return
    }
  }

  const ctx = unlock()
  if (!ctx) return
  const known = measuredDb.get(src)
  route.gain.gain.value = dbToGain(known ?? PRIOR_BOOST_DB)
  if (known !== undefined) return

  // First play of this take: measure while it plays, then ease to the
  // right level. Eased over a third of a second so the correction reads
  // as the take settling rather than a jump.
  const gainNode = route.gain
  measure(ctx, src)
    .then((db) => gainNode.gain.setTargetAtTime(dbToGain(db), ctx.currentTime, 0.1))
    .catch((e) => console.warn('[loudness] measurement failed; keeping the default boost', e))
}

/**
 * Keep iOS from muting a routed take with the silent switch, for as long
 * as it plays, then hand back whatever was set before.
 */
function holdPlaybackSession(el: HTMLMediaElement): void {
  const s = session()
  if (!s) return
  let previous: AudioSessionType | null = null
  const take = () => {
    if (s.type !== 'playback') { previous = s.type; s.type = 'playback' }
  }
  const give = () => {
    if (previous !== null) { s.type = previous; previous = null }
  }
  el.addEventListener('play', take)
  el.addEventListener('pause', give)
  el.addEventListener('ended', give)
  take()
}
