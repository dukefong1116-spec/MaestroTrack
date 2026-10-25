import { describe, it, expect } from 'vitest'
import {
  activeProcessing, listPhrase, micProcessingWarning,
  remainingSettle, markOpened, SETTLE_MS,
} from '../mic'

const track = (settings: Record<string, unknown> | 'throws'): MediaStreamTrack => ({
  readyState: 'live',
  getSettings: () => {
    if (settings === 'throws') throw new Error('not supported')
    return settings
  },
} as unknown as MediaStreamTrack)

const streamOf = (t: MediaStreamTrack | null): MediaStream => ({
  getAudioTracks: () => (t ? [t] : []),
} as unknown as MediaStream)

describe('what the browser admits to doing', () => {
  it('reports each kind of processing that is on', () => {
    expect(activeProcessing(track({
      autoGainControl: true, noiseSuppression: true, echoCancellation: true,
    }))).toEqual(['automatic gain control', 'noise suppression', 'echo cancellation'])
  })

  it('says nothing when the constraints were honoured', () => {
    expect(activeProcessing(track({
      autoGainControl: false, noiseSuppression: false, echoCancellation: false,
    }))).toEqual([])
  })

  /**
   * Not the same as "nothing is on", but treated the same on purpose:
   * warning about a setting we cannot see would be guessing out loud.
   */
  it('stays quiet when the browser does not report these at all', () => {
    expect(activeProcessing(track({ channelCount: 1 }))).toEqual([])
    expect(activeProcessing(track('throws'))).toEqual([])
  })
})

describe('the warning', () => {
  it('names what is on, and where to look', () => {
    const w = micProcessingWarning(streamOf(track({ autoGainControl: true })))
    expect(w).toContain('automatic gain control')
    expect(w).toContain('Control Centre')
  })

  it('reads as a sentence with two of them', () => {
    const w = micProcessingWarning(streamOf(track({
      autoGainControl: true, noiseSuppression: true,
    })))
    expect(w).toContain('automatic gain control and noise suppression')
  })

  it('is absent when there is nothing to warn about', () => {
    expect(micProcessingWarning(streamOf(track({ autoGainControl: false })))).toBeNull()
    expect(micProcessingWarning(streamOf(null))).toBeNull()
    expect(micProcessingWarning(null)).toBeNull()
  })
})

describe('listPhrase', () => {
  it('handles one, two and three', () => {
    expect(listPhrase(['a'])).toBe('a')
    expect(listPhrase(['a', 'b'])).toBe('a and b')
    expect(listPhrase(['a', 'b', 'c'])).toBe('a, b, and c')
    expect(listPhrase([])).toBe('')
  })
})

describe('settling', () => {
  const stream = streamOf(track({}))

  it('a device just opened gets the full wait', () => {
    const now = 1_000_000
    markOpened(stream, now)
    expect(remainingSettle(stream, now)).toBe(SETTLE_MS)
  })

  it('counts down as it warms', () => {
    const now = 1_000_000
    markOpened(stream, now)
    expect(remainingSettle(stream, now + 400)).toBe(SETTLE_MS - 400)
  })

  /** The second take of a session must not wait for a mic that never closed. */
  it('a warm device waits for nothing', () => {
    const now = 1_000_000
    markOpened(stream, now)
    expect(remainingSettle(stream, now + SETTLE_MS + 50)).toBe(0)
  })

  it('and a stream we never opened is assumed warm', () => {
    expect(remainingSettle(streamOf(track({})), Date.now())).toBe(0)
  })
})
