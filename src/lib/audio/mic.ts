import { MIC_CONSTRAINTS } from './recorderFormat'

/**
 * Opening the microphone, and making sure it is actually open.
 *
 * Two things went wrong at the start of a take, and they look the same
 * from the outside: the first seconds come out soft, or oddly coloured,
 * and then it settles.
 *
 * The first is that `getUserMedia` resolves when the track exists, not
 * when the device is delivering steady audio. A USB interface is
 * negotiating, a Bluetooth headset is switching to its telephony profile,
 * and the OS input stage is still settling. Recording into that window
 * records the settling.
 *
 * The second is that constraints are a request, not a guarantee. We ask
 * for gain control, noise suppression and echo cancellation to be off —
 * they are ruinous for an instrument — but nothing checked whether the
 * browser agreed, and automatic gain control converging upward from a
 * cautious starting point is exactly "quiet, then fine".
 *
 * So: ask, then verify, then re-ask, and tell the truth when the answer
 * is still no.
 */

type Processing = 'automatic gain control' | 'noise suppression' | 'echo cancellation'

interface MaybeProcessed extends MediaTrackSettings {
  autoGainControl?: boolean
  noiseSuppression?: boolean
  echoCancellation?: boolean
}

/**
 * Which unwanted processing a track admits to.
 *
 * An empty list can mean "none" or "this browser does not report it";
 * the two are deliberately not distinguished, because warning someone
 * about a setting we cannot see would be guessing out loud.
 */
export function activeProcessing(track: MediaStreamTrack): Processing[] {
  let s: MaybeProcessed
  try {
    s = track.getSettings() as MaybeProcessed
  } catch {
    return []
  }
  const on: Processing[] = []
  if (s.autoGainControl === true) on.push('automatic gain control')
  if (s.noiseSuppression === true) on.push('noise suppression')
  if (s.echoCancellation === true) on.push('echo cancellation')
  return on
}

/** Plain English, with an Oxford comma, for one to three items. */
export function listPhrase(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

/**
 * What to tell someone whose browser is processing their playing anyway.
 *
 * Worth saying out loud: without it, a recording that sounds wrong looks
 * like the instrument, the room, or the player.
 */
export function micProcessingWarning(stream: MediaStream | null): string | null {
  const track = stream?.getAudioTracks()[0]
  if (!track) return null
  const on = activeProcessing(track)
  if (on.length === 0) return null
  return `Your browser is applying ${listPhrase(on)} to the microphone and would not turn it off. `
    + `Quiet notes may be boosted or trimmed. On a Mac, check the mic mode in Control Centre.`
}

function isLive(stream: MediaStream | null): stream is MediaStream {
  return !!stream && stream.getAudioTracks().some((t) => t.readyState === 'live')
}

/**
 * A microphone stream, reusing one that is already open.
 *
 * This deliberately does *not* call applyConstraints to undo processing
 * the browser reported. That was tried, and it was worse than the problem
 * it addressed: reconfiguring a live track makes the browser restart the
 * capture, and a restarting device emits exact zeros — so takes came back
 * with seconds of true silence at the front rather than merely quiet
 * audio. The constraints are requested at open time, which is the only
 * moment they can be honoured without disturbing anything; when they are
 * refused, the warning above says so and the person can fix it where it
 * actually lives.
 */
export async function openMic(existing: MediaStream | null): Promise<MediaStream> {
  if (isLive(existing)) return existing
  return await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)
}

/**
 * Below this, a sample is silence rather than a quiet room.
 *
 * A microphone that is running always produces *something* — room tone,
 * self-noise, the floor of its own converter. Exact zeros mean the device
 * is not delivering yet. That difference is the whole test.
 */
export const SILENCE_FLOOR = 1e-4

/** Longest we will hold someone up waiting for a device to speak. */
export const MAX_WAIT_MS = 1500

/**
 * Wait until the microphone is actually producing audio.
 *
 * The first attempt at this problem guessed a duration — a fixed warm-up
 * long enough for a device to settle. Guessing was wrong twice over: too
 * short for a Bluetooth headset negotiating its profile, and pure delay
 * for a device that was ready immediately.
 *
 * So this measures instead. It returns as soon as a non-zero sample
 * arrives, which for a working microphone is almost at once, and gives up
 * after MAX_WAIT_MS so a genuinely silent room still records.
 *
 * Resolves with how long it waited, which is worth knowing.
 */
export async function waitForSignal(
  stream: MediaStream,
  ctx: AudioContext,
  maxMs: number = MAX_WAIT_MS
): Promise<number> {
  const started = Date.now()
  let src: MediaStreamAudioSourceNode | null = null
  let analyser: AnalyserNode | null = null
  try {
    src = ctx.createMediaStreamSource(stream)
    analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    src.connect(analyser)
    const buf = new Float32Array(analyser.fftSize)

    while (Date.now() - started < maxMs) {
      analyser.getFloatTimeDomainData(buf)
      if (peakOf(buf) > SILENCE_FLOOR) break
      await new Promise((r) => setTimeout(r, 40))
    }
  } catch {
    /* no analyser available: fall through and record anyway */
  } finally {
    // Never left connected — the tuner reads the same stream, and a
    // forgotten analyser is a leak that survives the take.
    try { src?.disconnect() } catch { /* already gone */ }
    try { analyser?.disconnect() } catch { /* already gone */ }
  }
  return Date.now() - started
}

export function peakOf(samples: Float32Array): number {
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i])
    if (v > peak) peak = v
  }
  return peak
}

/**
 * How much silence a finished take begins with.
 *
 * The point of this is to stop arguing by ear. "The start is dead" and
 * "it sounds fine now" are both unfalsifiable; 1.94 seconds is not. Run
 * on every take, it says whether a change to the recording path actually
 * did anything.
 *
 * Null when the audio could not be decoded, which is not a finding — some
 * browsers refuse to decode their own MediaRecorder output.
 */
export async function leadingSilenceSeconds(
  blob: Blob,
  ctx: AudioContext
): Promise<number | null> {
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
    const data = decoded.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) > SILENCE_FLOOR) return i / decoded.sampleRate
    }
    return decoded.duration
  } catch {
    return null
  }
}
