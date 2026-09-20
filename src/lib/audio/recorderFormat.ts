/**
 * Recording format.
 *
 * `new MediaRecorder(stream)` with no options encodes at whatever the
 * browser fancies — measured at 129 kbps in Chrome, which is 29 MB for a
 * half-hour practice and 58 MB for an hour. That is the reason finishing a
 * session with a take felt like it hung: the session row was written in
 * well under a second and then the page sat waiting on tens of megabytes.
 *
 * 64 kbps Opus is ample for listening back to your own playing — this is a
 * practice diary, not a master. It is roughly a quarter of the size.
 */

/** Ordered by preference. Safari only offers mp4/aac. */
const CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/webm',
  'audio/mp4',
] as const

export const TARGET_BITS_PER_SECOND = 64_000

export interface RecorderFormat {
  /** Undefined means "let the browser choose" — nothing we offered was supported. */
  mimeType?: string
  /** File extension matching the container, so the upload name never lies. */
  ext: string
}

/** Maps a mime type to the extension its container actually uses. */
export function extensionFor(mimeType: string | undefined): string {
  if (!mimeType) return 'webm'
  if (mimeType.includes('mp4')) return 'mp4'
  if (mimeType.includes('ogg')) return 'ogg'
  return 'webm'
}

export function pickRecorderFormat(
  isSupported: (type: string) => boolean = (t) =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)
): RecorderFormat {
  for (const type of CANDIDATES) {
    try {
      if (isSupported(type)) return { mimeType: type, ext: extensionFor(type) }
    } catch {
      /* isTypeSupported can throw on odd inputs in older browsers */
    }
  }
  return { ext: 'webm' }
}

/**
 * Options for the MediaRecorder constructor. A browser that rejects the
 * bitrate hint still records — it just records large, which is what it did
 * before this existed.
 */
export function recorderOptions(format: RecorderFormat): MediaRecorderOptions {
  return format.mimeType
    ? { mimeType: format.mimeType, audioBitsPerSecond: TARGET_BITS_PER_SECOND }
    : { audioBitsPerSecond: TARGET_BITS_PER_SECOND }
}

/**
 * Microphone constraints for capturing an instrument.
 *
 * `getUserMedia({ audio: true })` opts you into the browser's voice-call
 * processing chain, which is the wrong tool entirely here: automatic gain
 * control flattens a diminuendo, noise suppression can gate a quiet
 * sustained note as background hiss, and echo cancellation introduces
 * dropouts. All three hurt a recording you are going to judge your own
 * tone from — and they degrade the tuner's pitch detection too, since both
 * share this stream.
 *
 * Mono because an instrument recorded on one mic is mono anyway, and
 * asking for it keeps the encoder from spending bits on a duplicated
 * channel.
 */
export const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: 1,
  },
}
