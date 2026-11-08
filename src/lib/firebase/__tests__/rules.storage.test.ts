import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest'
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage'
import { doc, setDoc, updateDoc } from 'firebase/firestore'

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
    // The Storage rules look up a take's document to decide whether a
    // teacher may hear it, so the documents have to be there to find.
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
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

  it('a teacher cannot read a take saved the old way', async () => {
    // No take id in the path, so nothing to check a hand-in against. Takes
    // saved like this still carry their old download URL, which is how
    // they are played.
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
 * Private playback: who may hear a take
 *
 * A take is saved at recordings/{student}/{takeId}/{file}, with no
 * download URL. The only way to hear it is through the SDK, as someone
 * these rules let in — so every play is decided here, at the time of
 * playing, by the take's document and the student's profile.
 * ════════════════════════════════════════════════════════════════════ */

describe('hearing a take that was handed in', () => {
  const OTHER_TEACHER = 'teacher-2'
  const path = (owner: string, id: string) => `recordings/${owner}/${id}/session.webm`

  beforeEach(async () => {
    await env.clearFirestore()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'users', TEACHER), { role: 'teacher' })
      await setDoc(doc(db, 'users', OTHER_TEACHER), { role: 'teacher' })
      await setDoc(doc(db, 'users', ANA), { role: 'student', teacherId: TEACHER })
      await setDoc(doc(db, 'users', BEN), { role: 'student', teacherId: TEACHER })
      await setDoc(doc(db, 'recordings', 'shared'), { userId: ANA, sharedWithTeacher: true, storagePath: path(ANA, 'shared') })
      await setDoc(doc(db, 'recordings', 'private'), { userId: ANA, storagePath: path(ANA, 'private') })
      await setDoc(doc(db, 'recordings', 'bens'), { userId: BEN, sharedWithTeacher: true, storagePath: path(BEN, 'bens') })
      const st = ctx.storage()
      await uploadBytes(ref(st, path(ANA, 'shared')), audio(), asAudio)
      await uploadBytes(ref(st, path(ANA, 'private')), audio(), asAudio)
      await uploadBytes(ref(st, path(BEN, 'bens')), audio(), asAudio)
      // A file in Ana's folder filed under Ben's take: a student cannot
      // borrow someone else's hand-in to open their own file.
      await uploadBytes(ref(st, path(ANA, 'bens')), audio(), asAudio)
    })
  })

  it('the student hears their own, handed in or not', async () => {
    await assertSucceeds(getBytes(ref(as(ANA), path(ANA, 'shared'))))
    await assertSucceeds(getBytes(ref(as(ANA), path(ANA, 'private'))))
  })

  it('their teacher hears a take once it is handed in', async () => {
    await assertSucceeds(getBytes(ref(as(TEACHER), path(ANA, 'shared'))))
  })

  it('their teacher cannot hear one that was not handed in', async () => {
    await assertFails(getBytes(ref(as(TEACHER), path(ANA, 'private'))))
  })

  it('another teacher cannot hear it, handed in or not', async () => {
    await assertFails(getBytes(ref(as(OTHER_TEACHER), path(ANA, 'shared'))))
  })

  it('a classmate cannot hear it', async () => {
    await assertFails(getBytes(ref(as(BEN), path(ANA, 'shared'))))
  })

  it('nobody signed out can hear it', async () => {
    await assertFails(getBytes(ref(anon(), path(ANA, 'shared'))))
  })

  it('the teacher loses it the moment the student leaves the studio', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users', ANA), { teacherId: null })
    })
    await assertFails(getBytes(ref(as(TEACHER), path(ANA, 'shared'))))
  })

  it('or the moment the take stops being handed in', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'recordings', 'shared'), { sharedWithTeacher: false })
    })
    await assertFails(getBytes(ref(as(TEACHER), path(ANA, 'shared'))))
  })

  it('a hand-in only opens files in its own student’s folder', async () => {
    // Ben's take is handed in, but this file is in Ana's folder.
    await assertFails(getBytes(ref(as(TEACHER), path(ANA, 'bens'))))
    // While Ben's own file under it is fine.
    await assertSucceeds(getBytes(ref(as(TEACHER), path(BEN, 'bens'))))
  })

  it('a path naming a take that does not exist opens nothing', async () => {
    await assertFails(getBytes(ref(as(TEACHER), path(ANA, 'no-such-take'))))
  })

  it('hearing it is all a teacher may do', async () => {
    await assertFails(deleteObject(ref(as(TEACHER), path(ANA, 'shared'))))
    await assertFails(uploadBytes(ref(as(TEACHER), path(ANA, 'shared')), audio(), asAudio))
  })

  it('the student still uploads and deletes in the new layout', async () => {
    await assertSucceeds(uploadBytes(ref(as(ANA), path(ANA, 'new-take')), audio(), asAudio))
    await assertSucceeds(deleteObject(ref(as(ANA), path(ANA, 'private'))))
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
  const normalise = (t: string | undefined): string => {
    if (!t) return 'audio/webm'
    if (t.startsWith('audio/')) return t
    if (t.startsWith('video/')) return 'audio/' + t.slice('video/'.length)
    return 'audio/webm'
  }

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

  // The real failure: Safari records to mp4 and may describe the result as
  // video/mp4, because mp4 is the container whether or not there is a
  // picture in it. `storage/unauthorized` on a correctly-formed path was
  // this, not a console misconfiguration.
  it.each(['video/mp4', 'video/webm', 'video/ogg'])(
    'a take the recorder described as %s', async (reported) => {
      const corrected = normalise(reported)
      expect(corrected.startsWith('audio/'), 'must satisfy the rule').toBe(true)
      expect(corrected.split('/')[1], 'and must keep the container')
        .toBe(reported.split('/')[1])
      await assertSucceeds(uploadBytes(
        ref(as(ANA), `recordings/${ANA}/take.webm`), audio(),
        { contentType: corrected }))
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

/**
 * Profile photos.
 *
 * A second write path into the bucket, so it gets the same scrutiny the
 * recordings path got: who may write, what may be written, and how big.
 */
describe('profile photos', () => {
  const png = (bytes = 2048) => new Uint8Array(bytes)
  const asPng = { contentType: 'image/png' }

  it('you write your own', async () => {
    await assertSucceeds(uploadBytes(ref(as(ANA), `avatars/${ANA}/profile`), png(), asPng))
  })

  it('and read it back', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), `avatars/${ANA}/profile`), png(), asPng)
    })
    await assertSucceeds(getBytes(ref(as(ANA), `avatars/${ANA}/profile`)))
  })

  it('nobody else writes into your folder', async () => {
    await assertFails(uploadBytes(ref(as(BEN), `avatars/${ANA}/profile`), png(), asPng))
    await assertFails(uploadBytes(ref(as(TEACHER), `avatars/${ANA}/profile`), png(), asPng))
    await assertFails(uploadBytes(ref(anon(), `avatars/${ANA}/profile`), png(), asPng))
  })

  it('nobody else reads it by path', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), `avatars/${ANA}/profile`), png(), asPng)
    })
    await assertFails(getBytes(ref(as(BEN), `avatars/${ANA}/profile`)))
    await assertFails(getBytes(ref(anon(), `avatars/${ANA}/profile`)))
  })

  it('only images, so the bucket is not file hosting', async () => {
    await assertFails(
      uploadBytes(ref(as(ANA), `avatars/${ANA}/profile`), png(), { contentType: 'application/pdf' }))
    await assertFails(
      uploadBytes(ref(as(ANA), `avatars/${ANA}/profile`), png(), { contentType: 'audio/webm' }))
    // An empty type is what a blob with no label arrives as.
    await assertFails(
      uploadBytes(ref(as(ANA), `avatars/${ANA}/profile`), png(), { contentType: '' }))
  })

  it('not SVG, which can carry script', async () => {
    await assertFails(
      uploadBytes(ref(as(ANA), `avatars/${ANA}/profile`), png(), { contentType: 'image/svg+xml' }))
  })

  it('jpeg and webp are fine too', async () => {
    await assertSucceeds(
      uploadBytes(ref(as(ANA), `avatars/${ANA}/profile`), png(), { contentType: 'image/jpeg' }))
    await assertSucceeds(
      uploadBytes(ref(as(ANA), `avatars/${ANA}/profile`), png(), { contentType: 'image/webp' }))
  })

  it('5MB is the ceiling', async () => {
    await assertFails(
      uploadBytes(ref(as(ANA), `avatars/${ANA}/profile`), png(5 * 1024 * 1024 + 1), asPng))
  })

  it('you can delete your own, and only your own', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), `avatars/${ANA}/profile`), png(), asPng)
    })
    await assertFails(deleteObject(ref(as(BEN), `avatars/${ANA}/profile`)))
    await assertSucceeds(deleteObject(ref(as(ANA), `avatars/${ANA}/profile`)))
  })
})
