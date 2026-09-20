import { describe, it, expect } from 'vitest'
import { pickRecorderFormat, extensionFor, recorderOptions, TARGET_BITS_PER_SECOND } from '../recorderFormat'

describe('pickRecorderFormat', () => {
  it('prefers opus in webm when available', () => {
    expect(pickRecorderFormat(() => true)).toEqual({ mimeType: 'audio/webm;codecs=opus', ext: 'webm' })
  })

  it('falls back to mp4 on Safari, which offers nothing else', () => {
    const safari = (t: string) => t === 'audio/mp4'
    expect(pickRecorderFormat(safari)).toEqual({ mimeType: 'audio/mp4', ext: 'mp4' })
  })

  it('lets the browser decide when nothing is supported', () => {
    expect(pickRecorderFormat(() => false)).toEqual({ ext: 'webm' })
  })

  it('survives isTypeSupported throwing', () => {
    expect(pickRecorderFormat(() => { throw new Error('nope') })).toEqual({ ext: 'webm' })
  })
})

describe('extensionFor', () => {
  it('matches the container, so an uploaded name never lies', () => {
    expect(extensionFor('audio/webm;codecs=opus')).toBe('webm')
    expect(extensionFor('audio/ogg;codecs=opus')).toBe('ogg')
    expect(extensionFor('audio/mp4')).toBe('mp4')
    expect(extensionFor(undefined)).toBe('webm')
  })
})

describe('recorderOptions', () => {
  it('always asks for the smaller bitrate', () => {
    expect(recorderOptions({ mimeType: 'audio/webm', ext: 'webm' }).audioBitsPerSecond)
      .toBe(TARGET_BITS_PER_SECOND)
    expect(recorderOptions({ ext: 'webm' }).audioBitsPerSecond).toBe(TARGET_BITS_PER_SECOND)
  })

  it('omits an unsupported mime rather than forcing one', () => {
    expect(recorderOptions({ ext: 'webm' }).mimeType).toBeUndefined()
  })
})
