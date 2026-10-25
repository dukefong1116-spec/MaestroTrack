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

/** How long each stream has been open, so a warm one is not warmed twice. */
const openedAt = new WeakMap<MediaStream, number>()

function isLive(stream: MediaStream | null): stream is MediaStream {
  return !!stream && stream.getAudioTracks().some((t) => t.readyState === 'live')
}

/**
 * A microphone stream, reusing one that is already open.
 *
 * Re-applies the constraints when the browser ignored them the first
 * time. applyConstraints is allowed to fail — on some browsers it throws
 * rather than returning — and a failure here is not fatal: it means the
 * recording is processed, which the warning above then explains.
 */
export async function openMic(existing: MediaStream | null): Promise<MediaStream> {
  if (isLive(existing)) return existing

  const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)
  openedAt.set(stream, Date.now())

  const track = stream.getAudioTracks()[0]
  if (track && activeProcessing(track).length > 0) {
    try {
      await track.applyConstraints(MIC_CONSTRAINTS.audio as MediaTrackConstraints)
    } catch {
      /* the warning tells the story instead */
    }
  }
  return stream
}

/** Milliseconds a freshly opened device is given before it is recorded. */
export const SETTLE_MS = 900

/**
 * How much longer this stream needs before it is worth recording.
 *
 * Zero for a stream that has been open a while — the second take of a
 * session should not wait for a device that never closed.
 */
export function remainingSettle(stream: MediaStream, now = Date.now()): number {
  const since = openedAt.get(stream)
  if (since === undefined) return 0
  return Math.max(0, SETTLE_MS - (now - since))
}

/** Test seam: pretend this stream opened at a particular moment. */
export function markOpened(stream: MediaStream, at: number): void {
  openedAt.set(stream, at)
}
