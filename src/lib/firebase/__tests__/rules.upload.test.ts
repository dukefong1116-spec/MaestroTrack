import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { getDocs, collection, query, where, type Firestore } from 'firebase/firestore'
import type { FirebaseStorage } from 'firebase/storage'

/**
 * The upload, run for real, with the blob a browser actually hands back.
 *
 * Every other Storage test states a content type by hand — which is the
 * one thing uploadRecording never did. It sent no metadata and let
 * `file.type` decide, and Safari describes an audio-only recording as
 * video/mp4, because mp4 is the container whether or not there is a
 * picture in it. The rules match `audio/.*`, so the take came back
 * `storage/unauthorized`: a permissions error for a labelling problem.
 *
 * So nothing here writes a content type. It builds the File the way the
 * app does, hands it to the real function, and lets that function decide
 * — which is the only way to tell whether the fix works or merely looks
 * right.
 */

const ANA = 'student-ana'
const live: { db: Firestore | null; storage: FirebaseStorage | null; uid: string | null } = {
  db: null, storage: null, uid: null,
}

vi.mock('../config', () => ({
  get db() { return live.db },
  get storage() { return live.storage },
  get auth() { return { currentUser: live.uid ? { uid: live.uid } : null } },
  default: {},
}))

const recordings = await import('../recordings')

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-maestrotrack',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  })
})
afterAll(async () => { await env?.cleanup() })

beforeEach(async () => {
  await env.clearFirestore()
  await env.clearStorage()
  const ctx = env.authenticatedContext(ANA)
  live.db = ctx.firestore() as unknown as Firestore
  live.storage = ctx.storage() as unknown as FirebaseStorage
  live.uid = ANA
})

/** The File the app builds — src/stores/uploadStore.ts:129. */
function take(blobType: string, ext: string): File {
  const blob = new Blob([new Uint8Array(2048)], { type: blobType })
  return new File([blob], `session-${Date.now()}.${ext}`, { type: blob.type })
}

const META = { pieceName: 'Kreutzer No. 2', date: '2026-10-18', duration: 95 }

describe('uploadRecording, with what the recorder really produces', () => {
  it.each([
    ['video/mp4', 'mp4', 'Safari — the one that failed'],
    ['audio/webm;codecs=opus', 'webm', 'Chrome'],
    ['audio/ogg;codecs=opus', 'ogg', 'Firefox'],
    ['audio/mp4', 'mp4', 'Safari, when it labels it honestly'],
    ['', 'webm', 'a blob that lost its type'],
  ])('%s (%s) — %s', async (blobType, ext) => {
    const id = await recordings.uploadRecording(ANA, take(blobType, ext), META as never)
    expect(id, 'the Firestore row should exist too').toBeTruthy()
  })

  it('the row written points at the audio and belongs to the uploader', async () => {
    await recordings.uploadRecording(ANA, take('video/mp4', 'mp4'), META as never)
    const snap = await getDocs(query(
      collection(live.db!, 'recordings'), where('userId', '==', ANA)))
    expect(snap.size).toBe(1)
    const row = snap.docs[0].data()
    expect(row.userId).toBe(ANA)
    expect(String(row.audioUrl)).toContain(`recordings%2F${ANA}%2F`)
  })

  it('a file that is genuinely not audio is still refused', async () => {
    // The fallback rewrites only a missing type and a video/* container.
    // Anything else goes through as it is, so the rule keeps its content
    // check — otherwise this app, and only this app, could put any file in
    // the bucket behind an audio label.
    const notAudio = new File([new Uint8Array(32)], 'notes.pdf', { type: 'application/pdf' })
    await expect(
      recordings.uploadRecording(ANA, notAudio, META as never)
    ).rejects.toMatchObject({ code: 'storage/unauthorized' })
  })

  it('a caller naming the wrong owner still uploads as whoever is signed in', async () => {
    // Documented behaviour, not an oversight: the profile uid can be
    // rebuilt from a stale cache, and the rules compare against the token.
    // Trusting the argument would mean uploading to a path the rules then
    // refuse, with nothing to say why.
    await recordings.uploadRecording('somebody-else', take('audio/webm', 'webm'), META as never)
    const snap = await getDocs(query(
      collection(live.db!, 'recordings'), where('userId', '==', ANA)))
    expect(snap.size, 'the row belongs to the signed-in user').toBe(1)
    expect(String(snap.docs[0].data().audioUrl)).toContain(`recordings%2F${ANA}%2F`)
  })
})
