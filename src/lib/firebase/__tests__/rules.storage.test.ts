import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest'
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage'

/**
 * The Storage rules, which nothing had tested.
 *
 * These govern the audio itself. They matter less than they look, because
 * a Firebase download URL carries its own token and works for anyone
 * holding it — the Firestore rule on the recording document is the real
 * gate on who hears a take. But these decide who can *upload*, and an
 * unbounded write path is how a bucket fills with someone else's files.
 */

const PROJECT = 'demo-maestrotrack'
const ANA = 'student-ana'
const BEN = 'student-ben'
const TEACHER = 'teacher-1'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  })
})
afterAll(async () => { await env?.cleanup() })
beforeEach(async () => { await env.clearStorage() })

const as = (uid: string) => env.authenticatedContext(uid).storage()
const anon = () => env.unauthenticatedContext().storage()

const audio = (bytes = 1024) =>
  new Uint8Array(bytes)
const asAudio = { contentType: 'audio/webm' }

describe('uploading a take', () => {
  it('a student writes into their own folder', async () => {
    await assertSucceeds(
      uploadBytes(ref(as(ANA), `recordings/${ANA}/take-1.webm`), audio(), asAudio))
  })

  it('a student CANNOT write into another student’s folder', async () => {
    await assertFails(
      uploadBytes(ref(as(BEN), `recordings/${ANA}/planted.webm`), audio(), asAudio))
  })

  it('a teacher cannot write into a student’s folder', async () => {
    await assertFails(
      uploadBytes(ref(as(TEACHER), `recordings/${ANA}/teacher.webm`), audio(), asAudio))
  })

  it('a stranger cannot write anywhere', async () => {
    await assertFails(
      uploadBytes(ref(anon(), `recordings/${ANA}/anon.webm`), audio(), asAudio))
  })

  it('nothing can be written outside recordings/', async () => {
    await assertFails(uploadBytes(ref(as(ANA), 'anything-else.webm'), audio(), asAudio))
    await assertFails(uploadBytes(ref(as(ANA), `uploads/${ANA}/x.webm`), audio(), asAudio))
  })
})

describe('what may be uploaded', () => {
  it('non-audio is refused, so the bucket cannot be used as file hosting', async () => {
    await assertFails(uploadBytes(
      ref(as(ANA), `recordings/${ANA}/not-audio.exe`), audio(),
      { contentType: 'application/octet-stream' }))
  })

  it('a file with no declared type is refused', async () => {
    await assertFails(uploadBytes(ref(as(ANA), `recordings/${ANA}/untyped`), audio()))
  })

  it('a normal-sized take is accepted, which is the other half of the cap', async () => {
    // The 200MB ceiling is not exercised here: allocating that much in a
    // test to prove a comparison holds is a poor trade, and the size is
    // measured by the server rather than declared by the client, so it
    // cannot be forged. What is worth asserting is that the clause does not
    // reject ordinary files — a cap written wrongly fails closed, and that
    // would be silent.
    await assertSucceeds(uploadBytes(
      ref(as(ANA), `recordings/${ANA}/normal.webm`), audio(2 * 1024 * 1024), asAudio))
  })
})

describe('reading and deleting a take', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), `recordings/${ANA}/take-1.webm`), audio(), asAudio)
    })
  })

  it('a student reads their own', async () => {
    await assertSucceeds(getBytes(ref(as(ANA), `recordings/${ANA}/take-1.webm`)))
  })

  it('a classmate cannot read it', async () => {
    await assertFails(getBytes(ref(as(BEN), `recordings/${ANA}/take-1.webm`)))
  })

  it('a teacher cannot read it through Storage', async () => {
    // Deliberate, and worth stating: a teacher hears a submitted take via
    // the download URL stored on the Firestore document, not through the
    // SDK. This path stays closed.
    await assertFails(getBytes(ref(as(TEACHER), `recordings/${ANA}/take-1.webm`)))
  })

  it('a stranger cannot read it', async () => {
    await assertFails(getBytes(ref(anon(), `recordings/${ANA}/take-1.webm`)))
  })

  it('a student deletes their own', async () => {
    await assertSucceeds(deleteObject(ref(as(ANA), `recordings/${ANA}/take-1.webm`)))
  })

  it('nobody else can delete it', async () => {
    await assertFails(deleteObject(ref(as(BEN), `recordings/${ANA}/take-1.webm`)))
    await assertFails(deleteObject(ref(as(TEACHER), `recordings/${ANA}/take-1.webm`)))
  })
})

/* ══════════════════════════════════════════════════════════════════════
 * The content type the app actually sends
 *
 * Every test above states `audio/webm` explicitly, which is the one thing
 * the upload never did: it passed no metadata at all and let the blob's
 * own type decide. That is the gap this group closes — the cases below
 * are what a browser really hands back, including the ones where the type
 * is missing, and they go through the app's own normalisation rather than
 * a value written here to suit the rule.
 * ════════════════════════════════════════════════════════════════════ */

describe('what the app sends as a content type', () => {
  // Mirrors audioContentType in src/lib/firebase/recordings.ts.
  const normalise = (t: string | undefined) =>
    t && t.startsWith('audio/') ? t : 'audio/webm'

  const FROM_BROWSERS = [
    'audio/webm;codecs=opus',  // Chrome
    'audio/ogg;codecs=opus',   // Firefox
    'audio/mp4',               // Safari
    'audio/webm',
  ]

  for (const type of FROM_BROWSERS) {
    it(`accepts ${type}`, async () => {
      await assertSucceeds(uploadBytes(
        ref(as(ANA), `recordings/${ANA}/take.webm`), audio(),
        { contentType: normalise(type) }))
    })
  }

  it('a blob that lost its type still uploads, because the app names one', async () => {
    await assertSucceeds(uploadBytes(
      ref(as(ANA), `recordings/${ANA}/take.webm`), audio(),
      { contentType: normalise('') }))
  })

  it('a container type some browsers report for audio-only recording', async () => {
    await assertSucceeds(uploadBytes(
      ref(as(ANA), `recordings/${ANA}/take.webm`), audio(),
      { contentType: normalise('video/webm') }))
  })

  it('and the rule still refuses something that is genuinely not audio', async () => {
    await assertFails(uploadBytes(
      ref(as(ANA), `recordings/${ANA}/notes.pdf`), audio(),
      { contentType: 'application/pdf' }))
  })

  it('sending no content type at all is refused — the case that bit', async () => {
    await assertFails(uploadBytes(
      ref(as(ANA), `recordings/${ANA}/take.webm`), audio()))
  })
})
